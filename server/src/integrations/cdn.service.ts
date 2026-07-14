import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';
import { config, integrations, isProd } from '../config';

/**
 * Mints short-lived signed URLs for protected audio/video assets on the CDN.
 * When CDN keys are absent, returns the asset path unsigned so local/bundled
 * playback still works.
 *
 * PLACEHOLDER: set CDN_BASE_URL + CDN_SIGNING_KEY for real signed delivery.
 */
@Injectable()
export class CdnService {
  signAssetUrl(assetPath: string): { url: string; expiresAt: number | null; signed: boolean } {
    if (!integrations.cdn) {
      // In prod, refuse rather than serve locked audio as an unsigned public URL.
      // (The boot guard already blocks prod startup without CDN keys - this is a
      // defense-in-depth backstop.)
      if (isProd) throw new ServiceUnavailableException('Content delivery not configured');
      // dev: hand back the path; the app falls back to its bundled asset for this key
      return { url: assetPath, expiresAt: null, signed: false };
    }
    const expires = Math.floor(Date.now() / 1000) + config.cdn.signedUrlTtlSec;
    const base = config.cdn.baseUrl.replace(/\/$/, '');
    const path = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
    const toSign = `${path}:${expires}`;
    const sig = crypto.createHmac('sha256', config.cdn.signingKey).update(toSign).digest('hex');
    return { url: `${base}${path}?expires=${expires}&sig=${sig}`, expiresAt: expires, signed: true };
  }
}
