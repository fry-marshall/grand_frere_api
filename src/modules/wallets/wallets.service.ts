import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { Transaction } from './entities/transaction.entity';
import { TransactionType } from './wallet.types';
import { Student } from '../students/entities/student.entity';
import { User } from '../users/entities/user.entity';
import { Parent } from '../parents/entities/parent.entity';
import { StudentParent } from '../students/entities/student-parent.entity';
import { UserRole } from '../users/user.types';
import { WalletResponseDto } from './dto/wallet-response.dto';
import { ErrorMessages } from '../../common/swagger/error-messages';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletRepo: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Parent)
    private readonly parentRepo: Repository<Parent>,
    @InjectRepository(StudentParent)
    private readonly studentParentRepo: Repository<StudentParent>,
  ) {}

  async findByStudentId(
    studentId: string,
    currentUser: { id: string; role: UserRole },
  ): Promise<WalletResponseDto> {
    const student = await this.studentRepo.findOne({
      where: { id: studentId },
    });
    if (!student) throw new NotFoundException(ErrorMessages.STUDENTS.NOT_FOUND);

    if (currentUser.role === UserRole.SCHOOL_ADMIN) {
      const admin = await this.userRepo.findOne({
        where: { id: currentUser.id },
      });
      if (admin?.schoolId !== student.schoolId) throw new ForbiddenException();
    }

    if (currentUser.role === UserRole.PARENT) {
      const parent = await this.parentRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (!parent) throw new ForbiddenException();
      const link = await this.studentParentRepo.findOne({
        where: { studentId, parentId: parent.id },
      });
      if (!link) throw new ForbiddenException();
    }

    if (currentUser.role === UserRole.STUDENT) {
      const ownStudent = await this.studentRepo.findOne({
        where: { userId: currentUser.id },
      });
      if (ownStudent?.id !== studentId) throw new ForbiddenException();
    }

    const wallet = await this.walletRepo.findOne({ where: { studentId } });
    if (!wallet) throw new NotFoundException(ErrorMessages.WALLETS.NOT_FOUND);

    const spentToday = await this.computeSpentToday(wallet.id);
    return this.toDto(wallet, spentToday);
  }

  private async computeSpentToday(walletId: string): Promise<number> {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const result = await this.transactionRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount), 0)', 'total')
      .where('t.walletId = :walletId', { walletId })
      .andWhere('t.type = :type', { type: TransactionType.DEBIT })
      .andWhere('t.createdAt >= :start', { start })
      .andWhere('t.createdAt <= :end', { end })
      .getRawOne<{ total: string }>();

    return parseInt(result?.total ?? '0', 10);
  }

  private toDto(wallet: Wallet, spentToday: number): WalletResponseDto {
    return {
      id: wallet.id,
      studentId: wallet.studentId,
      balance: wallet.balance,
      reserved: wallet.reserved,
      currency: wallet.currency,
      spentToday,
    };
  }
}
