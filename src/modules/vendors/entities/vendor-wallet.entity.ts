import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Vendor } from './vendor.entity';
import { Currency } from '../../../common/enums/currency.enum';

@Entity('vendor_wallets')
export class VendorWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  vendorId: string;

  @OneToOne(() => Vendor, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column({ type: 'integer', default: 0 })
  balance: number;

  @Column({ type: 'enum', enum: Currency, default: Currency.XOF })
  currency: Currency;

  @UpdateDateColumn()
  updatedAt: Date;
}
