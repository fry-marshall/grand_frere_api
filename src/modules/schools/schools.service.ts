import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Transaction } from '../wallets/entities/transaction.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { TransactionType } from '../wallets/wallet.types';
import * as bcrypt from 'bcrypt';
import { School } from './entities/school.entity';
import { User } from '../users/entities/user.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { Student } from '../students/entities/student.entity';
import { Parent } from '../parents/entities/parent.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/order.types';
import { SchoolStatus } from './school.types';
import { VendorStatus } from '../vendors/vendor.types';
import { UserRole, UserStatus } from '../users/user.types';
import { CreateSchoolDto } from './dto/create-school.dto';
import { CreateSchoolAdminDto } from './dto/create-school-admin.dto';
import { SchoolsSearchQueryDto } from './dto/schools-search-query.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolResponseDto } from './dto/school-response.dto';
import { SchoolAdminResponseDto } from './dto/school-admin-response.dto';
import { SchoolVendorResponseDto } from './dto/school-vendor-response.dto';
import { SchoolStudentResponseDto } from './dto/school-student-response.dto';
import { SchoolParentResponseDto } from './dto/school-parent-response.dto';
import { SchoolTransactionResponseDto } from './dto/school-transaction-response.dto';
import { SchoolTransactionsQueryDto } from './dto/school-transactions-query.dto';
import { StatsQueryDto } from './dto/stats-query.dto';
import { NetworkStatsResponseDto } from './dto/network-stats-response.dto';
import { SchoolStatsResponseDto } from './dto/school-stats-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ErrorMessages } from '../../common/swagger/error-messages';
import { generateRandomPassword } from '../../common/utils/generate-password.util';
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
    @InjectRepository(StudentParent)
    private readonly studentParentRepo: Repository<StudentParent>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Wallet) private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
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

    const password = generateRandomPassword();
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.userRepo.save({
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
      passwordHash,
      role: UserRole.SCHOOL_ADMIN,
      schoolId: school.id,
      isOnboarded: true,
    });

    return { ...this.toAdminDto(user), password };
  }

  async findAll(): Promise<SchoolResponseDto[]> {
    const schools = await this.schoolRepo.find({
      order: { createdAt: 'DESC' },
    });
    return schools.map((s) => this.toDto(s));
  }

  async search(
    query: SchoolsSearchQueryDto,
  ): Promise<{ data: SchoolResponseDto[]; meta: object }> {
    const { search, status, page, limit } = query;

    const qb = this.schoolRepo.createQueryBuilder('school');
    if (search) {
      qb.andWhere('(school.name ILIKE :search OR school.sigle ILIKE :search)', {
        search: `%${search}%`,
      });
    }
    if (status) {
      qb.andWhere('school.status = :status', { status });
    }

    const [schools, total] = await qb
      .orderBy('school.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: schools.map((s) => this.toDto(s)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<SchoolResponseDto> {
    const school = await this.schoolRepo.findOne({ where: { id } });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

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

  async findAdmins(
    id: string,
    query: PaginationQueryDto,
  ): Promise<{ data: SchoolAdminResponseDto[]; meta: object }> {
    const school = await this.schoolRepo.findOne({ where: { id } });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

    const { page, limit } = query;
    const [admins, total] = await this.userRepo.findAndCount({
      where: { schoolId: id, role: UserRole.SCHOOL_ADMIN },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: admins.map((a) => this.toAdminDto(a)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findVendors(
    id: string,
    currentUser: { id: string; role: UserRole },
    query: PaginationQueryDto,
  ): Promise<{ data: SchoolVendorResponseDto[]; meta: object }> {
    const school = await this.schoolRepo.findOne({ where: { id } });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

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
        openingTime: v.openingTime,
        closingTime: v.closingTime,
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
    query: PaginationQueryDto,
  ): Promise<{ data: SchoolStudentResponseDto[]; meta: object }> {
    const school = await this.schoolRepo.findOne({ where: { id } });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

    const { page, limit } = query;
    const [students, total] = await this.studentRepo.findAndCount({
      where: { schoolId: id },
      relations: ['user', 'card'],
      order: { user: { lastName: 'ASC' } },
      skip: (page - 1) * limit,
      take: limit,
    });

    const studentIds = students.map((s) => s.id);
    const wallets = studentIds.length
      ? await this.walletRepo.find({ where: { studentId: In(studentIds) } })
      : [];
    const balanceByStudentId = new Map(
      wallets.map((w) => [w.studentId, w.balance]),
    );

    return {
      data: students.map((s) => ({
        id: s.id,
        class: s.class,
        cardId: s.cardId,
        cardCode: s.card?.code ?? null,
        cardStatus: s.card?.status ?? null,
        balance: balanceByStudentId.get(s.id) ?? 0,
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
    query: PaginationQueryDto,
  ): Promise<{ data: SchoolParentResponseDto[]; meta: object }> {
    const school = await this.schoolRepo.findOne({ where: { id } });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

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

    const parentIds = parents.map((p) => p.id);
    const counts = parentIds.length
      ? await this.studentParentRepo
          .createQueryBuilder('sp')
          .innerJoin(
            'students',
            's',
            's.id = sp.studentId AND s.schoolId = :schoolId',
            { schoolId: id },
          )
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

  async getNetworkStats(
    query: StatsQueryDto,
  ): Promise<NetworkStatsResponseDto> {
    const { from, to } = query;

    const buildBaseQb = () => {
      const qb = this.orderRepo
        .createQueryBuilder('o')
        .innerJoin('o.student', 's')
        .where('o.status = :status', { status: OrderStatus.COMPLETED });
      if (from) qb.andWhere('o.createdAt >= :from', { from });
      if (to) qb.andWhere('o.createdAt <= :to', { to });
      return qb;
    };

    const totalsRaw = await buildBaseQb()
      .select('COALESCE(SUM(o.totalAmount), 0)', 'revenue')
      .addSelect('COUNT(o.id)', 'volume')
      .getRawOne<{ revenue: string; volume: string }>();

    const perSchoolRaw = await buildBaseQb()
      .select('s.schoolId', 'schoolId')
      .addSelect('COALESCE(SUM(o.totalAmount), 0)', 'revenue')
      .addSelect('COUNT(o.id)', 'volume')
      .groupBy('s.schoolId')
      .getRawMany<{ schoolId: string; revenue: string; volume: string }>();

    const perSchoolMap = new Map(
      perSchoolRaw.map((r) => [
        r.schoolId,
        { revenue: Number(r.revenue) || 0, volume: Number(r.volume) || 0 },
      ]),
    );

    const activeStudentsCount = await this.studentRepo
      .createQueryBuilder('s')
      .innerJoin('s.user', 'u')
      .where('u.status = :status', { status: UserStatus.VALIDATED })
      .getCount();

    const schools = await this.schoolRepo.find({ order: { name: 'ASC' } });

    return {
      totalRevenue: Number(totalsRaw?.revenue) || 0,
      orderVolume: Number(totalsRaw?.volume) || 0,
      activeStudentsCount,
      schools: schools.map((sc) => ({
        schoolId: sc.id,
        name: sc.name,
        sigle: sc.sigle,
        revenue: perSchoolMap.get(sc.id)?.revenue ?? 0,
        volume: perSchoolMap.get(sc.id)?.volume ?? 0,
      })),
    };
  }

  async getSchoolStats(
    id: string,
    currentUser: { id: string; role: UserRole },
    query: StatsQueryDto,
  ): Promise<SchoolStatsResponseDto> {
    const school = await this.schoolRepo.findOne({ where: { id } });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (admin?.schoolId !== id) throw new ForbiddenException();
    }

    const { from, to } = query;

    const statsQb = this.orderRepo
      .createQueryBuilder('o')
      .innerJoin('o.student', 's')
      .where('s.schoolId = :schoolId', { schoolId: id })
      .andWhere('o.status = :status', { status: OrderStatus.COMPLETED });
    if (from) statsQb.andWhere('o.createdAt >= :from', { from });
    if (to) statsQb.andWhere('o.createdAt <= :to', { to });

    const statsRaw = await statsQb
      .select('COALESCE(SUM(o.totalAmount), 0)', 'revenue')
      .addSelect('COUNT(o.id)', 'volume')
      .getRawOne<{ revenue: string; volume: string }>();

    const [studentsCount, vendorsCount, parentsCount] = await Promise.all([
      this.studentRepo.count({ where: { schoolId: id } }),
      this.vendorRepo.count({ where: { schoolId: id } }),
      this.parentRepo
        .createQueryBuilder('parent')
        .innerJoin('student_parents', 'sp', 'sp.parentId = parent.id')
        .innerJoin(
          'students',
          's',
          's.id = sp.studentId AND s.schoolId = :schoolId',
          { schoolId: id },
        )
        .distinct(true)
        .getCount(),
    ]);

    return {
      schoolId: id,
      revenue: Number(statsRaw?.revenue) || 0,
      volume: Number(statsRaw?.volume) || 0,
      studentsCount,
      vendorsCount,
      parentsCount,
    };
  }

  async findTransactions(
    id: string,
    query: SchoolTransactionsQueryDto,
  ): Promise<{
    transactions: { data: SchoolTransactionResponseDto[]; meta: object };
    stats: object;
  }> {
    const school = await this.schoolRepo.findOne({ where: { id } });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);

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
