import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../wallets/entities/transaction.entity';
import { TransactionType } from '../wallets/wallet.types';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/user.types';
import { SchoolTransactionResponseDto } from '../schools/dto/school-transaction-response.dto';
import { TransactionsQueryDto } from './dto/transactions-query.dto';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async findAll(
    currentUser: { id: string; role: UserRole },
    query: TransactionsQueryDto,
  ): Promise<{
    transactions: { data: SchoolTransactionResponseDto[]; meta: object };
    stats: object;
  }> {
    const { page, limit, from, to } = query;
    let schoolId = query.schoolId;

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (!admin?.schoolId) throw new ForbiddenException();
      if (schoolId && schoolId !== admin.schoolId) {
        throw new ForbiddenException();
      }
      schoolId = admin.schoolId;
    }

    if (schoolId) {
      const school = await this.schoolRepo.findOne({
        where: { id: schoolId },
      });
      if (!school) throw new NotFoundException(ErrorMessages.SCHOOLS.NOT_FOUND);
    }

    const listQb = this.transactionRepo
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.wallet', 'w')
      .innerJoinAndSelect('w.student', 's')
      .innerJoinAndSelect('s.user', 'u')
      .innerJoinAndSelect('s.school', 'sc');

    const statsQb = this.transactionRepo
      .createQueryBuilder('t')
      .innerJoin('t.wallet', 'w')
      .innerJoin('w.student', 's');

    if (schoolId) {
      listQb.andWhere('s.schoolId = :schoolId', { schoolId });
      statsQb.andWhere('s.schoolId = :schoolId', { schoolId });
    }
    if (from) {
      listQb.andWhere('t.createdAt >= :from', { from });
      statsQb.andWhere('t.createdAt >= :from', { from });
    }
    if (to) {
      listQb.andWhere('t.createdAt <= :to', { to });
      statsQb.andWhere('t.createdAt <= :to', { to });
    }

    const [transactions, total] = await listQb
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const statsRaw = await statsQb
      .select('COUNT(t.id)', 'totalTransactions')
      .addSelect(
        `SUM(CASE WHEN t.type = '${TransactionType.CREDIT}' THEN t.amount ELSE 0 END)`,
        'totalCredits',
      )
      .addSelect(
        `SUM(CASE WHEN t.type = '${TransactionType.DEBIT}' THEN t.amount ELSE 0 END)`,
        'totalDebits',
      )
      .addSelect(
        `COUNT(CASE WHEN t.type = '${TransactionType.CREDIT}' THEN 1 END)`,
        'rechargeCount',
      )
      .getRawOne();

    return {
      transactions: {
        data: transactions.map((t) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          currency: t.currency,
          balanceBefore: t.balanceBefore,
          balanceAfter: t.balanceAfter,
          orderId: t.orderId,
          paymentId: t.paymentId,
          createdAt: t.createdAt,
          student: {
            id: t.wallet.student.id,
            class: t.wallet.student.class,
            user: {
              id: t.wallet.student.user.id,
              firstName: t.wallet.student.user.firstName,
              lastName: t.wallet.student.user.lastName,
            },
          },
          school: {
            id: t.wallet.student.school.id,
            name: t.wallet.student.school.name,
          },
        })),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      },
      stats: {
        totalTransactions: Number(statsRaw.totalTransactions),
        totalCredits: Number(statsRaw.totalCredits) || 0,
        totalDebits: Number(statsRaw.totalDebits) || 0,
        rechargeCount: Number(statsRaw.rechargeCount) || 0,
      },
    };
  }
}
