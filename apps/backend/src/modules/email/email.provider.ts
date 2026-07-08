import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class EmailProvider {
  constructor(private readonly config: ConfigService) {}

  async send(input: SendEmailInput) {
    const provider = (
      this.config.get<string>('EMAIL_PROVIDER') ?? 'SENDGRID'
    ).toUpperCase();
    if (provider === 'SENDGRID') {
      return this.sendWithSendGrid(input);
    }

    if (provider === 'SMTP') {
      throw new ServiceUnavailableException(
        'SMTP provider is configured but no SMTP transport is installed',
      );
    }

    throw new BadRequestException('Unsupported email provider');
  }

  private async sendWithSendGrid(input: SendEmailInput) {
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');
    const fromEmail = this.config.get<string>('EMAIL_FROM');
    if (!apiKey || apiKey.startsWith('SG.dummy') || !fromEmail) {
      throw new BadRequestException(
        'Configure SENDGRID_API_KEY and EMAIL_FROM before sending email',
      );
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: input.to }] }],
        from: { email: fromEmail },
        subject: input.subject,
        content: [{ type: 'text/plain', value: input.text }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ServiceUnavailableException(text || 'SendGrid request failed');
    }

    return { sent: true, provider: 'SENDGRID' };
  }
}
