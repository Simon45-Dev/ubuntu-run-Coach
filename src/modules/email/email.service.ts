import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Sends via SMTP when SMTP_HOST is configured; otherwise logs the rendered
 * email instead of sending it, so invite/reset flows work in any environment
 * without real credentials. Callers never need to know which mode is active.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transport: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('email.smtpHost');
    const smtpUser = this.configService.get<string>('email.smtpUser');
    if (host) {
      this.transport = nodemailer.createTransport({
        host,
        port: this.configService.get<number>('email.smtpPort'),
        auth: smtpUser
          ? { user: smtpUser, pass: this.configService.get<string>('email.smtpPass') }
          : undefined,
      });
    }
  }

  async send(input: SendEmailInput): Promise<void> {
    if (!this.transport) {
      this.logger.log(
        `[dev email - no SMTP configured] to=${input.to} subject="${input.subject}"\n${input.text}`,
      );
      return;
    }

    await this.transport.sendMail({
      from: this.configService.get<string>('email.fromAddress'),
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  }
}
