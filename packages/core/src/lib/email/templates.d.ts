import type { VerificationEmailData, PasswordResetEmailData, TeamInvitationEmailData } from './types';
export declare const emailTemplates: {
    verifyEmail: (data: VerificationEmailData) => {
        subject: string;
        html: string;
    };
    resetPassword: (data: PasswordResetEmailData) => {
        subject: string;
        html: string;
    };
    teamInvitation: (data: TeamInvitationEmailData) => {
        subject: string;
        html: string;
    };
};
export declare const createVerificationEmail: (name: string | undefined, verifyUrl: string) => {
    subject: string;
    html: string;
};
export declare const createPasswordResetEmail: (name: string | undefined, resetUrl: string) => {
    subject: string;
    html: string;
};
export declare const createTeamInvitationEmail: (inviteeEmail: string, inviterName: string, teamName: string, role: string, acceptUrl: string, expiresIn?: string) => {
    subject: string;
    html: string;
};
//# sourceMappingURL=templates.d.ts.map