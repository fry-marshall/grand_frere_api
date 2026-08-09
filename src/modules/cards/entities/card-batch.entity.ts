import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { School } from '../../schools/entities/school.entity';
import { CardTemplate } from '../card.types';

@Entity('card_batches')
export class CardBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'schoolId' })
  school: School;

  @Column({ type: 'enum', enum: CardTemplate })
  template: CardTemplate;

  @Column({ type: 'integer' })
  count: number;

  @Column({ nullable: true })
  pdfUrl: string;

  @CreateDateColumn()
  createdAt: Date;
}
