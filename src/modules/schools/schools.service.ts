import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../wallets/entities/transaction.entity';
import { TransactionType } from '../wallets/wallet.types';
import * as bcrypt from 'bcrypt';
import { School } from './entities/school.entity';
import { User } from '../users/entities/user.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { Student } from '../students/entities/student.entity';
import { Parent } from '../parents/entities/parent.entity';
import { SchoolStatus } from './school.types';
import { VendorStatus } from '../vendors/vendor.types';
import { UserRole } from '../users/user.types';
import { CreateSchoolDto } from './dto/create-school.dto';
import { CreateSchoolAdminDto } from './dto/create-school-admin.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolResponseDto } from './dto/school-response.dto';
import { SchoolAdminResponseDto } from './dto/school-admin-response.dto';
import { SchoolVendorResponseDto } from './dto/school-vendor-response.dto';
import { SchoolStudentResponseDto } from './dto/school-student-response.dto';
import { SchoolParentResponseDto } from './dto/school-parent-response.dto';
import { SchoolTransactionResponseDto } from './dto/school-transaction-response.dto';
import { SchoolTransactionsQueryDto } from './dto/school-transactions-query.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ErrorMessages } from '../../common/swagger/error-messages';
import type { IStorageService } from '../../common/storage/storage.interface';
import { STORAGE_SERVICE } from '../../common/storage/storage.interface';

@Injectable()
export class SchoolsService {
  constructor(
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Vendor) private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Parent)
    private readonly parentRepo: Repository<Parent>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @Inject(STORAGE_SERVICE) private readonly storageService: IStorageService,
  ) {}

  async create(dto: CreateSchoolDto): Promise<SchoolResponseDto> {
    const exists = await this.schoolRepo.existsBy({ sigle: dto.sigle });
    if (exists)
      throw new ConflictException(ErrorMessages.SCHOOLS.SIGLE_ALREADY_EXISTS);

    const school = await this.schoolRepo.save({
      name: dto.name,
      sigle: dto.sigle,
      address: dto.address,
      status: SchoolStatus.ACTIVE,
    });

    return this.toDto(school);
  }

  async createAdmin(
    schoolId: string,
    dto: CreateSchoolAdminDto,
  ): Promise<SchoolAdminResponseDto> {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

    const phoneExists = await this.userRepo.existsBy({ phone: dto.phone });
    if (phoneExists)
      throw new ConflictException(ErrorMessages.AUTH.PHONE_ALREADY_EXISTS);

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepo.save({
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      passwordHash,
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });

    return this.toAdminDto(user);
  }

  async findAll(): Promise<SchoolResponseDto[]> {
    const schools = await this.schoolRepo.find({
      order: { createdAt: 'DESC' },
    });
    return schools.map((s) => this.toDto(s));
  }

  async findOne(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<SchoolResponseDto> {
    const school = await this.schoolRepo.findOne({ where: { id } });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (admin?.schoolId !== school.id) throw new ForbiddenException();
    }

    return this.toDto(school);
  }

  async update(id: string, dto: UpdateSchoolDto): Promise<SchoolResponseDto> {
    const school = await this.schoolRepo.findOne({ where: { id } });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

    await this.schoolRepo.update(id, dto);
    return this.toDto({ ...school, ...dto });
  }

  async suspend(id: string): Promise<SchoolResponseDto> {
    const school = await this.schoolRepo.findOne({ where: { id } });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

    if (school.status !== SchoolStatus.ACTIVE) {
      throw new ConflictException(ErrorMessages.SCHOOLS.NOT_SUSPENDABLE);
    }

    await this.schoolRepo.update(id, { status: SchoolStatus.SUSPENDED });
    return this.toDto({ ...school, status: SchoolStatus.SUSPENDED });
  }

  async activate(id: string): Promise<SchoolResponseDto> {
    const school = await this.schoolRepo.findOne({ where: { id } });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

    if (school.status !== SchoolStatus.SUSPENDED) {
      throw new ConflictException(ErrorMessages.SCHOOLS.NOT_ACTIVATABLE);
    }

    await this.schoolRepo.update(id, { status: SchoolStatus.ACTIVE });
    return this.toDto({ ...school, status: SchoolStatus.ACTIVE });
  }

  async findVendors(
    id: string,
    currentUser: { id: string; role: UserRole },
    query: PaginationQueryDto,
  ): Promise<{ data: SchoolVendorResponseDto[]; meta: object }> {
    const school = await this.schoolRepo.findOne({ where: { id } });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (admin?.schoolId !== school.id) throw new ForbiddenException();
    }

    if (currentUser.role === UserRole.STUDENT) {
      const student = await this.studentRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (student?.schoolId !== id) throw new ForbiddenException();
    }

    if (currentUser.role === UserRole.PARENT) {
      const parent = await this.parentRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (!parent) throw new ForbiddenException();
      const studentInSchool = await this.studentRepo
        .createQueryBuilder('s')
        .innerJoin('student_parents', 'sp', 'sp.studentId = s.id')
        .where('sp.parentId = :parentId AND s.schoolId = :schoolId', {
          parentId: parent.id,
          schoolId: id,
        })
        .getOne();
      if (!studentInSchool) throw new ForbiddenException();
    }

    const isPublicRole =
      currentUser.role === UserRole.STUDENT ||
      currentUser.role === UserRole.PARENT;

    const { page, limit } = query;
    const [vendors, total] = await this.vendorRepo.findAndCount({
      where: {
        schoolId: id,
        ...(isPublicRole ? { status: VendorStatus.ACTIVE } : {}),
      },
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: vendors.map((v) => ({
        id: v.id,
        shopName: v.shopName,
        waveNumber: v.waveNumber,
        photoUrl: v.photoUrl
          ? this.storageService.getPublicUrl(`vendors/${v.id}/${v.photoUrl}`)
          : v.photoUrl,
        status: v.status,
        createdAt: v.createdAt,
        user: {
          id: v.user.id,
          firstName: v.user.firstName,
          lastName: v.user.lastName,
          phone: v.user.phone,
        },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findStudents(
    id: string,
    currentUser: { id: string; role: UserRole },
    query: PaginationQueryDto,
  ): Promise<{ data: SchoolStudentResponseDto[]; meta: object }> {
    const school = await this.schoolRepo.findOne({ where: { id } });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (admin?.schoolId !== school.id) throw new ForbiddenException();
    }

    const { page, limit } = query;
    const [students, total] = await this.studentRepo.findAndCount({
      where: { schoolId: id },
      relations: ['user'],
      order: { user: { lastName: 'ASC' } },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: students.map((s) => ({
        id: s.id,
        class: s.class,
        cardId: s.cardId,
        user: {
          id: s.user.id,
          firstName: s.user.firstName,
          lastName: s.user.lastName,
          phone: s.user.phone,
        },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findParents(
    id: string,
    currentUser: { id: string; role: UserRole },
    query: PaginationQueryDto,
  ): Promise<{ data: SchoolParentResponseDto[]; meta: object }> {
    const school = await this.schoolRepo.findOne({ where: { id } });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (admin?.schoolId !== school.id) throw new ForbiddenException();
    }

    const { page, limit } = query;
    const [parents, total] = await this.parentRepo
      .createQueryBuilder('parent')
      .innerJoinAndSelect('parent.user', 'user')
      .innerJoin('student_parents', 'sp', 'sp.parentId = parent.id')
      .innerJoin(
        'students',
        's',
        's.id = sp.studentId AND s.schoolId = :schoolId',
        { schoolId: id },
      )
      .distinct(true)
      .orderBy('user.lastName', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: parents.map((p) => ({
        id: p.id,
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

  async findTransactions(
    id: string,
    currentUser: { id: string; role: UserRole },
    query: SchoolTransactionsQueryDto,
  ): Promise<{
    transactions: { data: SchoolTransactionResponseDto[]; meta: object };
    stats: object;
  }> {
    const school = await this.schoolRepo.findOne({ where: { id } });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (admin?.schoolId !== school.id) throw new ForbiddenException();
    }

    const { page, limit, from, to } = query;

    const listQb = this.transactionRepo
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.wallet', 'w')
      .innerJoinAndSelect('w.student', 's')
      .innerJoinAndSelect('s.user', 'u')
      .where('s.schoolId = :schoolId', { schoolId: id });

    const statsQb = this.transactionRepo
      .createQueryBuilder('t')
      .innerJoin('t.wallet', 'w')
      .innerJoin('w.student', 's')
      .where('s.schoolId = :schoolId', { schoolId: id });

    if (from) {
      listQb.andWhere('t.createdAt >= :from', { from });
      statsQb.andWhere('t.createdAt >= :from', { from });
    }
    if (to) {
      listQb.andWhere('t.createdAt <= :to', { to });
      statsQb.andWhere('t.createdAt <= :to', { to });
    }

    const [transactions, total] = await listQb
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const statsRaw = await statsQb
      .select('COUNT(t.id)', 'totalTransactions')
      .addSelect(
        `SUM(CASE WHEN t.type = '${TransactionType.CREDIT}' THEN t.amount ELSE 0 END)`,
        'totalCredits',
      )
      .addSelect(
        `SUM(CASE WHEN t.type = '${TransactionType.DEBIT}' THEN t.amount ELSE 0 END)`,
        'totalDebits',
      )
      .getRawOne();

    return {
      transactions: {
        data: transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          currency: t.currency,
          balanceBefore: t.balanceBefore,
          balanceAfter: t.balanceAfter,
          orderId: t.orderId,
          paymentId: t.paymentId,
          createdAt: t.createdAt,
          student: {
            id: t.wallet.student.id,
            class: t.wallet.student.class,
            user: {
              id: t.wallet.student.user.id,
              firstName: t.wallet.student.user.firstName,
              lastName: t.wallet.student.user.lastName,
            },
          },
        })),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
      stats: {
        totalTransactions: Number(statsRaw.totalTransactions),
        totalCredits: Number(statsRaw.totalCredits) || 0,
        totalDebits: Number(statsRaw.totalDebits) || 0,
      },
    };
  }

  private toDto(school: School): SchoolResponseDto {
    return {
      id: school.id,
      name: school.name,
      sigle: school.sigle,
      address: school.address,
      status: school.status,
      createdAt: school.createdAt,
    };
  }

  private toAdminDto(user: User): SchoolAdminResponseDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      schoolId: user.schoolId,
      createdAt: user.createdAt,
    };
  }
}
