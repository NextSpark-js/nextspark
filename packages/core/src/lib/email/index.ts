// Main email module exports
export * from './types';
export * from './factory';
export * from './templates';
export {
  sendVerifyEmail,
  sendResetPasswordEmail,
  sendOtpVerificationEmail,
  sendMagicLinkEmail,
  sendTeamInvitationEmail,
} from './send';
