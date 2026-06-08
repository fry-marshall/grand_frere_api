import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Parent } from './entities/parent.entity';
import { User } from '../users/entities/user.entity';
import { Student } from '../students/entities/student.entity';
import { Card } from '../cards/entities/card.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { UserRole } from '../users/user.types';
import { ParentResponseDto } from './dto/parent-response.dto';
import { UpdateParentProfileDto } from './dto/update-parent-profile.dto';
import { AddBeneficiaryDto } from './dto/add-beneficiary.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ErrorMessages } from '../../common/swagger/error-messages';

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
  ) {}

  async findAll(
    currentUser: { id: string; role: UserRole },
    query: PaginationQueryDto,
  ): Promise<{ data: ParentResponseDto[]; meta: object }> {
    const { page, limit } = query;

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (!admin?.schoolId) throw new ForbiddenException();

      const [parents, total] = await this.parentRepo
        .createQueryBuilder('p')
        .innerJoinAndSelect('p.user', 'u')
        .innerJoin('p.studentParents', 'sp')
        .innerJoin('sp.student', 's')
        .where('s.schoolId = :schoolId', { schoolId: admin.schoolId })
        .distinct(true)
        .orderBy('u.lastName', 'ASC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      return {
        data: parents.map((p) => this.toDto(p)),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    const [parents, total] = await this.parentRepo.findAndCount({
      relations: ['user'],
      order: { user: { lastName: 'ASC' } },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: parents.map((p) => this.toDto(p)),
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

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      const linked = await this.studentParentRepo
        .createQueryBuilder('sp')
        .innerJoin('sp.student', 's')
        .where('sp.parentId = :parentId', { parentId: id })
        .andWhere('s.schoolId = :schoolId', { schoolId: admin?.schoolId })
        .getOne();
      if (!linked) throw new ForbiddenException();
    }

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
  ): Promise<
    {
      id: string;
      class: string;
      schoolId: string;
      user: { id: string; firstName: string; lastName: string };
    }[]
  > {
    const parent = await this.parentRepo.findOne({ where: { id } });
    if (!parent) throw new NotFoundException(ErrorMessages.PARENTS.NOT_FOUND);

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      const linked = await this.studentParentRepo
        .createQueryBuilder('sp')
        .innerJoin('sp.student', 's')
        .where('sp.parentId = :parentId', { parentId: id })
        .andWhere('s.schoolId = :schoolId', { schoolId: admin?.schoolId })
        .getOne();
      if (!linked) throw new ForbiddenException();
    }

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

    return links.map((link) => ({
      id: link.student.id,
      class: link.student.class,
      schoolId: link.student.schoolId,
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
          class: dto.class ?? null,
        });

        await manager.update(Card, card.id, { studentId: newStudent.id });
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
      user: {
        id: parent.user.id,
        firstName: parent.user.firstName,
        lastName: parent.user.lastName,
        phone: parent.user.phone,
      },
    };
  }
}
