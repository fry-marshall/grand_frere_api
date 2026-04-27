import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Student } from './entities/student.entity';
import { StudentParent } from './entities/student-parent.entity';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { UserRole } from '../users/user.types';
import { StudentResponseDto } from './dto/student-response.dto';
import { StudentParentResponseDto } from './dto/student-parents-response.dto';
import { StudentOrderResponseDto } from './dto/student-order-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(StudentParent)
    private readonly studentParentRepo: Repository<StudentParent>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  async findAll(
    currentUser: { id: string; role: UserRole },
    query: PaginationQueryDto,
  ): Promise<{ data: StudentResponseDto[]; meta: object }> {
    const { page, limit } = query;

    const whereClause: Record<string, unknown> = {};
    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (!admin?.schoolId) throw new ForbiddenException();
      whereClause.schoolId = admin.schoolId;
    }

    const [students, total] = await this.studentRepo.findAndCount({
      where: whereClause,
      relations: ['user', 'card'],
      order: { user: { lastName: 'ASC' } },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: students.map((s) => this.toDto(s)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<StudentResponseDto> {
    const student = await this.studentRepo.findOne({
      where: { id },
      relations: ['user', 'card'],
    });
    if (!student) throw new NotFoundException(ErrorMessages.STUDENTS.NOT_FOUND);

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (admin?.schoolId !== student.schoolId) throw new ForbiddenException();
    }

    if (
      currentUser.role === UserRole.STUDENT &&
      student.userId !== currentUser.id
    ) {
      throw new ForbiddenException();
    }

    return this.toDto(student);
  }

  async findParents(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<StudentParentResponseDto[]> {
    const student = await this.studentRepo.findOne({ where: { id } });
    if (!student) throw new NotFoundException(ErrorMessages.STUDENTS.NOT_FOUND);

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (admin?.schoolId !== student.schoolId) throw new ForbiddenException();
    }

    if (
      currentUser.role === UserRole.STUDENT &&
      student.userId !== currentUser.id
    ) {
      throw new ForbiddenException();
    }

    const links = await this.studentParentRepo.find({
      where: { studentId: id },
      relations: ['parent', 'parent.user'],
    });

    return links.map((link) => ({
      id: link.parent.id,
      user: {
        id: link.parent.user.id,
        firstName: link.parent.user.firstName,
        lastName: link.parent.user.lastName,
        phone: link.parent.user.phone,
      },
    }));
  }

  async findOrders(
    id: string,
    currentUser: { id: string; role: UserRole },
    query: PaginationQueryDto,
  ): Promise<{ data: StudentOrderResponseDto[]; meta: object }> {
    const student = await this.studentRepo.findOne({ where: { id } });
    if (!student) throw new NotFoundException(ErrorMessages.STUDENTS.NOT_FOUND);

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (admin?.schoolId !== student.schoolId) throw new ForbiddenException();
    }

    if (
      currentUser.role === UserRole.STUDENT &&
      student.userId !== currentUser.id
    ) {
      throw new ForbiddenException();
    }

    const { page, limit } = query;
    const [orders, total] = await this.orderRepo.findAndCount({
      where: { studentId: id },
      relations: ['vendor'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: orders.map((o) => ({
        id: o.id,
        status: o.status,
        totalAmount: o.totalAmount,
        expiresAt: o.expiresAt,
        createdAt: o.createdAt,
        vendor: {
          id: o.vendor.id,
          shopName: o.vendor.shopName,
        },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private toDto(student: Student): StudentResponseDto {
    return {
      id: student.id,
      class: student.class,
      schoolId: student.schoolId,
      user: {
        id: student.user.id,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        phone: student.user.phone,
      },
      card: student.card
        ? { id: student.card.id, code: student.card.code }
        : null,
    };
  }
}
