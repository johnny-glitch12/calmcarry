import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionLog } from '../entities';

@Injectable()
export class LogsService {
  constructor(
    @InjectRepository(SessionLog)
    private readonly logRepo: Repository<SessionLog>,
  ) {}

  async create(
    ownerId: string,
    contentId: string | null,
    deviceId: string | null,
  ): Promise<SessionLog> {
    const log = this.logRepo.create({ ownerId, contentId, deviceId });
    return this.logRepo.save(log);
  }
}
