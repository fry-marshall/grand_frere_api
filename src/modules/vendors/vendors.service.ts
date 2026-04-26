import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Vendor } from './entities/vendor.entity';
import { Order } from '../orders/entities/order.entity';
import { Withdrawal } from '../withdrawals/entities/withdrawal.entity';
import { VendorWallet } from './entities/vendor-wallet.entity';
import { VendorStatus } from './vendor.types';
import { UserRole } from '../users/user.types';
import { VendorResponseDto } from './dto/vendor-response.dto';
import { VendorOrderResponseDto } from './dto/vendor-order-response.dto';
import { VendorWithdrawalResponseDto } from './dto/vendor-withdrawal-response.dto';
import { VendorBalanceResponseDto } from './dto/vendor-balance-response.dto';
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
    private readonly notificationsService: NotificationsService,
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
      relations: ['student', 'student.user'],
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
