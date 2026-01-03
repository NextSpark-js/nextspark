import type { VerificationEmailData, PasswordResetEmailData, TeamInvitationEmailData } from './types';

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Your App';

export const emailTemplates = {
  verifyEmail: (data: VerificationEmailData) => ({
    subject: `Welcome to ${data.appName || APP_NAME} - Verify Your Email`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
                      <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">${data.appName || APP_NAME}</h1>
                      <p style="color: #ffffff; font-size: 16px; margin: 10px 0 0 0; opacity: 0.95;">Welcome to Your Account</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="color: #333333; font-size: 24px; margin: 0 0 20px 0; font-weight: 600;">Verify Your Email Address</h2>
                      
                      <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Hi${data.userName ? ` ${data.userName}` : ''},
                      </p>
                      
                      <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                        Thank you for signing up! We're excited to have you on board. Please verify your email address to activate your account and get started.
                      </p>
                      
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                        <tr>
                          <td style="border-radius: 6px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                            <a href="${data.verificationUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
                              Verify Email Address
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 30px 0 0 0; padding: 20px; background-color: #f8f8f8; border-radius: 6px;">
                        <strong>Can't click the button?</strong><br>
                        Copy and paste this link into your browser:<br>
                        <span style="color: #667eea; word-break: break-all; font-size: 12px;">${data.verificationUrl}</span>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center;">
                      <p style="color: #999999; font-size: 14px; margin: 0 0 10px 0;">
                        © ${new Date().getFullYear()} ${data.appName || APP_NAME}. All rights reserved.
                      </p>
                      <p style="color: #999999; font-size: 12px; margin: 0;">
                        This email was sent to you because you signed up for ${data.appName || APP_NAME}.
                        <br>If you didn't request this, please ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `
  }),

  resetPassword: (data: PasswordResetEmailData) => ({
    subject: `Reset Your Password - ${data.appName || APP_NAME}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 8px 8px 0 0;">
                      <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">${data.appName || APP_NAME}</h1>
                      <p style="color: #ffffff; font-size: 16px; margin: 10px 0 0 0; opacity: 0.95;">Password Reset Request</p>
                    </td>
                  </tr>
                  
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="color: #333333; font-size: 24px; margin: 0 0 20px 0; font-weight: 600;">Reset Your Password</h2>
                      
                      <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        Hi${data.userName ? ` ${data.userName}` : ''},
                      </p>
                      
                      <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                        We received a request to reset your password for your account. Click the button below to create a new password:
                      </p>
                      
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                        <tr>
                          <td style="border-radius: 6px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
                            <a href="${data.resetUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
                              Reset Password
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <div style="margin: 30px 0; padding: 20px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                        <p style="color: #856404; font-size: 14px; margin: 0; font-weight: 600;">
                          ⚠️ Important Security Information
                        </p>
                        <p style="color: #856404; font-size: 14px; margin: 10px 0 0 0; line-height: 1.5;">
                          This link will expire in <strong>${data.expiresIn || '1 hour'}</strong> for your security.<br>
                          If you didn't request this password reset, please ignore this email and your password will remain unchanged.
                        </p>
                      </div>
                      
                      <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; padding: 20px; background-color: #f8f8f8; border-radius: 6px;">
                        <strong>Can't click the button?</strong><br>
                        Copy and paste this link into your browser:<br>
                        <span style="color: #f5576c; word-break: break-all; font-size: 12px;">${data.resetUrl}</span>
                      </p>
                    </td>
                  </tr>
                  
                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center;">
                      <p style="color: #999999; font-size: 14px; margin: 0 0 10px 0;">
                        © ${new Date().getFullYear()} ${data.appName || APP_NAME}. All rights reserved.
                      </p>
                      <p style="color: #999999; font-size: 12px; margin: 0;">
                        This is an automated security email from ${data.appName || APP_NAME}.
                        <br>For security reasons, we never ask for your password via email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `
  }),

  teamInvitation: (data: TeamInvitationEmailData) => ({
    subject: `You've been invited to join ${data.teamName} on ${data.appName || APP_NAME}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td align="center" style="padding: 40px 0;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="padding: 40px 40px 20px 40px; text-align: center; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); border-radius: 8px 8px 0 0;">
                      <h1 style="color: #ffffff; font-size: 28px; margin: 0; font-weight: 600;">${data.appName || APP_NAME}</h1>
                      <p style="color: #ffffff; font-size: 16px; margin: 10px 0 0 0; opacity: 0.95;">Team Invitation</p>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <h2 style="color: #333333; font-size: 24px; margin: 0 0 20px 0; font-weight: 600;">You're Invited!</h2>

                      <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                        <strong>${data.inviterName}</strong> has invited you to join the team <strong>${data.teamName}</strong> as a <strong>${data.role}</strong>.
                      </p>

                      <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                        Click the button below to accept the invitation and join the team:
                      </p>

                      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 auto;">
                        <tr>
                          <td style="border-radius: 6px; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%);">
                            <a href="${data.acceptUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px;">
                              Accept Invitation
                            </a>
                          </td>
                        </tr>
                      </table>

                      <div style="margin: 30px 0; padding: 20px; background-color: #f0f9ff; border-left: 4px solid #4F46E5; border-radius: 4px;">
                        <p style="color: #1e40af; font-size: 14px; margin: 0; font-weight: 600;">
                          ⏰ Invitation Details
                        </p>
                        <p style="color: #1e40af; font-size: 14px; margin: 10px 0 0 0; line-height: 1.5;">
                          This invitation will expire in <strong>${data.expiresIn}</strong>.<br>
                          If you don't have an account yet, you'll be able to create one when you accept.
                        </p>
                      </div>

                      <p style="color: #999999; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0; padding: 20px; background-color: #f8f8f8; border-radius: 6px;">
                        <strong>Can't click the button?</strong><br>
                        Copy and paste this link into your browser:<br>
                        <span style="color: #4F46E5; word-break: break-all; font-size: 12px;">${data.acceptUrl}</span>
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 30px 40px; background-color: #f8f8f8; border-radius: 0 0 8px 8px; text-align: center;">
                      <p style="color: #999999; font-size: 14px; margin: 0 0 10px 0;">
                        © ${new Date().getFullYear()} ${data.appName || APP_NAME}. All rights reserved.
                      </p>
                      <p style="color: #999999; font-size: 12px; margin: 0;">
                        This invitation was sent to ${data.inviteeEmail}.<br>
                        If you didn't expect this invitation, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `
  })
};

// Mantener compatibilidad con la API anterior
export const createVerificationEmail = (name: string | undefined, verifyUrl: string) => 
  emailTemplates.verifyEmail({
    userName: name || '',
    verificationUrl: verifyUrl,
    appName: APP_NAME
  });

export const createPasswordResetEmail = (name: string | undefined, resetUrl: string) =>
  emailTemplates.resetPassword({
    userName: name || '',
    resetUrl: resetUrl,
    appName: APP_NAME
  });

export const createTeamInvitationEmail = (
  inviteeEmail: string,
  inviterName: string,
  teamName: string,
  role: string,
  acceptUrl: string,
  expiresIn: string = '7 days'
) =>
  emailTemplates.teamInvitation({
    inviteeEmail,
    inviterName,
    teamName,
    role,
    acceptUrl,
    expiresIn,
    appName: APP_NAME
  });