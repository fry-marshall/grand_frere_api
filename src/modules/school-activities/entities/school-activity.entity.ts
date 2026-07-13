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

@Entity('school_activities')
export class SchoolActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schoolId' })
  school: School;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column('simple-array', { nullable: true })
  photoUrls: string[];

  @Column({ default: false })
  isVisible: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
