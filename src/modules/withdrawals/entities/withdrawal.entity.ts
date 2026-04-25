import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Vendor } from '../../vendors/entities/vendor.entity';
import { Currency } from '../../../common/enums/currency.enum';
import { WithdrawalStatus } from '../withdrawal.types';

@Entity('withdrawals')
export class Withdrawal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  vendorId: string;

  @ManyToOne(() => Vendor, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'enum', enum: Currency, default: Currency.XOF })
  currency: Currency;

  @Column()
  waveNumber: string;

  @Column({ nullable: true })
  paystackRef: string;

  @Column({
    type: 'enum',
    enum: WithdrawalStatus,
    default: WithdrawalStatus.PENDING,
  })
  status: WithdrawalStatus;

  @CreateDateColumn()
  createdAt: Date;
}
