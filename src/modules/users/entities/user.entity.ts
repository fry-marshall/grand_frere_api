import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { Gender, UserRole } from '../user.types';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Index({ unique: true, where: '"deletedAt" IS NULL' })
  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender;

  @Column({ nullable: true })
  schoolId: string;

  @ManyToOne(() => School, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'schoolId' })
  school: School;

  @Column({ nullable: true, type: 'varchar' })
  fcmToken: string | null;

  @Column({ default: false })
  isOnboarded: boolean;

  @Column({ default: false })
  isPhoneVerified: boolean;

  @DeleteDateColumn()
  deletedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
