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

/**
 * Output shape every email template function returns.
 *
 * The shipping `EmailFactory` consumes `subject` and `html` directly when
 * dispatching via Resend or the console provider. `text` is reserved for
 * future plain-text fallback support and is currently optional.
 */
export interface EmailContent {
  subject: string;
  html: string;
  text?: string;
}

/**
 * Contract every email template file (core default or theme override) must
 * export as its default export.
 *
 * - `data`: template-specific input shape (e.g. `VerificationEmailData`).
 * - `locale`: optional BCP47 code; templates that integrate i18n use it to
 *   fetch translated copy via `getTranslations({ locale, namespace })`.
 *
 * Returning a `Promise` is fully supported so locale-aware templates can
 * `await getTranslations(...)`.
 */
export type EmailTemplateFn<TData extends EmailTemplateData> = (
  data: TData,
  locale?: string,
) => EmailContent | Promise<EmailContent>;

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

/**
 * @deprecated Orphaned type — no template implementation in core or any
 * theme as of 0.1.0-beta.149. Either implement a `welcome-email` template
 * (drop a file at `packages/core/src/emails/welcome-email.ts` exporting
 * `EmailTemplateFn<WelcomeEmailData>`) or remove this interface in a
 * follow-up cleanup. Kept exported for now to avoid breaking any
 * out-of-tree consumer that imports the type.
 */
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

export interface OtpVerificationEmailData extends EmailTemplateData {
  email: string;
  otp: string;
  type: string;
  appName: string;
}