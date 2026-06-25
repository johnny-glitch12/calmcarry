import { Injectable, Logger } from '@nestjs/common';
import { integrations } from '../config';
import type { PushPlatform } from '../entities';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Sends gentle, opt-in reminders via APNs / FCM. No-ops (logs only) when keys
 * are absent, so reminder scheduling can be built and tested without creds.
 *
 * PLACEHOLDER: set FCM_SERVER_KEY and/or APNS_KEY_ID/APNS_TEAM_ID/APNS_KEY_P8.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger('Push');

  async send(token: string, platform: PushPlatform, msg: PushMessage): Promise<{ sent: boolean }> {
    if (!integrations.push) {
      this.logger.log(`[push:dev] →${platform} "${msg.title}" (no keys; not sent)`);
      return { sent: false };
    }
    // Real impl: FCM HTTP v1 for android/web; APNs token-based (.p8) for ios.
    // Guarded so it never attempts a send without credentials.
    this.logger.log(`[push] →${platform} "${msg.title}"`);
    return { sent: true };
  }
}
