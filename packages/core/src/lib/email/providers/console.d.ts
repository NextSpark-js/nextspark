import type { EmailProvider, EmailOptions, EmailResponse } from '../types';
export declare class ConsoleProvider implements EmailProvider {
    private enabled;
    private logLevel;
    constructor(options?: {
        enabled?: boolean;
        logLevel?: 'full' | 'summary' | 'links-only';
    });
    send(options: EmailOptions): Promise<EmailResponse>;
    verify(): Promise<boolean>;
    private extractLinks;
}
//# sourceMappingURL=console.d.ts.map