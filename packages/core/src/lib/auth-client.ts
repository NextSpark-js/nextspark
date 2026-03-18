import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { emailOTPClient } from "better-auth/client/plugins";
import type { auth } from "./auth";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173",
  plugins: [
    inferAdditionalFields<typeof auth>(),
    emailOTPClient(),
  ]
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  sendVerificationEmail,
  emailOtp,
} = authClient;