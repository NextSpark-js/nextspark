import type { EmailProvider } from './types';
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
export declare class EmailFactory {
    private static instance;
    static create(options?: EmailFactoryOptions): EmailProvider;
    static getInstance(): EmailProvider;
    static reset(): void;
}
//# sourceMappingURL=factory.d.ts.map