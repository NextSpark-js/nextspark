import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import {
  createLoginSchema,
  createSignupSchema,
  createResetPasswordSchema,
  createNewPasswordSchema,
  createChangePasswordSchema,
  createProfileSchema,
  createTaskSchema,
} from '../lib/validation-schemas';

/**
 * Hook that provides Zod validation schemas with translated error messages
 * Uses useMemo to prevent unnecessary re-creation of schemas
 */
export function useValidationSchemas() {
  const t = useTranslations('validation');

  const schemas = useMemo(() => ({
    login: createLoginSchema(t),
    signup: createSignupSchema(t),
    resetPassword: createResetPasswordSchema(t),
    newPassword: createNewPasswordSchema(t),
    changePassword: createChangePasswordSchema(t),
    profile: createProfileSchema(t),
    task: createTaskSchema(t),
  }), [t]);

  return schemas;
}
