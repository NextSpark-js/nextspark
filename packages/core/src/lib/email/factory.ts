import type { EmailProvider, EmailResponse } from './types';
import { ResendProvider } from './providers/resend';
import { ConsoleProvider } from './providers/console';
import { SmtpProvider } from './providers/smtp';
import { parseSmtpConfig, smtpEnvironmentFrom } from './smtp-config';
import { defaultFromHeader } from './sender';

export type EmailProviderType = 'resend' | 'smtp' | 'console' | 'auto';

export interface EmailFactoryOptions {
  provider?: EmailProviderType;
  resendApiKey?: string;
  defaultFrom?: string;
  consoleOptions?: {
    enabled?: boolean;
    logLevel?: 'full' | 'summary' | 'links-only';
  };
}

/**
 * The provider auto mode returns in production when nothing real is configured. It is built so import,
 * `create()` and the build keep working; the failure is at `send()`, where a sign-in code would otherwise only
 * be printed to the server log.
 */
class UnconfiguredProvider implements EmailProvider {
  async send(): Promise<EmailResponse> {
    const error = new Error(
      'EMAIL_PROVIDER_NOT_CONFIGURED: no email provider is configured in production. ' +
      'Set RESEND_API_KEY and EMAIL_FROM to send through Resend, or EMAIL_PROVIDER=smtp with SMTP_HOST and EMAIL_FROM ' +
      'to send through SMTP. EMAIL_PROVIDER=console prints emails to the server log instead.'
    );
    (error as Error & { code?: string }).code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
    throw error;
  }
}

export class EmailFactory {
  private static instance: EmailProvider | null = null;

  static create(options: EmailFactoryOptions = {}): EmailProvider {
    // Read provider from environment if not specified in options
    const envProvider = process.env.EMAIL_PROVIDER as EmailProviderType | undefined;

    const {
      provider = envProvider || 'auto',
      resendApiKey = process.env.RESEND_API_KEY,
      defaultFrom,
      consoleOptions
    } = options;

    // Si ya existe una instancia y no se especifica un provider diferente, devolverla
    if (this.instance && provider === 'auto') {
      return this.instance;
    }

    let selectedProvider: EmailProvider;

    if (provider === 'console') {
      if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️ EMAIL_PROVIDER=console in production: emails are printed to the server log, not sent');
      }
      selectedProvider = new ConsoleProvider(consoleOptions);
    } else if (provider === 'resend') {
      if (!resendApiKey) {
        throw new Error('Resend API key is required when using Resend provider');
      }
      selectedProvider = new ResendProvider(resendApiKey, defaultFrom);
    } else if (provider === 'smtp') {
      // Env is validated here; nodemailer itself loads on the first send
      const smtpConfig = parseSmtpConfig(smtpEnvironmentFrom(process.env));
      const from = defaultFrom || defaultFromHeader();
      if (!from) {
        throw new Error('EMAIL_FROM is required when using the SMTP provider');
      }
      selectedProvider = new SmtpProvider(smtpConfig, from);
    } else {
      // Auto mode: seleccionar basado en el entorno
      if (process.env.NODE_ENV === 'development' && !process.env.FORCE_RESEND_IN_DEV) {
        // En desarrollo, usar console por defecto a menos que se fuerce Resend
        console.log('📧 Using Console email provider (development mode)');
        selectedProvider = new ConsoleProvider({
          logLevel: process.env.EMAIL_LOG_LEVEL as 'full' | 'summary' | 'links-only' || 'summary',
          ...consoleOptions
        });
      } else if (resendApiKey) {
        // En producción o si hay API key, usar Resend
        selectedProvider = new ResendProvider(resendApiKey, defaultFrom);
      } else if (process.env.NODE_ENV === 'production') {
        // Sin proveedor real en producción, send() falla (EMAIL_PROVIDER_NOT_CONFIGURED); create() y el build no
        console.warn('⚠️ No email provider configured in production: sending will fail (set RESEND_API_KEY, or EMAIL_PROVIDER=smtp)');
        selectedProvider = new UnconfiguredProvider();
      } else {
        // Fuera de producción (dev con Resend forzado, test), console como fallback
        console.warn('⚠️ No email API key found, using Console provider as fallback');
        selectedProvider = new ConsoleProvider(consoleOptions);
      }
    }

    this.instance = selectedProvider;
    return selectedProvider;
  }

  static getInstance(): EmailProvider {
    if (!this.instance) {
      this.instance = this.create();
    }
    return this.instance;
  }

  static reset(): void {
    this.instance = null;
  }
}