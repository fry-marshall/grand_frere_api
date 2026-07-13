import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SchoolJoinRequestStatus } from '../school-join-request.types';

@Entity('school_join_requests')
export class SchoolJoinRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  schoolName: string;

  @Column()
  sigle: string;

  @Column()
  address: string;

  @Column()
  contactFirstName: string;

  @Column()
  contactLastName: string;

  @Column()
  contactPhone: string;

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
