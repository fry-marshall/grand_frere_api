import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Parent } from './entities/parent.entity';
import { User } from '../users/entities/user.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { UserRole } from '../users/user.types';
import { ParentResponseDto } from './dto/parent-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class ParentsService {
  constructor(
    @InjectRepository(Parent)
    private readonly parentRepo: Repository<Parent>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(StudentParent)
    private readonly studentParentRepo: Repository<StudentParent>,
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
      relations: ['student', 'student.user'],
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
    }));
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
