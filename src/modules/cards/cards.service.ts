import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import * as QRCode from 'qrcode';
import { Card } from './entities/card.entity';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { Student } from '../students/entities/student.entity';
import { Parent } from '../parents/entities/parent.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { CardStatus } from './card.types';
import { UserRole } from '../users/user.types';
import { CreateCardsBatchDto } from './dto/create-cards-batch.dto';
import { CardsSearchQueryDto } from './dto/cards-search-query.dto';
import { CardResponseDto } from './dto/card-response.dto';
import { CardListItemResponseDto } from './dto/card-list-item-response.dto';
import { UpdateDailyLimitDto } from './dto/update-daily-limit.dto';
import { UpdateDailyLimitPermissionDto } from './dto/update-daily-limit-permission.dto';
import { VerifyPinDto } from './dto/verify-pin.dto';
import { ResetPinDto } from './dto/reset-pin.dto';
import { ReplaceCardDto } from './dto/replace-card.dto';
import * as storageInterface from '../../common/storage/storage.interface';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class CardsService {
  private readonly logger = new Logger(CardsService.name);

  constructor(
    @InjectRepository(Card) private readonly cardRepo: Repository<Card>,
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Parent) private readonly parentRepo: Repository<Parent>,
    @InjectRepository(StudentParent)
    private readonly studentParentRepo: Repository<StudentParent>,
    @Inject(storageInterface.STORAGE_SERVICE)
    private readonly storageService: storageInterface.IStorageService,
    private readonly dataSource: DataSource,
  ) {}

  async createBatch(dto: CreateCardsBatchDto): Promise<CardResponseDto[]> {
    const school = await this.schoolRepo.findOne({
      where: { id: dto.schoolId },
    });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

    const codes = await this.generateUniqueCodes(school.sigle, dto.count);

    const qrBuffers = await Promise.all(
      codes.map((code) =>
        QRCode.toBuffer(code, { type: 'png', width: 400, margin: 2 }),
      ),
    );

    const uploadedKeys: string[] = [];
    const batchSize = 3;

    try {
      for (let i = 0; i < codes.length; i += batchSize) {
        const slice = codes.slice(i, i + batchSize);
        const bufferSlice = qrBuffers.slice(i, i + batchSize);
        await Promise.all(
          slice.map((code, j) => {
            const key = `cards/${dto.schoolId}/${code}.png`;
            uploadedKeys.push(key);
            return this.storageService.uploadBuffer(
              bufferSlice[j],
              key,
              'image/png',
            );
          }),
        );
      }
    } catch (error) {
      this.logger.error('QR upload failed, rolling back Spaces keys');
      await Promise.allSettled(
        uploadedKeys.map((key) => this.storageService.deleteFile(key)),
      );
      throw error;
    }

    let savedCards: Card[];
    try {
      savedCards = await this.cardRepo.save(
        codes.map((code) => ({
          code,
          schoolId: dto.schoolId,
          status: CardStatus.UNASSIGNED,
          imageUrl: `${code}.png`,
        })),
      );
    } catch (error) {
      this.logger.error('DB write failed, rolling back Spaces keys');
      await Promise.allSettled(
        uploadedKeys.map((key) => this.storageService.deleteFile(key)),
      );
      throw error;
    }

    return savedCards.map((card) => this.toDto(card));
  }

  async search(
    query: CardsSearchQueryDto,
  ): Promise<{ data: CardListItemResponseDto[]; meta: object }> {
    const { schoolId, status, search, page, limit } = query;

    const qb = this.cardRepo
      .createQueryBuilder('card')
      .leftJoinAndSelect('card.school', 'school');

    if (schoolId) {
      qb.andWhere('card.schoolId = :schoolId', { schoolId });
    }
    if (status) {
      qb.andWhere('card.status = :status', { status });
    }
    if (search) {
      qb.andWhere('card.code ILIKE :search', { search: `%${search}%` });
    }

    const [cards, total] = await qb
      .orderBy('card.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const studentIds = cards
      .map((c) => c.studentId)
      .filter((id): id is string => !!id);
    const students = studentIds.length
      ? await this.studentRepo.find({
          where: { id: In(studentIds) },
          relations: ['user'],
        })
      : [];
    const studentNameById = new Map(
      students.map((s) => [s.id, `${s.user.firstName} ${s.user.lastName}`]),
    );

    return {
      data: cards.map((card) => ({
        id: card.id,
        code: card.code,
        status: card.status,
        schoolId: card.schoolId,
        schoolName: card.school.name,
        studentId: card.studentId ?? null,
        studentName: card.studentId
          ? (studentNameById.get(card.studentId) ?? null)
          : null,
        createdAt: card.createdAt,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(
    code: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<CardResponseDto> {
    const card = await this.cardRepo.findOne({ where: { code } });
    if (!card) throw new NotFoundException(ErrorMessages.CARDS.NOT_FOUND);

    await this.assertOwnership(currentUser, card);

    return this.toDto(card);
  }

  async suspend(
    code: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<CardResponseDto> {
    const card = await this.cardRepo.findOne({ where: { code } });
    if (!card) throw new NotFoundException(ErrorMessages.CARDS.NOT_FOUND);

    if (card.status !== CardStatus.ACTIVE) {
      throw new ConflictException(ErrorMessages.CARDS.NOT_SUSPENDABLE);
    }

    await this.assertOwnership(currentUser, card);

    await this.cardRepo.update(card.id, { status: CardStatus.SUSPENDED });
    return this.toDto({ ...card, status: CardStatus.SUSPENDED });
  }

  async activate(
    code: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<CardResponseDto> {
    const card = await this.cardRepo.findOne({ where: { code } });
    if (!card) throw new NotFoundException(ErrorMessages.CARDS.NOT_FOUND);

    if (card.status !== CardStatus.SUSPENDED) {
      throw new ConflictException(ErrorMessages.CARDS.NOT_ACTIVATABLE);
    }

    await this.assertOwnership(currentUser, card);

    await this.cardRepo.update(card.id, { status: CardStatus.ACTIVE });
    return this.toDto({ ...card, status: CardStatus.ACTIVE });
  }

  async updateDailyLimit(
    code: string,
    dto: UpdateDailyLimitDto,
    currentUser: { id: string; role: UserRole },
  ): Promise<CardResponseDto> {
    const card = await this.cardRepo.findOne({ where: { code } });
    if (!card) throw new NotFoundException(ErrorMessages.CARDS.NOT_FOUND);

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      // No ownership or editability check: the back-office can always adjust the limit.
    } else if (currentUser.role === UserRole.PARENT) {
      await this.assertParentOwnsCard(currentUser.id, card);
    } else {
      await this.assertStudentOwnsCard(currentUser.id, card);
      if (!card.studentCanEditDailyLimit) {
        throw new ForbiddenException(
          ErrorMessages.CARDS.DAILY_LIMIT_EDIT_NOT_ALLOWED,
        );
      }
    }

    await this.cardRepo.update(card.id, { dailyLimit: dto.dailyLimit });
    return this.toDto({ ...card, dailyLimit: dto.dailyLimit });
  }

  async updateDailyLimitPermission(
    code: string,
    dto: UpdateDailyLimitPermissionDto,
    currentUser: { id: string; role: UserRole },
  ): Promise<CardResponseDto> {
    const card = await this.cardRepo.findOne({ where: { code } });
    if (!card) throw new NotFoundException(ErrorMessages.CARDS.NOT_FOUND);

    await this.assertParentOwnsCard(currentUser.id, card);

    await this.cardRepo.update(card.id, {
      studentCanEditDailyLimit: dto.studentCanEditDailyLimit,
    });
    return this.toDto({
      ...card,
      studentCanEditDailyLimit: dto.studentCanEditDailyLimit,
    });
  }

  async verifyPin(code: string, dto: VerifyPinDto): Promise<CardResponseDto> {
    const card = await this.cardRepo.findOne({ where: { code } });
    if (!card) throw new NotFoundException(ErrorMessages.CARDS.NOT_FOUND);

    if (card.status === CardStatus.BLOCKED) {
      throw new ForbiddenException(ErrorMessages.CARDS.CARD_BLOCKED);
    }
    if (card.status !== CardStatus.ACTIVE) {
      throw new ConflictException(ErrorMessages.CARDS.NOT_ACTIVE);
    }
    if (!card.pinHash) {
      throw new ConflictException(ErrorMessages.CARDS.PIN_NOT_SET);
    }

    const isValid = await bcrypt.compare(dto.pin, card.pinHash);

    if (!isValid) {
      const newAttempts = card.pinAttempts + 1;
      if (newAttempts >= 3) {
        await this.cardRepo.update(card.id, {
          pinAttempts: newAttempts,
          status: CardStatus.BLOCKED,
        });
        throw new ForbiddenException(ErrorMessages.CARDS.CARD_BLOCKED);
      }
      await this.cardRepo.update(card.id, { pinAttempts: newAttempts });
      throw new UnauthorizedException(ErrorMessages.CARDS.PIN_INVALID);
    }

    await this.cardRepo.update(card.id, { pinAttempts: 0 });
    return this.toDto({ ...card, pinAttempts: 0 });
  }

  async resetPin(
    code: string,
    dto: ResetPinDto,
    currentUser: { id: string; role: UserRole },
  ): Promise<CardResponseDto> {
    const card = await this.cardRepo.findOne({ where: { code } });
    if (!card) throw new NotFoundException(ErrorMessages.CARDS.NOT_FOUND);

    if (currentUser.role === UserRole.PARENT) {
      await this.assertParentOwnsCard(currentUser.id, card);
    } else {
      await this.assertStudentOwnsCard(currentUser.id, card);
    }

    const user = await this.userRepo.findOne({ where: { id: currentUser.id } });
    if (!user?.passwordHash) {
      throw new UnauthorizedException(ErrorMessages.CARDS.INVALID_PASSWORD);
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException(ErrorMessages.CARDS.INVALID_PASSWORD);
    }

    const pinHash = await bcrypt.hash(dto.newPin, 10);
    const newStatus =
      card.status === CardStatus.BLOCKED ? CardStatus.ACTIVE : card.status;

    await this.cardRepo.update(card.id, {
      pinHash,
      pinAttempts: 0,
      status: newStatus,
    });
    return this.toDto({ ...card, pinAttempts: 0, status: newStatus });
  }

  async replaceCard(
    code: string,
    dto: ReplaceCardDto,
    currentUser: { id: string; role: UserRole },
  ): Promise<CardResponseDto> {
    const lostCard = await this.cardRepo.findOne({ where: { code } });
    if (!lostCard) throw new NotFoundException(ErrorMessages.CARDS.NOT_FOUND);

    await this.assertOwnership(currentUser, lostCard);

    if (!lostCard.studentId || lostCard.status === CardStatus.UNASSIGNED) {
      throw new ConflictException(ErrorMessages.CARDS.NOT_REPLACEABLE);
    }

    if (lostCard.code === dto.newCardCode) {
      throw new ConflictException(ErrorMessages.CARDS.SAME_CARD);
    }

    const newCard = await this.cardRepo.findOne({
      where: { code: dto.newCardCode },
    });
    if (!newCard) throw new NotFoundException(ErrorMessages.CARDS.NOT_FOUND);

    if (newCard.status !== CardStatus.UNASSIGNED) {
      throw new ConflictException(ErrorMessages.CARDS.NEW_CARD_NOT_BLANK);
    }

    if (newCard.schoolId !== lostCard.schoolId) {
      throw new ConflictException(ErrorMessages.CARDS.SCHOOL_MISMATCH);
    }

    const studentId = lostCard.studentId;

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Card, newCard.id, {
        status: CardStatus.ACTIVE,
        studentId,
        pinHash: lostCard.pinHash,
        pinAttempts: 0,
        dailyLimit: lostCard.dailyLimit,
        studentCanEditDailyLimit: lostCard.studentCanEditDailyLimit,
      });

      await manager.update(Card, lostCard.id, {
        status: CardStatus.LOST,
        studentId: null as unknown as string,
      });

      await manager.update(Student, studentId, { cardId: newCard.id });
    });

    return this.toDto({
      ...newCard,
      status: CardStatus.ACTIVE,
      studentId,
      pinHash: lostCard.pinHash,
      pinAttempts: 0,
      dailyLimit: lostCard.dailyLimit,
      studentCanEditDailyLimit: lostCard.studentCanEditDailyLimit,
    });
  }

  private async assertOwnership(
    currentUser: { id: string; role: UserRole },
    card: Card,
  ): Promise<void> {
    if (currentUser.role === UserRole.SUPER_ADMIN) return;

    if (currentUser.role === UserRole.PARENT) {
      await this.assertParentOwnsCard(currentUser.id, card);
      return;
    }

    if (currentUser.role === UserRole.STUDENT) {
      await this.assertStudentOwnsCard(currentUser.id, card);
    }
  }

  private async assertParentOwnsCard(
    userId: string,
    card: Card,
  ): Promise<void> {
    if (!card.studentId) throw new ForbiddenException();

    const parent = await this.parentRepo.findOne({ where: { userId } });
    if (!parent) throw new ForbiddenException();

    const link = await this.studentParentRepo.findOne({
      where: { parentId: parent.id, studentId: card.studentId },
    });
    if (!link) throw new ForbiddenException();
  }

  private async assertStudentOwnsCard(
    userId: string,
    card: Card,
  ): Promise<void> {
    const student = await this.studentRepo.findOne({ where: { userId } });
    if (!student || student.id !== card.studentId)
      throw new ForbiddenException();
  }

  private async generateUniqueCodes(
    sigle: string,
    count: number,
  ): Promise<string[]> {
    const codes = new Set<string>();

    while (codes.size < count) {
      const digits = Math.floor(Math.random() * 10000)
        .toString()
        .padStart(4, '0');
      const code = `GF-${sigle}-${digits}`;

      if (codes.has(code)) continue;

      const exists = await this.cardRepo.existsBy({ code });
      if (!exists) codes.add(code);
    }

    return Array.from(codes);
  }

  private toDto(card: Card): CardResponseDto {
    return {
      id: card.id,
      code: card.code,
      status: card.status,
      schoolId: card.schoolId,
      studentId: card.studentId ?? null,
      dailyLimit: card.dailyLimit,
      studentCanEditDailyLimit: card.studentCanEditDailyLimit,
      imageUrl: card.imageUrl
        ? this.storageService.getPublicUrl(
            `cards/${card.schoolId}/${card.imageUrl}`,
          )
        : null,
      createdAt: card.createdAt,
    };
  }
}
