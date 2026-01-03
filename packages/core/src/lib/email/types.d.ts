export interface EmailOptions {
    from?: string;
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
    replyTo?: string;
    cc?: string | string[];
    bcc?: string | string[];
    attachments?: EmailAttachment[];
    headers?: Record<string, string>;
}
export interface EmailAttachment {
    filename: string;
    content: Buffer | string;
    contentType?: string;
}
export interface EmailResponse {
    id: string;
    success: boolean;
    error?: string;
}
export interface EmailProvider {
    send(options: EmailOptions): Promise<EmailResponse>;
    verify?(): Promise<boolean>;
}
export interface EmailTemplateData {
    [key: string]: string | number | boolean | undefined;
}
export interface VerificationEmailData extends EmailTemplateData {
    userName: string;
    verificationUrl: string;
    appName: string;
}
export interface PasswordResetEmailData extends EmailTemplateData {
    userName: string;
    resetUrl: string;
    appName: string;
    expiresIn?: string;
}
export interface WelcomeEmailData extends EmailTemplateData {
    userName: string;
    appName: string;
    loginUrl: string;
}
export interface TeamInvitationEmailData extends EmailTemplateData {
    inviteeEmail: string;
    inviterName: string;
    teamName: string;
    role: string;
    acceptUrl: string;
    expiresIn: string;
    appName: string;
}
//# sourceMappingURL=types.d.ts.map