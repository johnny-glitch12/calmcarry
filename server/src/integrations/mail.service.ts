import { Injectable, Logger } from '@nestjs/common';
import { config, integrations } from '../config';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/**
 * Transactional mail (password reset / email verification). Credential-safe like
 * every integration here: without SMTP_URL it LOGS the message (subject + a
 * redacted recipient - never the code body) and reports sent:false, so dev and
 * preview environments work end-to-end while prod refuses to pretend.
 * With SMTP_URL set (e.g. smtps://user:pass@host:465) it sends via nodemailer.
 */
@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private transporter: import('nodemailer').Transporter | null = null;

  private transport(): import('nodemailer').Transporter | null {
    if (!integrations.mail) return null;
    if (!this.transporter) {
      // lazy require so the module boots even if the dep tree is trimmed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const nodemailer = require('nodemailer') as typeof import('nodemailer');
      this.transporter = nodemailer.createTransport(config.mail.smtpUrl);
    }
    return this.transporter;
  }

  async send(mail: Mail): Promise<{ sent: boolean }> {
    const t = this.transport();
    if (!t) {
      const masked = mail.to.replace(/^(.).*(@.*)$/, '$1***$2');
      this.log.log(`[mail:dev] would send "${mail.subject}" to ${masked}`);
      return { sent: false };
    }
    try {
      await t.sendMail({ from: config.mail.from, to: mail.to, subject: mail.subject, text: mail.text });
      return { sent: true };
    } catch (e) {
      this.log.warn(`mail send failed: ${String(e).slice(0, 200)}`);
      return { sent: false };
    }
  }
}
