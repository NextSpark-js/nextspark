import type { Transporter } from 'nodemailer'
import type { EmailProvider, EmailOptions, EmailResponse } from '../types'
import type { SmtpConfig } from '../smtp-config'

/**
 * nodemailer is an optional peer of @nextsparkjs/core: only projects that set
 * EMAIL_PROVIDER=smtp install it. The import is lazy and its specifier is
 * fixed; the ignore comments keep webpack and Turbopack from resolving it at
 * build time, so a project without nodemailer still builds. It is resolved by
 * Node at runtime, from the project's own node_modules.
 */
async function loadNodemailer(): Promise<typeof import('nodemailer')> {
  try {
    return await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ 'nodemailer')
  } catch (error) {
    const code = (error as { code?: string }).code
    if (
      (code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') &&
      /['"]nodemailer['"]/.test((error as Error).message)
    ) {
      throw new Error(
        'EMAIL_PROVIDER=smtp needs the nodemailer package, which is not installed. Run `pnpm add nodemailer`.'
      )
    }
    throw error
  }
}

export class SmtpProvider implements EmailProvider {
  private transporter?: Promise<Transporter>

  constructor(
    private readonly config: SmtpConfig,
    private readonly defaultFrom: string
  ) {}

  private getTransporter(): Promise<Transporter> {
    this.transporter ??= loadNodemailer()
      .then((nodemailer) => nodemailer.createTransport(this.config))
      .catch((error) => {
        // A failed load must not be cached: installing the package and retrying should work.
        this.transporter = undefined
        throw error
      })
    return this.transporter
  }

  async send(options: EmailOptions): Promise<EmailResponse> {
    try {
      if (!options.html && !options.text) {
        throw new Error('Either html or text content must be provided')
      }

      const info = await (await this.getTransporter()).sendMail({
        from: options.from || this.defaultFrom,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        cc: options.cc,
        bcc: options.bcc,
        headers: options.headers,
        attachments: options.attachments,
      })

      return { id: info.messageId || '', success: true }
    } catch (error) {
      console.error('SmtpProvider error:', error)
      return {
        id: '',
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send email',
      }
    }
  }

  async verify(): Promise<boolean> {
    try {
      return Boolean(await (await this.getTransporter()).verify())
    } catch (error) {
      console.error('SmtpProvider verification failed:', error)
      return false
    }
  }
}
