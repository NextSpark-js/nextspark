export declare function useAuth(): {
    user: any;
    session: any;
    isLoading: any;
    signIn: ({ email, password, redirectTo }: {
        email: string;
        password: string;
        redirectTo?: string;
    }) => Promise<any>;
    signUp: ({ email, password, firstName, lastName }: {
        email: string;
        password: string;
        firstName?: string;
        lastName?: string;
    }) => Promise<any>;
    signOut: () => Promise<void>;
    googleSignIn: (redirectTo?: string) => Promise<void>;
    resetPassword: (email: string) => Promise<{
        success: boolean;
        data: any;
        error: any;
    } | {
        success: boolean;
        data: any;
        error: any;
    }>;
    updatePassword: (newPassword: string, token?: string) => Promise<{
        success: boolean;
        data: any;
        error: any;
    } | {
        success: boolean;
        data: any;
        error: any;
    }>;
    changePassword: (currentPassword: string, newPassword: string, revokeOtherSessions?: boolean) => Promise<{
        success: boolean;
        data: any;
        error: any;
    } | {
        success: boolean;
        data: any;
        error: any;
    }>;
    resendVerificationEmail: (email: string) => Promise<{
        success: boolean;
        data: any;
        error: any;
    } | {
        success: boolean;
        data: any;
        error: any;
    }>;
    isSigningIn: boolean;
    isSigningUp: boolean;
    signInError: any;
    signUpError: any;
};
//# sourceMappingURL=useAuth.d.ts.map