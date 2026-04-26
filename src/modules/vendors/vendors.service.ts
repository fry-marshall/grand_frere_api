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
import { VendorStatus } from './vendor.types';
import { UserRole } from '../users/user.types';
import { VendorResponseDto } from './dto/vendor-response.dto';
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
