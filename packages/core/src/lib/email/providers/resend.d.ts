import type { EmailProvider, EmailOptions, EmailResponse } from '../types';
export declare class ResendProvider implements EmailProvider {
    private client;
    private defaultFrom;
    constructor(apiKey: string, defaultFrom?: string);
    send(options: EmailOptions): Promise<EmailResponse>;
    verify(): Promise<boolean>;
}
//# sourceMappingURL=resend.d.ts.map