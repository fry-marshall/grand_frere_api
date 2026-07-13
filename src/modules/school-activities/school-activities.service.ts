import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchoolActivity } from './entities/school-activity.entity';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/user.types';
import { CreateSchoolActivityDto } from './dto/create-school-activity.dto';
import { UpdateSchoolActivityDto } from './dto/update-school-activity.dto';
import { SchoolActivityResponseDto } from './dto/school-activity-response.dto';
import { SchoolActivitiesQueryDto } from './dto/school-activities-query.dto';
import type { IStorageService } from '../../common/storage/storage.interface';
import { STORAGE_SERVICE } from '../../common/storage/storage.interface';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class SchoolActivitiesService {
  constructor(
    @InjectRepository(SchoolActivity)
    private readonly activityRepo: Repository<SchoolActivity>,
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @Inject(STORAGE_SERVICE) private readonly storageService: IStorageService,
  ) {}

  async create(
    dto: CreateSchoolActivityDto,
    photos: Express.Multer.File[],
    currentUser: { id: string; role: UserRole },
  ): Promise<SchoolActivityResponseDto> {
    const school = await this.resolveTargetSchool(dto.schoolId, currentUser);

    const activity = await this.activityRepo.save({
      schoolId: school.id,
      title: dto.title,
      description: dto.description,
      isVisible: false,
    });

    let photoUrls: string[] = [];
    if (photos?.length) {
      photoUrls = await this.uploadPhotos(photos, activity.id);
      await this.activityRepo.update(activity.id, { photoUrls });
    }

    return this.toDto({ ...activity, photoUrls, school });
  }

  async update(
    id: string,
    dto: UpdateSchoolActivityDto,
    photos: Express.Multer.File[] | undefined,
    currentUser: { id: string; role: UserRole },
  ): Promise<SchoolActivityResponseDto> {
    const activity = await this.findActivityScoped(id, currentUser);

    let photoUrls = activity.photoUrls;
    if (photos?.length) {
      await this.deletePhotos(activity.photoUrls);
      photoUrls = await this.uploadPhotos(photos, activity.id);
    }

    const title = dto.title !== undefined ? dto.title : activity.title;
    const description =
      dto.description !== undefined ? dto.description : activity.description;

    await this.activityRepo.update(id, { title, description, photoUrls });

    return this.toDto({ ...activity, title, description, photoUrls });
  }

  async remove(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<void> {
    const activity = await this.findActivityScoped(id, currentUser);
    await this.deletePhotos(activity.photoUrls);
    await this.activityRepo.delete(id);
  }

  async publish(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<SchoolActivityResponseDto> {
    const activity = await this.findActivityScoped(id, currentUser);
    if (activity.isVisible) {
      throw new ConflictException(
        ErrorMessages.SCHOOL_ACTIVITIES.NOT_PUBLISHABLE,
      );
    }
    await this.activityRepo.update(id, { isVisible: true });
    return this.toDto({ ...activity, isVisible: true });
  }

  async hide(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<SchoolActivityResponseDto> {
    const activity = await this.findActivityScoped(id, currentUser);
    if (!activity.isVisible) {
      throw new ConflictException(ErrorMessages.SCHOOL_ACTIVITIES.NOT_HIDABLE);
    }
    await this.activityRepo.update(id, { isVisible: false });
    return this.toDto({ ...activity, isVisible: false });
  }

  async findAllPublic(
    query: SchoolActivitiesQueryDto,
  ): Promise<{ data: SchoolActivityResponseDto[]; meta: object }> {
    const { page, limit, schoolId } = query;
    const [activities, total] = await this.activityRepo.findAndCount({
      where: { isVisible: true, ...(schoolId ? { schoolId } : {}) },
      relations: ['school'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: activities.map((a) => this.toDto(a)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOnePublic(id: string): Promise<SchoolActivityResponseDto> {
    const activity = await this.activityRepo.findOne({
      where: { id },
      relations: ['school'],
    });
    if (!activity || !activity.isVisible) {
      throw new NotFoundException(ErrorMessages.SCHOOL_ACTIVITIES.NOT_FOUND);
    }
    return this.toDto(activity);
  }

  async findMine(
    query: SchoolActivitiesQueryDto,
    currentUser: { id: string; role: UserRole },
  ): Promise<{ data: SchoolActivityResponseDto[]; meta: object }> {
    const { page, limit, schoolId } = query;

    let targetSchoolId: string | undefined;
    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      targetSchoolId = admin?.schoolId;
    } else {
      targetSchoolId = schoolId;
    }

    const [activities, total] = await this.activityRepo.findAndCount({
      where: targetSchoolId ? { schoolId: targetSchoolId } : {},
      relations: ['school'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: activities.map((a) => this.toDto(a)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  private async resolveTargetSchool(
    schoolIdFromBody: string | undefined,
    currentUser: { id: string; role: UserRole },
  ): Promise<School> {
    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      const school = await this.schoolRepo.findOne({
        where: { id: admin?.schoolId },
      });
      if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);
      return school;
    }

    if (!schoolIdFromBody) {
      throw new BadRequestException('schoolId is required');
    }
    const school = await this.schoolRepo.findOne({
      where: { id: schoolIdFromBody },
    });
    if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);
    return school;
  }

  private async findActivityScoped(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<SchoolActivity> {
    const activity = await this.activityRepo.findOne({
      where: { id },
      relations: ['school'],
    });
    if (!activity) {
      throw new NotFoundException(ErrorMessages.SCHOOL_ACTIVITIES.NOT_FOUND);
    }

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (admin?.schoolId !== activity.schoolId) throw new ForbiddenException();
    }

    return activity;
  }

  private async uploadPhotos(
    photos: Express.Multer.File[],
    activityId: string,
  ): Promise<string[]> {
    const urls: string[] = [];
    const batchSize = 3;

    try {
      for (let i = 0; i < photos.length; i += batchSize) {
        const batch = photos.slice(i, i + batchSize);
        const batchUrls = await Promise.all(
          batch.map((file, idx) => {
            const ext = file.mimetype.split('/')[1];
            const key = `school-activities/${activityId}/${Date.now()}-${i + idx}.${ext}`;
            return this.storageService.uploadBuffer(
              file.buffer,
              key,
              file.mimetype,
            );
          }),
        );
        urls.push(...batchUrls);
      }
      return urls;
    } catch (error) {
      await this.deletePhotos(urls);
      throw error;
    }
  }

  private async deletePhotos(urls: string[] | null | undefined): Promise<void> {
    if (!urls?.length) return;
    await Promise.allSettled(
      urls.map((url) =>
        this.storageService.deleteFile(url.split('/').slice(-2).join('/')),
      ),
    );
  }

  private toDto(activity: SchoolActivity): SchoolActivityResponseDto {
    return {
      id: activity.id,
      schoolId: activity.schoolId,
      title: activity.title,
      description: activity.description,
      photoUrls: activity.photoUrls ?? [],
      isVisible: activity.isVisible,
      createdAt: activity.createdAt,
      school: activity.school
        ? {
            id: activity.school.id,
            name: activity.school.name,
            sigle: activity.school.sigle,
          }
        : undefined,
    };
  }
}
