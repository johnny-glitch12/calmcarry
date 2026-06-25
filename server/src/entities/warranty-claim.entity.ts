import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Device } from './device.entity';

export type WarrantyClaimStatus = 'submitted' | 'in_review' | 'resolved';

@Entity('warranty_claims')
export class WarrantyClaim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  deviceId: string;

  @ManyToOne(() => Device, (device) => device.claims)
  @JoinColumn({ name: 'deviceId' })
  device: Device;

  @Column()
  type: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', default: 'submitted' })
  status: WarrantyClaimStatus;

  @Column()
  reference: string;

  @CreateDateColumn()
  createdAt: Date;
}
