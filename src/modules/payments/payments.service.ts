import { createHmac } from 'crypto';
import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Transaction } from '../wallets/entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { Student } from '../students/entities/student.entity';
import { Parent } from '../parents/entities/parent.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { UserRole } from '../users/user.types';
import { Currency } from '../../common/enums/currency.enum';
import { PaymentStatus } from './payment.types';
import { TransactionType } from '../wallets/wallet.types';
import type { IPaystackService } from '../../common/paystack/paystack.interface';
import { PAYSTACK_SERVICE } from '../../common/paystack/paystack.interface';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { InitiatePaymentResponseDto } from './dto/initiate-payment-response.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Parent)
    private readonly parentRepo: Repository<Parent>,
    @InjectRepository(StudentParent)
    private readonly studentParentRepo: Repository<StudentParent>,
    @Inject(PAYSTACK_SERVICE)
    private readonly paystackService: IPaystackService,
  ) {}

  async findAll(
    currentUser: { id: string; role: UserRole },
    query: PaginationQueryDto,
  ): Promise<{ data: PaymentResponseDto[]; meta: object }> {
    const { page, limit } = query;

    if (currentUser.role === UserRole.SUPER_ADMIN) {
      const [payments, total] = await this.paymentRepo.findAndCount({
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
      return {
        data: payments.map((p) => this.toDto(p)),
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      };
    }

    const admin = await this.userRepo.findOne({
      where: { id: currentUser.id },
    });
    if (!admin?.schoolId) throw new ForbiddenException();

    const [payments, total] = await this.paymentRepo
      .createQueryBuilder('p')
      .innerJoin('p.wallet', 'w')
      .innerJoin('w.student', 's')
      .where('s.schoolId = :schoolId', { schoolId: admin.schoolId })
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: payments.map((p) => this.toDto(p)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async initiate(
    dto: InitiatePaymentDto,
    currentUser: { id: string; role: UserRole },
  ): Promise<InitiatePaymentResponseDto> {
    const student = await this.studentRepo.findOne({
      where: { id: dto.studentId },
    });
    if (!student) throw new NotFoundException(ErrorMessages.STUDENTS.NOT_FOUND);

    if (currentUser.role === UserRole.PARENT) {
      const parent = await this.parentRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (!parent) throw new ForbiddenException();
      const link = await this.studentParentRepo.findOne({
        where: { studentId: dto.studentId, parentId: parent.id },
      });
      if (!link) throw new ForbiddenException();
    }

    if (currentUser.role === UserRole.STUDENT) {
      const ownStudent = await this.studentRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (ownStudent?.id !== dto.studentId) throw new ForbiddenException();
    }

    let wallet = await this.walletRepo.findOne({
      where: { studentId: dto.studentId },
    });
    if (!wallet) {
      wallet = await this.walletRepo.save({ studentId: dto.studentId });
    }

    const reference = `GF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = 'contact@grandfrere.com';

    let paystackResult: { authorizationUrl: string; reference: string };
    try {
      paystackResult = await this.paystackService.initializeTransaction({
        amount: dto.amount,
        email,
        reference,
        currency: Currency.XOF,
      });
    } catch {
      throw new InternalServerErrorException(
        ErrorMessages.PAYMENTS.INITIATION_FAILED,
      );
    }

    const payment = await this.paymentRepo.save({
      walletId: wallet.id,
      paystackRef: paystackResult.reference,
      amount: dto.amount,
      currency: Currency.XOF,
      status: PaymentStatus.PENDING,
      initiatedBy: currentUser.id,
    });

    return {
      paymentId: payment.id,
      authorizationUrl: paystackResult.authorizationUrl,
      reference: paystackResult.reference,
    };
  }

  async handleWebhook(
    rawBody: Buffer,
    signature: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    const secret = this.configService.get<string>('PAYSTACK_SECRET_KEY') ?? '';
    const expected = createHmac('sha512', secret).update(rawBody).digest('hex');

    if (signature !== expected) {
      throw new UnauthorizedException(
        ErrorMessages.PAYMENTS.INVALID_WEBHOOK_SIGNATURE,
      );
    }

    if (body.event !== 'charge.success') return;

    const data = body.data as { reference: string; amount: number };

    const payment = await this.paymentRepo.findOne({
      where: { paystackRef: data.reference },
    });
    if (!payment) return;

    if (payment.status === PaymentStatus.SUCCESS) return;

    await this.paymentRepo.update(payment.id, {
      status: PaymentStatus.SUCCESS,
    });

    const wallet = await this.walletRepo.findOne({
      where: { id: payment.walletId },
    });
    if (!wallet) return;

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + payment.amount;

    await this.walletRepo.update(wallet.id, { balance: balanceAfter });

    await this.transactionRepo.save({
      walletId: wallet.id,
      type: TransactionType.CREDIT,
      amount: payment.amount,
      currency: payment.currency,
      balanceBefore,
      balanceAfter,
      paymentId: payment.id,
    });
  }

  private toDto(payment: Payment): PaymentResponseDto {
    return {
      id: payment.id,
      walletId: payment.walletId,
      paystackRef: payment.paystackRef,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      initiatedBy: payment.initiatedBy,
      createdAt: payment.createdAt,
    };
  }
}
