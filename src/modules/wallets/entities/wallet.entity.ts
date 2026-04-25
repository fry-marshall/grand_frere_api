import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Student } from '../../students/entities/student.entity';
import { Currency } from '../../../common/enums/currency.enum';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  studentId: string;

  @OneToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentId' })
  student: Student;

  @Column({ type: 'integer', default: 0 })
  balance: number;

  @Column({ type: 'integer', default: 0 })
  reserved: number;

  @Column({ type: 'enum', enum: Currency, default: Currency.XOF })
  currency: Currency;
}
