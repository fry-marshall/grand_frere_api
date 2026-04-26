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
import { Repository } from 'typeorm';
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
import { CardResponseDto } from './dto/card-response.dto';
import { UpdateDailyLimitDto } from './dto/update-daily-limit.dto';
import { VerifyPinDto } from './dto/verify-pin.dto';
import { ResetPinDto } from './dto/reset-pin.dto';
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
    const imageUrls: string[] = [];
    const batchSize = 3;

    try {
      for (let i = 0; i < codes.length; i += batchSize) {
        const slice = codes.slice(i, i + batchSize);
        const bufferSlice = qrBuffers.slice(i, i + batchSize);
        const results = await Promise.all(
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
        imageUrls.push(...results);
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
        codes.map((code, i) => ({
          code,
          schoolId: dto.schoolId,
          status: CardStatus.UNASSIGNED,
          imageUrl: imageUrls[i],
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

  async findOne(
    code: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<CardResponseDto> {
    const card = await this.cardRepo.findOne({ where: { code } });
    if (!card) throw new NotFoundException(ErrorMessages.CARDS.NOT_FOUND);

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      await this.assertSchoolAdminOwnsCard(currentUser.id, card);
    }

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

    if (currentUser.role === UserRole.PARENT) {
      await this.assertParentOwnsCard(currentUser.id, card);
    } else {
      await this.assertStudentOwnsCard(currentUser.id, card);
    }

    await this.cardRepo.update(card.id, { dailyLimit: dto.dailyLimit });
    return this.toDto({ ...card, dailyLimit: dto.dailyLimit });
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

  private async assertOwnership(
    currentUser: { id: string; role: UserRole },
    card: Card,
  ): Promise<void> {
    if (currentUser.role === UserRole.SUPER_ADMIN) return;

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      await this.assertSchoolAdminOwnsCard(currentUser.id, card);
      return;
    }

    if (currentUser.role === UserRole.PARENT) {
      await this.assertParentOwnsCard(currentUser.id, card);
      return;
    }

    if (currentUser.role === UserRole.STUDENT) {
      await this.assertStudentOwnsCard(currentUser.id, card);
    }
  }

  private async assertSchoolAdminOwnsCard(
    adminId: string,
    card: Card,
  ): Promise<void> {
    const admin = await this.userRepo.findOne({ where: { id: adminId } });
    if (admin?.schoolId !== card.schoolId) {
      throw new ForbiddenException();
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
      imageUrl: card.imageUrl ?? null,
      createdAt: card.createdAt,
    };
  }
}
