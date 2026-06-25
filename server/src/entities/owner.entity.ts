import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Entitlement } from './entitlement.entity';
import { Device } from './device.entity';
import { SessionLog } from './session-log.entity';

@Entity('owners')
export class Owner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Entitlement, (entitlement) => entitlement.owner)
  entitlements: Entitlement[];

  @OneToMany(() => Device, (device) => device.owner)
  devices: Device[];

  @OneToMany(() => SessionLog, (log) => log.owner)
  logs: SessionLog[];
}
