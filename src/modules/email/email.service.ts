import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Sends via Brevo's HTTP API when BREVO_API_KEY is configured; otherwise logs
 * the rendered email instead of sending it, so invite/reset flows work in any
 * environment without real credentials. Callers never need to know which
 * mode is active.
 *
 * Uses Brevo's HTTP API rather than SMTP because Render's free web service -
 * this project's primary hosting target, see docs/deployment.md - blocks all
 * outbound traffic to SMTP ports (25/465/587) as an anti-spam policy; a
 * plain HTTPS POST is unaffected.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string | undefined;
  private readonly fromAddress: string | undefined;
  private readonly fromName: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('email.brevoApiKey');
    this.fromAddress = this.configService.get<string>('email.fromAddress');
    this.fromName = this.configService.get<string>('email.fromName') ?? 'Ubuntu Run';
  }

  async send(input: SendEmailInput): Promise<void> {
    if (!this.apiKey) {
      this.logger.log(
        `[dev email - no BREVO_API_KEY configured] to=${input.to} subject="${input.subject}"\n${input.text}`,
      );
      return;
    }

    const res = await fetch(BREVO_SEND_URL, {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: this.fromName, email: this.fromAddress },
        to: [{ email: input.to }],
        subject: input.subject,
        textContent: input.text,
        htmlContent: input.html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Brevo send failed (${res.status}): ${body}`);
    }
  }
}
