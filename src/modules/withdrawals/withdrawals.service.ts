import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Withdrawal } from './entities/withdrawal.entity';
import { Vendor } from '../vendors/entities/vendor.entity';
import { VendorWallet } from '../vendors/entities/vendor-wallet.entity';
import { WithdrawalStatus } from './withdrawal.types';
import { UserRole } from '../users/user.types';
import { Currency } from '../../common/enums/currency.enum';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { WithdrawalResponseDto } from './dto/withdrawal-response.dto';
import { WithdrawalListItemResponseDto } from './dto/withdrawal-list-item-response.dto';
import { WithdrawalStatsResponseDto } from './dto/withdrawal-stats-response.dto';
import { WithdrawalsSearchQueryDto } from './dto/withdrawals-search-query.dto';
import { WithdrawalStatsQueryDto } from './dto/withdrawal-stats-query.dto';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class WithdrawalsService {
  constructor(
    @InjectRepository(Withdrawal)
    private readonly withdrawalRepo: Repository<Withdrawal>,
    @InjectRepository(Vendor)
    private readonly vendorRepo: Repository<Vendor>,
    @InjectRepository(VendorWallet)
    private readonly vendorWalletRepo: Repository<VendorWallet>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    vendorId: string,
    dto: CreateWithdrawalDto,
    currentUser: { id: string; role: UserRole },
  ): Promise<WithdrawalResponseDto> {
    const vendor = await this.vendorRepo.findOne({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException(ErrorMessages.VENDORS.NOT_FOUND);

    if (
      currentUser.role === UserRole.VENDOR &&
      vendor.userId !== currentUser.id
    ) {
      throw new ForbiddenException();
    }

    const vendorWallet = await this.vendorWalletRepo.findOne({
      where: { vendorId },
    });
    if (!vendorWallet) {
      throw new NotFoundException(ErrorMessages.VENDORS.WALLET_NOT_FOUND);
    }

    if (vendorWallet.balance < dto.amount) {
      throw new BadRequestException(
        ErrorMessages.WITHDRAWALS.INSUFFICIENT_BALANCE,
      );
    }

    const withdrawal = await this.dataSource.transaction(async (manager) => {
      await manager.update(VendorWallet, vendorWallet.id, {
        balance: vendorWallet.balance - dto.amount,
      });

      return manager.save(Withdrawal, {
        vendorId,
        amount: dto.amount,
        currency: vendorWallet.currency ?? Currency.XOF,
        waveNumber: dto.waveNumber,
        status: WithdrawalStatus.PENDING,
      });
    });

    return this.toDto(withdrawal);
  }

  async findAll(
    currentUser: { id: string; role: UserRole },
    query: WithdrawalsSearchQueryDto,
  ): Promise<{ data: WithdrawalListItemResponseDto[]; meta: object }> {
    const { schoolId, status, page, limit } = query;

    const qb = this.withdrawalRepo
      .createQueryBuilder('withdrawal')
      .leftJoinAndSelect('withdrawal.vendor', 'vendor')
      .leftJoinAndSelect('vendor.school', 'school');

    if (currentUser.role === UserRole.VENDOR) {
      const vendor = await this.vendorRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (!vendor) throw new ForbiddenException();
      qb.andWhere('withdrawal.vendorId = :vendorId', { vendorId: vendor.id });
    }

    if (schoolId) {
      qb.andWhere('vendor.schoolId = :schoolId', { schoolId });
    }
    if (status) {
      qb.andWhere('withdrawal.status = :status', { status });
    }

    const [withdrawals, total] = await qb
      .orderBy('withdrawal.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: withdrawals.map((w) => this.toListItemDto(w)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(
    id: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<WithdrawalListItemResponseDto> {
    const withdrawal = await this.withdrawalRepo.findOne({
      where: { id },
      relations: ['vendor', 'vendor.school'],
    });
    if (!withdrawal)
      throw new NotFoundException(ErrorMessages.WITHDRAWALS.NOT_FOUND);

    if (
      currentUser.role === UserRole.VENDOR &&
      withdrawal.vendor.userId !== currentUser.id
    ) {
      throw new ForbiddenException();
    }

    return this.toListItemDto(withdrawal);
  }

  async getStats(
    query: WithdrawalStatsQueryDto,
  ): Promise<WithdrawalStatsResponseDto> {
    const qb = this.withdrawalRepo
      .createQueryBuilder('withdrawal')
      .innerJoin('withdrawal.vendor', 'vendor');

    if (query.schoolId) {
      qb.andWhere('vendor.schoolId = :schoolId', { schoolId: query.schoolId });
    }

    const rows = await qb
      .select('withdrawal.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(withdrawal.amount), 0)', 'amount')
      .groupBy('withdrawal.status')
      .getRawMany<{
        status: WithdrawalStatus;
        count: string;
        amount: string;
      }>();

    return {
      byStatus: rows.map((row) => ({
        status: row.status,
        count: Number(row.count),
        amount: Number(row.amount),
      })),
    };
  }

  async process(
    id: string,
    paystackRef: string | undefined,
  ): Promise<WithdrawalResponseDto> {
    const withdrawal = await this.withdrawalRepo.findOne({ where: { id } });
    if (!withdrawal)
      throw new NotFoundException(ErrorMessages.WITHDRAWALS.NOT_FOUND);

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw new BadRequestException(ErrorMessages.WITHDRAWALS.NOT_PENDING);
    }

    await this.withdrawalRepo.update(id, {
      status: WithdrawalStatus.IN_PROGRESS,
      ...(paystackRef ? { paystackRef } : {}),
    });

    return this.toDto({
      ...withdrawal,
      status: WithdrawalStatus.IN_PROGRESS,
      paystackRef: paystackRef ?? withdrawal.paystackRef,
    });
  }

  async complete(id: string): Promise<WithdrawalResponseDto> {
    const withdrawal = await this.withdrawalRepo.findOne({ where: { id } });
    if (!withdrawal)
      throw new NotFoundException(ErrorMessages.WITHDRAWALS.NOT_FOUND);

    if (withdrawal.status !== WithdrawalStatus.IN_PROGRESS) {
      throw new BadRequestException(ErrorMessages.WITHDRAWALS.NOT_IN_PROGRESS);
    }

    await this.withdrawalRepo.update(id, { status: WithdrawalStatus.SUCCESS });
    return this.toDto({ ...withdrawal, status: WithdrawalStatus.SUCCESS });
  }

  async fail(id: string): Promise<WithdrawalResponseDto> {
    const withdrawal = await this.withdrawalRepo.findOne({ where: { id } });
    if (!withdrawal)
      throw new NotFoundException(ErrorMessages.WITHDRAWALS.NOT_FOUND);

    if (
      withdrawal.status !== WithdrawalStatus.PENDING &&
      withdrawal.status !== WithdrawalStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(ErrorMessages.WITHDRAWALS.NOT_PENDING);
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Withdrawal, id, { status: WithdrawalStatus.FAILED });

      const vendorWallet = await this.vendorWalletRepo.findOne({
        where: { vendorId: withdrawal.vendorId },
      });
      if (vendorWallet) {
        await manager.update(VendorWallet, vendorWallet.id, {
          balance: vendorWallet.balance + withdrawal.amount,
        });
      }
    });

    return this.toDto({ ...withdrawal, status: WithdrawalStatus.FAILED });
  }

  private toListItemDto(withdrawal: Withdrawal): WithdrawalListItemResponseDto {
    return {
      id: withdrawal.id,
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      waveNumber: withdrawal.waveNumber,
      paystackRef: withdrawal.paystackRef ?? null,
      status: withdrawal.status,
      createdAt: withdrawal.createdAt,
      vendor: {
        id: withdrawal.vendor.id,
        shopName: withdrawal.vendor.shopName,
      },
      school: {
        id: withdrawal.vendor.school.id,
        name: withdrawal.vendor.school.name,
      },
    };
  }

  private toDto(withdrawal: Withdrawal): WithdrawalResponseDto {
    return {
      id: withdrawal.id,
      vendorId: withdrawal.vendorId,
      amount: withdrawal.amount,
      currency: withdrawal.currency,
      waveNumber: withdrawal.waveNumber,
      paystackRef: withdrawal.paystackRef ?? null,
      status: withdrawal.status,
      createdAt: withdrawal.createdAt,
    };
  }
}
