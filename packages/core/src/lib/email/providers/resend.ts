import { Resend, type CreateEmailOptions, type CreateEmailRequestOptions } from 'resend';
import type { EmailProvider, EmailOptions, EmailResponse } from '../types';
import { defaultFromHeader } from '../sender';

const RESEND_TIMEOUT_MS = 10_000;

export class ResendProvider implements EmailProvider {
  private client: Resend;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom?: string) {
    if (!apiKey) {
      throw new Error('Resend API key is required');
    }
    
    this.client = new Resend(apiKey);
    // Without a configured sender, Resend's testing sender (it only delivers to the account owner)
    this.defaultFrom = defaultFrom || defaultFromHeader(process.env, 'onboarding@resend.dev')!;
  }

  async send(options: EmailOptions): Promise<EmailResponse> {
    try {
      // Resend requires at least html or text to be provided
      if (!options.html && !options.text) {
        throw new Error('Either html or text content must be provided');
      }

      const emailData: CreateEmailOptions = {
        from: options.from || this.defaultFrom,
        to: options.to,
        subject: options.subject,
      } as CreateEmailOptions;

      // Add optional fields only if they exist
      if (options.html) emailData.html = options.html;
      if (options.text) emailData.text = options.text;
      if (options.replyTo) emailData.replyTo = options.replyTo;
      if (options.cc) emailData.cc = options.cc;
      if (options.bcc) emailData.bcc = options.bcc;
      if (options.headers) emailData.headers = options.headers;

      // resend 5 does not type `signal`, but passes its request options to fetch as they are; an aborted
      // request comes back as { error }, so a silent API ends as a failed send instead of hanging
      const requestOptions = { signal: AbortSignal.timeout(RESEND_TIMEOUT_MS) } as CreateEmailRequestOptions;
      const { data, error } = await this.client.emails.send(emailData, requestOptions);

      if (error) {
        return {
          id: '',
          success: false,
          error: error.message,
        };
      }

      return {
        id: data?.id || '',
        success: true,
      };
    } catch (error) {
      console.error('ResendProvider error:', error);
      return {
        id: '',
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      };
    }
  }

  async verify(): Promise<boolean> {
    try {
      // Intenta enviar un email de prueba para verificar la configuración
      const response = await this.client.emails.send({
        from: this.defaultFrom,
        to: 'delivered@resend.dev', // Email de prueba de Resend
        subject: 'Configuration Test',
        html: '<p>Testing email configuration</p>',
      });

      return !response.error;
    } catch (error) {
      console.error('ResendProvider verification failed:', error);
      return false;
    }
  }
}