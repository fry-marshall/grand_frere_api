import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { Wallet } from '../wallets/entities/wallet.entity';
import { Student } from '../students/entities/student.entity';
import { Parent } from '../parents/entities/parent.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { UserRole } from '../users/user.types';
import { Currency } from '../../common/enums/currency.enum';
import { PaymentStatus } from './payment.types';
import type { IPaystackService } from '../../common/paystack/paystack.interface';
import { PAYSTACK_SERVICE } from '../../common/paystack/paystack.interface';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { InitiatePaymentResponseDto } from './dto/initiate-payment-response.dto';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(Parent)
    private readonly parentRepo: Repository<Parent>,
    @InjectRepository(StudentParent)
    private readonly studentParentRepo: Repository<StudentParent>,
    @Inject(PAYSTACK_SERVICE)
    private readonly paystackService: IPaystackService,
  ) {}

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
}
