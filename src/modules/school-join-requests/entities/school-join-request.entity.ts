import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SchoolJoinRequestStatus } from '../school-join-request.types';
import { Gender } from '../../users/user.types';

@Entity('school_join_requests')
export class SchoolJoinRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  schoolName: string;

  @Column()
  city: string;

  @Column()
  studentCount: number;

  @Column({ type: 'enum', enum: Gender })
  gender: Gender;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  phone: string;

  @Column()
  email: string;

  @Column()
  position: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({
    type: 'enum',
    enum: SchoolJoinRequestStatus,
    default: SchoolJoinRequestStatus.PENDING,
  })
  status: SchoolJoinRequestStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @CreateDateColumn()
  createdAt: Date;
}
