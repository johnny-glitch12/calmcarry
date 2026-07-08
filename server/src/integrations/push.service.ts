import { Injectable, Logger } from '@nestjs/common';
import { importPKCS8, SignJWT } from 'jose';
import { config, integrations } from '../config';
import type { PushPlatform } from '../entities';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Sends gentle, opt-in reminders. REAL transports, credential-gated:
 *  - ios: APNs token-based auth — an ES256 JWT signed with the .p8 key
 *    (APNS_KEY_P8 / APNS_KEY_ID / APNS_TEAM_ID; APNS_SANDBOX=1 for dev builds).
 *  - android: FCM HTTP v1 — OAuth via the Firebase service account
 *    (FIREBASE_SERVICE_ACCOUNT_JSON), using google-auth-library (already a dep
 *    for Play billing).
 * Without keys it logs and reports sent:false — reminder scheduling stays
 * buildable and testable in every environment, and we never pretend a send.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger('Push');

  // APNs provider JWTs are valid 20–60 min; refresh at ~45.
  private apnsJwt: { token: string; issuedAt: number } | null = null;

  private async apnsToken(): Promise<string> {
    const now = Date.now();
    if (this.apnsJwt && now - this.apnsJwt.issuedAt < 45 * 60_000) return this.apnsJwt.token;
    const key = await importPKCS8(config.push.apnsKeyP8.replace(/\\n/g, '\n'), 'ES256');
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: config.push.apnsKeyId })
      .setIssuer(config.push.apnsTeamId)
      .setIssuedAt()
      .sign(key);
    this.apnsJwt = { token, issuedAt: now };
    return token;
  }

  private async sendApns(deviceToken: string, msg: PushMessage): Promise<boolean> {
    const host = config.push.apnsSandbox ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
    const res = await fetch(`https://${host}/3/device/${deviceToken}`, {
      method: 'POST',
      headers: {
        authorization: `bearer ${await this.apnsToken()}`,
        'apns-topic': config.push.apnsTopic,
        'apns-push-type': 'alert',
        'apns-priority': '5', // power-friendly; these are gentle reminders, not alarms
        'content-type': 'application/json',
      },
      body: JSON.stringify({ aps: { alert: { title: msg.title, body: msg.body }, sound: 'default' }, ...msg.data }),
    });
    if (!res.ok) this.logger.warn(`APNs ${res.status}: ${(await res.text()).slice(0, 160)}`);
    return res.ok;
  }

  private async sendFcm(deviceToken: string, msg: PushMessage): Promise<boolean> {
    const sa = JSON.parse(config.push.firebaseServiceAccountJson) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };
    // OAuth2 access token via the service account (same library the Play billing path uses)
    const { JWT } = await import('google-auth-library');
    const client = new JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    const { token } = await client.getAccessToken();
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          token: deviceToken,
          notification: { title: msg.title, body: msg.body },
          ...(msg.data ? { data: msg.data } : {}),
        },
      }),
    });
    if (!res.ok) this.logger.warn(`FCM ${res.status}: ${(await res.text()).slice(0, 160)}`);
    return res.ok;
  }

  async send(token: string, platform: PushPlatform, msg: PushMessage): Promise<{ sent: boolean }> {
    const canIos = !!config.push.apnsKeyP8 && !!config.push.apnsKeyId && !!config.push.apnsTeamId;
    const canAndroid = !!config.push.firebaseServiceAccountJson;
    if (!integrations.push || (platform === 'ios' && !canIos) || (platform !== 'ios' && !canAndroid)) {
      this.logger.log(`[push:dev] →${platform} "${msg.title}" (no keys; not sent)`);
      return { sent: false };
    }
    try {
      const sent = platform === 'ios' ? await this.sendApns(token, msg) : await this.sendFcm(token, msg);
      return { sent };
    } catch (e) {
      this.logger.warn(`push send failed (${platform}): ${String(e).slice(0, 200)}`);
      return { sent: false };
    }
  }
}
