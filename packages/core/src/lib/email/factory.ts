import type { EmailProvider } from './types';
import { ResendProvider } from './providers/resend';
import { ConsoleProvider } from './providers/console';

export type EmailProviderType = 'resend' | 'console' | 'auto';

export interface EmailFactoryOptions {
  provider?: EmailProviderType;
  resendApiKey?: string;
  defaultFrom?: string;
  consoleOptions?: {
    enabled?: boolean;
    logLevel?: 'full' | 'summary' | 'links-only';
  };
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
      selectedProvider = new ConsoleProvider(consoleOptions);
    } else if (provider === 'resend') {
      if (!resendApiKey) {
        throw new Error('Resend API key is required when using Resend provider');
      }
      selectedProvider = new ResendProvider(resendApiKey, defaultFrom);
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
      } else {
        // Si no hay API key en producción, lanzar error
        if (process.env.NODE_ENV === 'production') {
          throw new Error('Email provider API key is required in production');
        }
        // En otros entornos, usar console como fallback
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