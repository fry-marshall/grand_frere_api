import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor } from './entities/vendor.entity';
import { VendorStatus } from './vendor.types';
import { VendorResponseDto } from './dto/vendor-response.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.types';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class VendorsService {
  private readonly logger = new Logger(VendorsService.name);

  constructor(
    @InjectRepository(Vendor) private readonly vendorRepo: Repository<Vendor>,
    private readonly notificationsService: NotificationsService,
  ) {}

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
