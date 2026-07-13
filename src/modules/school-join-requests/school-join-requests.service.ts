import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchoolJoinRequest } from './entities/school-join-request.entity';
import { SchoolJoinRequestStatus } from './school-join-request.types';
import { School } from '../schools/entities/school.entity';
import { SchoolsService } from '../schools/schools.service';
import { SubmitSchoolJoinRequestDto } from './dto/submit-school-join-request.dto';
import { ApproveSchoolJoinRequestDto } from './dto/approve-school-join-request.dto';
import { RejectSchoolJoinRequestDto } from './dto/reject-school-join-request.dto';
import { SchoolJoinRequestResponseDto } from './dto/school-join-request-response.dto';
import { ApproveSchoolJoinRequestResponseDto } from './dto/approve-school-join-request-response.dto';
import { SchoolAdminResponseDto } from '../schools/dto/school-admin-response.dto';
import { SchoolJoinRequestsQueryDto } from './dto/school-join-requests-query.dto';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class SchoolJoinRequestsService {
  constructor(
    @InjectRepository(SchoolJoinRequest)
    private readonly requestRepo: Repository<SchoolJoinRequest>,
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    private readonly schoolsService: SchoolsService,
  ) {}

  async submit(
    dto: SubmitSchoolJoinRequestDto,
  ): Promise<SchoolJoinRequestResponseDto> {
    const request = await this.requestRepo.save({
      ...dto,
      status: SchoolJoinRequestStatus.PENDING,
    });
    return this.toDto(request);
  }

  async findAll(
    query: SchoolJoinRequestsQueryDto,
  ): Promise<{ data: SchoolJoinRequestResponseDto[]; meta: object }> {
    const { page, limit, status } = query;
    const [requests, total] = await this.requestRepo.findAndCount({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: requests.map((r) => this.toDto(r)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<SchoolJoinRequestResponseDto> {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request)
      throw new NotFoundException(ErrorMessages.SCHOOL_JOIN_REQUESTS.NOT_FOUND);
    return this.toDto(request);
  }

  async approve(
    id: string,
    dto: ApproveSchoolJoinRequestDto,
  ): Promise<ApproveSchoolJoinRequestResponseDto> {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request)
      throw new NotFoundException(ErrorMessages.SCHOOL_JOIN_REQUESTS.NOT_FOUND);
    if (request.status !== SchoolJoinRequestStatus.PENDING) {
      throw new ConflictException(
        ErrorMessages.SCHOOL_JOIN_REQUESTS.NOT_PENDING,
      );
    }

    const school = await this.schoolsService.create({
      name: request.schoolName,
      sigle: request.sigle,
      address: request.address,
    });

    // SchoolsService.create/createAdmin use their own repos rather than a
    // shared query runner, so a real DB transaction isn't available here —
    // compensate by deleting the just-created school if admin creation fails,
    // so we never leave a school with no admin behind.
    let admin: SchoolAdminResponseDto;
    try {
      admin = await this.schoolsService.createAdmin(school.id, {
        firstName: request.contactFirstName,
        lastName: request.contactLastName,
        phone: request.contactPhone,
        password: dto.password,
      });
    } catch (error) {
      await this.schoolRepo.delete(school.id);
      throw error;
    }

    await this.requestRepo.update(id, {
      status: SchoolJoinRequestStatus.APPROVED,
    });

    return { school, admin };
  }

  async reject(
    id: string,
    dto: RejectSchoolJoinRequestDto,
  ): Promise<SchoolJoinRequestResponseDto> {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request)
      throw new NotFoundException(ErrorMessages.SCHOOL_JOIN_REQUESTS.NOT_FOUND);
    if (request.status !== SchoolJoinRequestStatus.PENDING) {
      throw new ConflictException(
        ErrorMessages.SCHOOL_JOIN_REQUESTS.NOT_PENDING,
      );
    }

    await this.requestRepo.update(id, {
      status: SchoolJoinRequestStatus.REJECTED,
      rejectionReason: dto.reason,
    });

    return this.toDto({
      ...request,
      status: SchoolJoinRequestStatus.REJECTED,
      rejectionReason: dto.reason ?? request.rejectionReason,
    });
  }

  private toDto(request: SchoolJoinRequest): SchoolJoinRequestResponseDto {
    return {
      id: request.id,
      schoolName: request.schoolName,
      sigle: request.sigle,
      address: request.address,
      contactFirstName: request.contactFirstName,
      contactLastName: request.contactLastName,
      contactPhone: request.contactPhone,
      message: request.message,
      status: request.status,
      rejectionReason: request.rejectionReason,
      createdAt: request.createdAt,
    };
  }
}
