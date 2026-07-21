import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { CardStatus } from '../card.types';

@Entity('cards')
export class Card {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  code: string;

  @Column({ nullable: true })
  pinHash: string;

  @Column({ default: 0 })
  pinAttempts: number;

  @Column({ type: 'enum', enum: CardStatus, default: CardStatus.UNASSIGNED })
  status: CardStatus;

  @Column()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'schoolId' })
  school: School;

  @Column({ nullable: true })
  studentId: string;

  @Column({ type: 'integer', default: 1000 })
  dailyLimit: number;

  @Column({ default: true })
  studentCanEditDailyLimit: boolean;

  @Column({ nullable: true })
  imageUrl: string;

  @CreateDateColumn()
  createdAt: Date;
}
