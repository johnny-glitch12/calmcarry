import { Column, Entity, PrimaryColumn } from 'typeorm';

export interface ProgramStep {
  day: number;
  title: string;
  trackId: string;
}

@Entity('programs')
export class Program {
  // id is a human-readable slug, e.g. 'night-reset'
  @PrimaryColumn()
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  subtitle: string | null;

  @Column({ type: 'text', nullable: true })
  avatar: string | null;

  @Column({ type: 'int', default: 1 })
  weeks: number;

  @Column({ type: 'text', nullable: true })
  coverKey: string | null;

  @Column({ type: 'boolean', default: false })
  locked: boolean;

  @Column({ type: 'simple-json', nullable: true })
  steps: ProgramStep[];
}
