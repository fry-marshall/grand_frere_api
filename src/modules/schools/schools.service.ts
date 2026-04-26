import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { School } from './entities/school.entity';
import { User } from '../users/entities/user.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { SchoolStatus } from './school.types';
import { UserRole } from '../users/user.types';
import { CreateSchoolDto } from './dto/create-school.dto';
import { CreateSchoolAdminDto } from './dto/create-school-admin.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { SchoolResponseDto } from './dto/school-response.dto';
import { SchoolAdminResponseDto } from './dto/school-admin-response.dto';
import { SchoolVendorResponseDto } from './dto/school-vendor-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class SchoolsService {
  constructor(
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Vendor) private readonly vendorRepo: Repository<Vendor>,
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

    const { page, limit } = query;
    const [vendors, total] = await this.vendorRepo.findAndCount({
      where: { schoolId: id },
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
