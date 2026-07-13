import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Item } from './entities/item.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/user.types';
import type { IStorageService } from '../../common/storage/storage.interface';
import { STORAGE_SERVICE } from '../../common/storage/storage.interface';
import { ItemResponseDto } from './dto/item-response.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class ItemsService {
  constructor(
    @InjectRepository(Item)
    private readonly itemRepo: Repository<Item>,
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
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

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (!admin?.schoolId) throw new ForbiddenException();
      const vendors = await this.vendorRepo.find({
        where: { schoolId: admin.schoolId },
        select: ['id'],
      });
      if (vendors.length === 0) {
        return {
          data: [],
          meta: { total: 0, page, limit, totalPages: 0 },
        };
      }
      whereClause.vendorId = In(vendors.map((v) => v.id));
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

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      const vendor = await this.vendorRepo.findOne({
        where: { id: item.vendorId },
      });
      if (vendor?.schoolId !== admin?.schoolId) throw new ForbiddenException();
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

    if (item.imageUrl) {
      await this.storageService
        .deleteFile(`items/${id}/${item.imageUrl}`)
        .catch(() => undefined);
    }

    const ext = file.mimetype.split('/')[1];
    const imageUrl = `${Date.now()}.${ext}`;
    await this.storageService.uploadBuffer(
      file.buffer,
      `items/${id}/${imageUrl}`,
      file.mimetype,
    );

    await this.itemRepo.update(id, { imageUrl });
    return this.toDto({ ...item, imageUrl });
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
      status: item.status,
      createdAt: item.createdAt,
    };
  }
}
