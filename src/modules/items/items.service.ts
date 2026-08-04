import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from './entities/item.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { UserRole } from '../users/user.types';
import type { IStorageService } from '../../common/storage/storage.interface';
import { STORAGE_SERVICE } from '../../common/storage/storage.interface';
import { ItemResponseDto } from './dto/item-response.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.types';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class ItemsService {
  private readonly logger = new Logger(ItemsService.name);

  constructor(
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findAll(
    currentUser: { id: string; role: UserRole },
    query: PaginationQueryDto,
  ): Promise<{ data: ItemResponseDto[]; meta: object }> {
    const { page, limit } = query;
    const whereClause: Record<string, unknown> = {};

    if (currentUser.role === UserRole.VENDOR) {
      const vendor = await this.vendorRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (!vendor) throw new ForbiddenException();
      whereClause.vendorId = vendor.id;
    }

    const [items, total] = await this.itemRepo.findAndCount({
      where: whereClause,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: items.map((i) => this.toDto(i)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<ItemResponseDto> {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(ErrorMessages.ITEMS.NOT_FOUND);

    if (currentUser.role === UserRole.VENDOR) {
      const vendor = await this.vendorRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (vendor?.id !== item.vendorId) throw new ForbiddenException();
    }

    return this.toDto(item);
  }

  async create(
    vendorId: string,
    dto: CreateItemDto,
    currentUser: { id: string; role: UserRole },
  ): Promise<ItemResponseDto> {
    const vendor = await this.vendorRepo.findOne({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException(ErrorMessages.VENDORS.NOT_FOUND);

    if (
      currentUser.role === UserRole.VENDOR &&
      vendor.userId !== currentUser.id
    ) {
      throw new ForbiddenException();
    }

    const item = await this.itemRepo.save({ ...dto, vendorId });
    return this.toDto(item);
  }

  async update(
    id: string,
    dto: UpdateItemDto,
    currentUser: { id: string; role: UserRole },
  ): Promise<ItemResponseDto> {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(ErrorMessages.ITEMS.NOT_FOUND);

    if (currentUser.role === UserRole.VENDOR) {
      const vendor = await this.vendorRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (vendor?.id !== item.vendorId) throw new ForbiddenException();
    }

    await this.itemRepo.update(id, dto);
    return this.toDto({ ...item, ...dto });
  }

  async remove(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<void> {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(ErrorMessages.ITEMS.NOT_FOUND);

    if (currentUser.role === UserRole.VENDOR) {
      const vendor = await this.vendorRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (vendor?.id !== item.vendorId) throw new ForbiddenException();
    }

    await this.itemRepo.delete(id);
  }

  async updateImage(
    id: string,
    file: Express.Multer.File,
    currentUser: { id: string; role: UserRole },
  ): Promise<ItemResponseDto> {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(ErrorMessages.ITEMS.NOT_FOUND);

    if (currentUser.role === UserRole.VENDOR) {
      const vendor = await this.vendorRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (vendor?.id !== item.vendorId) throw new ForbiddenException();
    }

    // The live imageUrl is left untouched so the item stays visible/orderable
    // with its current photo while the new one awaits admin approval.
    if (item.pendingImageUrl) {
      await this.storageService
        .deleteFile(`items/${id}/${item.pendingImageUrl}`)
        .catch(() => undefined);
    }

    const ext = file.mimetype.split('/')[1];
    const pendingImageUrl = `pending-${Date.now()}.${ext}`;
    await this.storageService.uploadBuffer(
      file.buffer,
      `items/${id}/${pendingImageUrl}`,
      file.mimetype,
    );

    await this.itemRepo.update(id, { pendingImageUrl });
    return this.toDto({ ...item, pendingImageUrl });
  }

  async approveImage(id: string): Promise<ItemResponseDto> {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(ErrorMessages.ITEMS.NOT_FOUND);

    if (!item.pendingImageUrl) {
      throw new ConflictException(ErrorMessages.ITEMS.NO_PENDING_IMAGE);
    }

    if (item.imageUrl) {
      await this.storageService
        .deleteFile(`items/${id}/${item.imageUrl}`)
        .catch(() => undefined);
    }

    const imageUrl = item.pendingImageUrl;
    await this.itemRepo.update(id, {
      imageUrl,
      pendingImageUrl: null as unknown as string,
    });

    const vendor = await this.vendorRepo.findOne({
      where: { id: item.vendorId },
    });
    if (vendor) {
      this.notificationsService
        .createNotification(
          NotificationType.ITEM_IMAGE_APPROVED,
          vendor.userId,
          {
            title: 'Photo approuvée',
            body: `La nouvelle photo de "${item.name}" a été approuvée et est maintenant visible.`,
          },
        )
        .catch((err) =>
          this.logger.error(`Notification failed for item ${id}`, err.stack),
        );
    }

    return this.toDto({
      ...item,
      imageUrl,
      pendingImageUrl: null as unknown as string,
    });
  }

  async rejectImage(id: string): Promise<ItemResponseDto> {
    const item = await this.itemRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(ErrorMessages.ITEMS.NOT_FOUND);

    if (!item.pendingImageUrl) {
      throw new ConflictException(ErrorMessages.ITEMS.NO_PENDING_IMAGE);
    }

    await this.storageService
      .deleteFile(`items/${id}/${item.pendingImageUrl}`)
      .catch(() => undefined);

    await this.itemRepo.update(id, {
      pendingImageUrl: null as unknown as string,
    });

    const vendor = await this.vendorRepo.findOne({
      where: { id: item.vendorId },
    });
    if (vendor) {
      this.notificationsService
        .createNotification(
          NotificationType.ITEM_IMAGE_REJECTED,
          vendor.userId,
          {
            title: 'Photo rejetée',
            body: `La nouvelle photo de "${item.name}" a été rejetée. La photo actuelle reste inchangée.`,
          },
        )
        .catch((err) =>
          this.logger.error(`Notification failed for item ${id}`, err.stack),
        );
    }

    return this.toDto({ ...item, pendingImageUrl: null as unknown as string });
  }

  private toDto(item: Item): ItemResponseDto {
    return {
      id: item.id,
      vendorId: item.vendorId,
      name: item.name,
      price: item.price,
      description: item.description,
      imageUrl: item.imageUrl
        ? this.storageService.getPublicUrl(`items/${item.id}/${item.imageUrl}`)
        : item.imageUrl,
      pendingImageUrl: item.pendingImageUrl
        ? this.storageService.getPublicUrl(
            `items/${item.id}/${item.pendingImageUrl}`,
          )
        : null,
      status: item.status,
      createdAt: item.createdAt,
    };
  }
}
