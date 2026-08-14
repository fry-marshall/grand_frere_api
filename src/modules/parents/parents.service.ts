import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Parent } from './entities/parent.entity';
import { User } from '../users/entities/user.entity';
import { Student } from '../students/entities/student.entity';
import { Card } from '../cards/entities/card.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { UserRole, UserStatus } from '../users/user.types';
import { CardStatus } from '../cards/card.types';
import { ParentResponseDto } from './dto/parent-response.dto';
import { ParentListItemResponseDto } from './dto/parent-list-item-response.dto';
import { ParentStudentResponseDto } from './dto/parent-student-response.dto';
import { UpdateParentProfileDto } from './dto/update-parent-profile.dto';
import { AddBeneficiaryDto } from './dto/add-beneficiary.dto';
import { ParentsSearchQueryDto } from './dto/parents-search-query.dto';
import { ErrorMessages } from '../../common/swagger/error-messages';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class ParentsService {
  constructor(
    @InjectRepository(Parent)
    private readonly parentRepo: Repository<Parent>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Card)
    private readonly cardRepo: Repository<Card>,
    @InjectRepository(StudentParent)
    private readonly studentParentRepo: Repository<StudentParent>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    private readonly dataSource: DataSource,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async search(
    query: ParentsSearchQueryDto,
  ): Promise<{ data: ParentListItemResponseDto[]; meta: object }> {
    const { search, schoolId, page, limit } = query;

    const qb = this.parentRepo
      .createQueryBuilder('parent')
      .innerJoinAndSelect('parent.user', 'user');

    if (schoolId) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM student_parents sp
          INNER JOIN students s ON s.id = sp."studentId"
          WHERE sp."parentId" = parent.id AND s."schoolId" = :schoolId
        )`,
        { schoolId },
      );
    }
    if (search) {
      qb.andWhere(
        "(user.firstName ILIKE :search OR user.lastName ILIKE :search OR CONCAT(user.firstName, ' ', user.lastName) ILIKE :search)",
        { search: `%${search}%` },
      );
    }

    const [parents, total] = await qb
      .orderBy('user.lastName', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const parentIds = parents.map((p) => p.id);
    const counts = parentIds.length
      ? await this.studentParentRepo
          .createQueryBuilder('sp')
          .select('sp.parentId', 'parentId')
          .addSelect('COUNT(DISTINCT sp.studentId)', 'count')
          .where('sp.parentId IN (:...parentIds)', { parentIds })
          .groupBy('sp.parentId')
          .getRawMany<{ parentId: string; count: string }>()
      : [];
    const childrenCountByParentId = new Map(
      counts.map((c) => [c.parentId, Number(c.count)]),
    );

    return {
      data: parents.map((p) => ({
        id: p.id,
        status: p.user.status,
        childrenCount: childrenCountByParentId.get(p.id) ?? 0,
        user: {
          id: p.user.id,
          firstName: p.user.firstName,
          lastName: p.user.lastName,
          phone: p.user.phone,
        },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findMe(userId: string): Promise<ParentResponseDto> {
    const parent = await this.parentRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!parent) throw new NotFoundException(ErrorMessages.PARENTS.NOT_FOUND);
    return this.toDto(parent);
  }

  async findOne(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<ParentResponseDto> {
    const parent = await this.parentRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!parent) throw new NotFoundException(ErrorMessages.PARENTS.NOT_FOUND);

    if (
      currentUser.role === UserRole.PARENT &&
      parent.userId !== currentUser.id
    ) {
      throw new ForbiddenException();
    }

    return this.toDto(parent);
  }

  async findStudents(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<ParentStudentResponseDto[]> {
    const parent = await this.parentRepo.findOne({ where: { id } });
    if (!parent) throw new NotFoundException(ErrorMessages.PARENTS.NOT_FOUND);

    if (
      currentUser.role === UserRole.PARENT &&
      parent.userId !== currentUser.id
    ) {
      throw new ForbiddenException();
    }

    const links = await this.studentParentRepo.find({
      where: { parentId: id },
      relations: ['student', 'student.user', 'student.card'],
    });

    const studentIds = links.map((link) => link.student.id);
    const wallets = studentIds.length
      ? await this.walletRepo.find({ where: { studentId: In(studentIds) } })
      : [];
    const balanceByStudentId = new Map(
      wallets.map((w) => [w.studentId, w.balance]),
    );

    return links.map((link) => ({
      id: link.student.id,
      class: link.student.class,
      schoolId: link.student.schoolId,
      balance: balanceByStudentId.get(link.student.id) ?? 0,
      user: {
        id: link.student.user.id,
        firstName: link.student.user.firstName,
        lastName: link.student.user.lastName,
      },
      card: link.student.card
        ? {
            code: link.student.card.code,
            dailyLimit: link.student.card.dailyLimit,
          }
        : null,
    }));
  }

  async updateProfile(
    userId: string,
    dto: UpdateParentProfileDto,
  ): Promise<ParentResponseDto> {
    const parent = await this.parentRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!parent) throw new NotFoundException(ErrorMessages.PARENTS.NOT_FOUND);

    if (dto.phone && dto.phone !== parent.user.phone) {
      const existing = await this.userRepo.findOne({
        where: { phone: dto.phone },
      });
      if (existing)
        throw new ConflictException(ErrorMessages.AUTH.PHONE_ALREADY_EXISTS);
    }

    if (dto.firstName !== undefined) parent.user.firstName = dto.firstName;
    if (dto.lastName !== undefined) parent.user.lastName = dto.lastName;
    if (dto.phone !== undefined) parent.user.phone = dto.phone;

    await this.userRepo.save(parent.user);
    return this.toDto(parent);
  }

  async block(id: string): Promise<ParentResponseDto> {
    const parent = await this.parentRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!parent) throw new NotFoundException(ErrorMessages.PARENTS.NOT_FOUND);

    if (parent.user.status !== UserStatus.VALIDATED) {
      throw new ConflictException(ErrorMessages.PARENTS.NOT_BLOCKABLE);
    }

    await this.userRepo.update(parent.userId, { status: UserStatus.BLOCKED });
    parent.user.status = UserStatus.BLOCKED;
    this.notificationsGateway.disconnectUser(parent.userId);
    return this.toDto(parent);
  }

  async unblock(id: string): Promise<ParentResponseDto> {
    const parent = await this.parentRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!parent) throw new NotFoundException(ErrorMessages.PARENTS.NOT_FOUND);

    if (parent.user.status !== UserStatus.BLOCKED) {
      throw new ConflictException(ErrorMessages.PARENTS.NOT_UNBLOCKABLE);
    }

    await this.userRepo.update(parent.userId, {
      status: UserStatus.VALIDATED,
    });
    parent.user.status = UserStatus.VALIDATED;
    return this.toDto(parent);
  }

  async addBeneficiary(
    userId: string,
    dto: AddBeneficiaryDto,
  ): Promise<{
    id: string;
    class: string;
    schoolId: string;
    user: { id: string; firstName: string; lastName: string };
  }> {
    const parent = await this.parentRepo.findOne({ where: { userId } });
    if (!parent) throw new NotFoundException(ErrorMessages.PARENTS.NOT_FOUND);

    const card = await this.cardRepo.findOne({ where: { code: dto.cardCode } });
    if (!card) throw new NotFoundException(ErrorMessages.CARDS.NOT_FOUND);

    if (
      card.status !== CardStatus.ACTIVE &&
      card.status !== CardStatus.UNASSIGNED
    ) {
      throw new ConflictException(ErrorMessages.AUTH.CARD_NOT_ACTIVE);
    }

    const existingStudent = await this.studentRepo.findOne({
      where: { cardId: card.id },
      relations: ['user'],
    });

    if (!existingStudent) {
      if (!dto.firstName || !dto.lastName) {
        throw new BadRequestException(
          ErrorMessages.AUTH.STUDENT_FIELDS_REQUIRED,
        );
      }
      if (!dto.pin) {
        throw new BadRequestException(ErrorMessages.CARDS.PIN_NOT_SET);
      }

      const student = await this.dataSource.transaction(async (manager) => {
        const newUser = await manager.save(User, {
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: UserRole.STUDENT,
          schoolId: card.schoolId,
          isOnboarded: false,
        });

        const newStudent = await manager.save(Student, {
          userId: newUser.id,
          cardId: card.id,
          schoolId: card.schoolId,
          class: dto.class,
        });

        const pinHash = await bcrypt.hash(dto.pin!, 10);
        await manager.update(Card, card.id, {
          status: CardStatus.ACTIVE,
          studentId: newStudent.id,
          pinHash,
        });

        await manager.save(Wallet, { studentId: newStudent.id });
        await manager.save(StudentParent, {
          parentId: parent.id,
          studentId: newStudent.id,
        });

        return { ...newStudent, user: newUser };
      });

      return {
        id: student.id,
        class: student.class,
        schoolId: student.schoolId,
        user: {
          id: student.user.id,
          firstName: student.user.firstName,
          lastName: student.user.lastName,
        },
      };
    }

    if (card.pinHash) {
      if (!dto.pin)
        throw new UnauthorizedException(ErrorMessages.CARDS.PIN_INVALID);
      // Same rule as signup: confirm the PIN already set by whoever
      // registered the card first, don't just reject the field.
      const isValid = await bcrypt.compare(dto.pin, card.pinHash);
      if (!isValid)
        throw new ConflictException(ErrorMessages.CARDS.PIN_MISMATCH);
    }

    const alreadyLinked = await this.studentParentRepo.findOne({
      where: { parentId: parent.id, studentId: existingStudent.id },
    });
    if (alreadyLinked)
      throw new ConflictException(ErrorMessages.AUTH.PARENT_ALREADY_LINKED);

    const parentCountOnStudent = await this.studentParentRepo.count({
      where: { studentId: existingStudent.id },
    });
    if (parentCountOnStudent >= 2)
      throw new ConflictException(
        ErrorMessages.AUTH.STUDENT_ALREADY_HAS_TWO_PARENTS,
      );

    await this.studentParentRepo.save({
      parentId: parent.id,
      studentId: existingStudent.id,
    });

    return {
      id: existingStudent.id,
      class: existingStudent.class,
      schoolId: existingStudent.schoolId,
      user: {
        id: existingStudent.user.id,
        firstName: existingStudent.user.firstName,
        lastName: existingStudent.user.lastName,
      },
    };
  }

  private toDto(parent: Parent): ParentResponseDto {
    return {
      id: parent.id,
      status: parent.user.status,
      user: {
        id: parent.user.id,
        firstName: parent.user.firstName,
        lastName: parent.user.lastName,
        phone: parent.user.phone,
      },
    };
  }
}
