import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Wallet } from './wallet.entity';
import { Currency } from '../../../common/enums/currency.enum';
import { TransactionType } from '../wallet.types';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  walletId: string;

  @ManyToOne(() => Wallet, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'walletId' })
  wallet: Wallet;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'enum', enum: Currency, default: Currency.XOF })
  currency: Currency;

  @Column({ type: 'integer' })
  balanceBefore: number;

  @Column({ type: 'integer' })
  balanceAfter: number;

  @Column({ nullable: true })
  orderId: string;

  @Column({ nullable: true })
  paymentId: string;

  @CreateDateColumn()
  createdAt: Date;
}
