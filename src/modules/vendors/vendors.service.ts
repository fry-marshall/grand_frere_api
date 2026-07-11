import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IStorageService } from '../../common/storage/storage.interface';
import { STORAGE_SERVICE } from '../../common/storage/storage.interface';
import { User } from '../users/entities/user.entity';
import { Vendor } from './entities/vendor.entity';
import { Order } from '../orders/entities/order.entity';
import { Withdrawal } from '../withdrawals/entities/withdrawal.entity';
import { VendorWallet } from './entities/vendor-wallet.entity';
import { Item } from '../items/entities/item.entity';
import { Student } from '../students/entities/student.entity';
import { Parent } from '../parents/entities/parent.entity';
import { VendorStatus } from './vendor.types';
import { OrderStatus, PaymentMethod } from '../orders/order.types';
import { ItemStatus } from '../items/item.types';
import { UserRole } from '../users/user.types';
import { VendorResponseDto } from './dto/vendor-response.dto';
import { VendorOrderResponseDto } from './dto/vendor-order-response.dto';
import { VendorWithdrawalResponseDto } from './dto/vendor-withdrawal-response.dto';
import { VendorBalanceResponseDto } from './dto/vendor-balance-response.dto';
import { VendorStatsResponseDto } from './dto/vendor-stats-response.dto';
import { ItemResponseDto } from '../items/dto/item-response.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.types';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);

  constructor(
    @InjectRepository(Vendor) private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepo: Repository<Withdrawal>,
    @InjectRepository(VendorWallet)
    private readonly vendorWalletRepo: Repository<VendorWallet>,
    @InjectRepository(Item) private readonly itemRepo: Repository<Item>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Parent)
    private readonly parentRepo: Repository<Parent>,
    private readonly notificationsService: NotificationsService,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
  ) {}

  async findAll(
    currentUser: { id: string; role: UserRole },
    query: PaginationQueryDto,
  ): Promise<{ data: VendorResponseDto[]; meta: object }> {
    const { page, limit } = query;

    const whereClause: Record<string, unknown> = {};
    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (!admin?.schoolId) throw new ForbiddenException();
      whereClause.schoolId = admin.schoolId;
    }

    const [vendors, total] = await this.vendorRepo.findAndCount({
      where: whereClause,
      relations: ['user'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: vendors.map((v) => this.toDto(v)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findMe(userId: string): Promise<VendorResponseDto> {
    const vendor = await this.vendorRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!vendor) throw new NotFoundException(ErrorMessages.VENDORS.NOT_FOUND);
    return this.toDto(vendor);
  }

  async findOne(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<VendorResponseDto> {
    const vendor = await this.vendorRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!vendor) throw new NotFoundException(ErrorMessages.VENDORS.NOT_FOUND);

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (admin?.schoolId !== vendor.schoolId) throw new ForbiddenException();
    }

    if (
      currentUser.role === UserRole.VENDOR &&
      vendor.userId !== currentUser.id
    ) {
      throw new ForbiddenException();
    }

    return this.toDto(vendor);
  }

  async update(
    id: string,
    dto: UpdateVendorDto,
    currentUser: { id: string; role: UserRole },
  ): Promise<VendorResponseDto> {
    const vendor = await this.vendorRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!vendor) throw new NotFoundException(ErrorMessages.VENDORS.NOT_FOUND);

    if (
      currentUser.role === UserRole.VENDOR &&
      vendor.userId !== currentUser.id
    ) {
      throw new ForbiddenException();
    }

    await this.vendorRepo.update(id, dto);
    return this.toDto({ ...vendor, ...dto });
  }

  async remove(id: string): Promise<void> {
    const vendor = await this.vendorRepo.findOne({ where: { id } });
    if (!vendor) throw new NotFoundException(ErrorMessages.VENDORS.NOT_FOUND);
    await this.vendorRepo.delete(id);
  }

  async findOrders(
    id: string,
    currentUser: { id: string; role: UserRole },
    query: PaginationQueryDto,
  ): Promise<{ data: VendorOrderResponseDto[]; meta: object }> {
    const vendor = await this.vendorRepo.findOne({ where: { id } });
    if (!vendor) throw new NotFoundException(ErrorMessages.VENDORS.NOT_FOUND);

    if (
      currentUser.role === UserRole.VENDOR &&
      vendor.userId !== currentUser.id
    ) {
      throw new ForbiddenException();
    }
    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (admin?.schoolId !== vendor.schoolId) throw new ForbiddenException();
    }

    const { page, limit } = query;
    const [orders, total] = await this.orderRepo.findAndCount({
      where: { vendorId: id },
      relations: ['student', 'student.user', 'items', 'items.item'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: orders.map((o) => ({
        id: o.id,
        status: o.status,
        paymentMethod: o.paymentMethod,
        totalAmount: o.totalAmount,
        scheduledFor: o.scheduledFor,
        expiresAt: o.expiresAt,
        createdAt: o.createdAt,
        shortCode: o.shortCode ?? null,
        items: o.items.map((i) => ({
          name: i.item?.name ?? '',
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        student: {
          id: o.student.id,
          class: o.student.class,
          user: {
            id: o.student.user.id,
            firstName: o.student.user.firstName,
            lastName: o.student.user.lastName,
          },
        },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findWithdrawals(
    id: string,
    currentUser: { id: string; role: UserRole },
    query: PaginationQueryDto,
  ): Promise<{ data: VendorWithdrawalResponseDto[]; meta: object }> {
    const vendor = await this.vendorRepo.findOne({ where: { id } });
    if (!vendor) throw new NotFoundException(ErrorMessages.VENDORS.NOT_FOUND);

    if (
      currentUser.role === UserRole.VENDOR &&
      vendor.userId !== currentUser.id
    ) {
      throw new ForbiddenException();
    }
    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (admin?.schoolId !== vendor.schoolId) throw new ForbiddenException();
    }

    const { page, limit } = query;
    const [withdrawals, total] = await this.withdrawalRepo.findAndCount({
      where: { vendorId: id },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: withdrawals.map((w) => ({
        id: w.id,
        status: w.status,
        amount: w.amount,
        currency: w.currency,
        waveNumber: w.waveNumber,
        paystackRef: w.paystackRef,
        createdAt: w.createdAt,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findBalance(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<VendorBalanceResponseDto> {
    const vendor = await this.vendorRepo.findOne({ where: { id } });
    if (!vendor) throw new NotFoundException(ErrorMessages.VENDORS.NOT_FOUND);

    if (
      currentUser.role === UserRole.VENDOR &&
      vendor.userId !== currentUser.id
    ) {
      throw new ForbiddenException();
    }
    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (admin?.schoolId !== vendor.schoolId) throw new ForbiddenException();
    }

    const wallet = await this.vendorWalletRepo.findOne({
      where: { vendorId: id },
    });
    if (!wallet)
      throw new NotFoundException(ErrorMessages.VENDORS.WALLET_NOT_FOUND);

    return {
      vendorId: wallet.vendorId,
      balance: wallet.balance,
      currency: wallet.currency,
      updatedAt: wallet.updatedAt,
    };
  }

  async findItems(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<ItemResponseDto[]> {
    const vendor = await this.vendorRepo.findOne({ where: { id } });
    if (!vendor) throw new NotFoundException(ErrorMessages.VENDORS.NOT_FOUND);

    if (
      currentUser.role === UserRole.VENDOR &&
      vendor.userId !== currentUser.id
    ) {
      throw new ForbiddenException();
    }

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (admin?.schoolId !== vendor.schoolId) throw new ForbiddenException();
    }

    if (currentUser.role === UserRole.STUDENT) {
      const student = await this.studentRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (student?.schoolId !== vendor.schoolId) throw new ForbiddenException();
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
          schoolId: vendor.schoolId,
        })
        .getOne();
      if (!studentInSchool) throw new ForbiddenException();
    }

    const items = await this.itemRepo.find({
      where: { vendorId: id, status: ItemStatus.ACTIVE },
      order: { createdAt: 'ASC' },
    });

    return items.map((i) => ({
      id: i.id,
      vendorId: i.vendorId,
      name: i.name,
      price: i.price,
      description: i.description,
      imageUrl: i.imageUrl,
      status: i.status,
      createdAt: i.createdAt,
    }));
  }

  async findStats(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<VendorStatsResponseDto> {
    const vendor = await this.vendorRepo.findOne({ where: { id } });
    if (!vendor) throw new NotFoundException(ErrorMessages.VENDORS.NOT_FOUND);

    if (
      currentUser.role === UserRole.VENDOR &&
      vendor.userId !== currentUser.id
    )
      throw new ForbiddenException();

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (admin?.schoolId !== vendor.schoolId) throw new ForbiddenException();
    }

    const today = new Date().toISOString().slice(0, 10);

    const countRow = await this.orderRepo
      .createQueryBuilder('o')
      .select('COUNT(*)', 'count')
      .where('o.vendorId = :id', { id })
      .andWhere('o.scheduledFor = :today', { today })
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: [OrderStatus.CANCELLED, OrderStatus.EXPIRED],
      })
      .getRawOne<{ count: string }>();

    const revenueRow = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.totalAmount), 0)', 'sum')
      .where('o.vendorId = :id', { id })
      .andWhere('o.scheduledFor = :today', { today })
      .andWhere('o.status = :status', { status: OrderStatus.COMPLETED })
      .getRawOne<{ sum: string }>();

    const cashRow = await this.orderRepo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.totalAmount), 0)', 'sum')
      .where('o.vendorId = :id', { id })
      .andWhere('o.scheduledFor = :today', { today })
      .andWhere('o.status = :status', { status: OrderStatus.VALIDATED })
      .andWhere('o.paymentMethod = :method', { method: PaymentMethod.CASH })
      .getRawOne<{ sum: string }>();

    return {
      todayOrderCount: parseInt(countRow?.count ?? '0', 10),
      todayRevenue: parseInt(revenueRow?.sum ?? '0', 10),
      cashToCollect: parseInt(cashRow?.sum ?? '0', 10),
    };
  }

  async updatePhoto(
    id: string,
    file: Express.Multer.File,
    currentUser: { id: string; role: UserRole },
  ): Promise<VendorResponseDto> {
    const vendor = await this.vendorRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!vendor) throw new NotFoundException(ErrorMessages.VENDORS.NOT_FOUND);

    if (
      currentUser.role === UserRole.VENDOR &&
      vendor.userId !== currentUser.id
    ) {
      throw new ForbiddenException();
    }

    if (vendor.photoUrl) {
      const oldKey = vendor.photoUrl.split('/').slice(-2).join('/');
      await this.storageService.deleteFile(oldKey).catch(() => undefined);
    }

    const ext = file.mimetype.split('/')[1];
    const key = `vendors/${id}/${Date.now()}.${ext}`;
    const photoUrl = await this.storageService.uploadBuffer(
      file.buffer,
      key,
      file.mimetype,
    );

    await this.vendorRepo.update(id, { photoUrl });
    return this.toDto({ ...vendor, photoUrl });
  }

  async approve(id: string): Promise<VendorResponseDto> {
    const vendor = await this.vendorRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!vendor) throw new NotFoundException(ErrorMessages.VENDORS.NOT_FOUND);

    if (vendor.status !== VendorStatus.PENDING) {
      throw new ConflictException(ErrorMessages.VENDORS.NOT_APPROVABLE);
    }

    await this.vendorRepo.update(id, { status: VendorStatus.ACTIVE });
    vendor.status = VendorStatus.ACTIVE;

    this.notificationsService
      .createNotification(NotificationType.VENDOR_APPROVED, vendor.userId, {
        title: 'Compte vendeur approuvé',
        body: `Votre boutique "${vendor.shopName}" a été approuvée. Vous pouvez maintenant recevoir des commandes.`,
      })
      .catch((err) =>
        this.logger.error(`Notification failed for vendor ${id}`, err.stack),
      );

    return this.toDto(vendor);
  }

  async reject(id: string): Promise<VendorResponseDto> {
    const vendor = await this.vendorRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!vendor) throw new NotFoundException(ErrorMessages.VENDORS.NOT_FOUND);

    if (vendor.status !== VendorStatus.PENDING) {
      throw new ConflictException(ErrorMessages.VENDORS.NOT_REJECTABLE);
    }

    await this.vendorRepo.update(id, { status: VendorStatus.REJECTED });
    vendor.status = VendorStatus.REJECTED;

    this.notificationsService
      .createNotification(NotificationType.VENDOR_REJECTED, vendor.userId, {
        title: 'Compte vendeur rejeté',
        body: `Votre demande pour la boutique "${vendor.shopName}" a été rejetée.`,
      })
      .catch((err) =>
        this.logger.error(`Notification failed for vendor ${id}`, err.stack),
      );

    return this.toDto(vendor);
  }

  private toDto(vendor: Vendor): VendorResponseDto {
    return {
      id: vendor.id,
      shopName: vendor.shopName,
      waveNumber: vendor.waveNumber,
      openingTime: vendor.openingTime,
      closingTime: vendor.closingTime,
      photoUrl: vendor.photoUrl,
      status: vendor.status,
      schoolId: vendor.schoolId,
      createdAt: vendor.createdAt,
      user: {
        id: vendor.user.id,
        firstName: vendor.user.firstName,
        lastName: vendor.user.lastName,
        phone: vendor.user.phone,
      },
    };
  }
}
