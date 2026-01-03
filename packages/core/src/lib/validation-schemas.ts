import { z } from 'zod';

/**
 * Dynamic validation schemas with i18n support
 * These functions return Zod schemas with translated validation messages
 */

export function createLoginSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t('validation.email.invalid')),
    password: z.string().min(1, t('validation.password.required')),
  });
}

export function createBaseSignupSchema(t: (key: string) => string) {
  return z.object({
    firstName: z.string().min(2, t('validation.firstName.min')),
    lastName: z.string().min(2, t('validation.lastName.min')),
    email: z.string().email(t('validation.email.invalid')),
    password: z
      .string()
      .min(8, t('validation.password.min'))
      .regex(/[A-Z]/, t('validation.password.uppercase'))
      .regex(/[a-z]/, t('validation.password.lowercase'))
      .regex(/[0-9]/, t('validation.password.number')),
  });
}

export function createSignupSchema(t: (key: string) => string) {
  return createBaseSignupSchema(t).extend({
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('validation.password.match'),
    path: ['confirmPassword'],
  });
}

export function createResetPasswordSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t('validation.email.invalid')),
  });
}

export function createNewPasswordSchema(t: (key: string) => string) {
  return z.object({
    password: z
      .string()
      .min(8, t('validation.password.min'))
      .regex(/[A-Z]/, t('validation.password.uppercase'))
      .regex(/[a-z]/, t('validation.password.lowercase'))
      .regex(/[0-9]/, t('validation.password.number')),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('validation.password.match'),
    path: ['confirmPassword'],
  });
}

export function createChangePasswordSchema(t: (key: string) => string) {
  return z.object({
    currentPassword: z.string().min(1, t('validation.password.currentRequired')),
    newPassword: z
      .string()
      .min(8, t('validation.password.min'))
      .regex(/[A-Z]/, t('validation.password.uppercase'))
      .regex(/[a-z]/, t('validation.password.lowercase'))
      .regex(/[0-9]/, t('validation.password.number')),
    confirmPassword: z.string(),
    revokeOtherSessions: z.boolean().optional(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t('validation.password.match'),
    path: ['confirmPassword'],
  }).refine((data) => data.currentPassword !== data.newPassword, {
    message: t('validation.password.different'),
    path: ['newPassword'],
  });
}

export function createProfileSchema(t: (key: string) => string) {
  return z.object({
    firstName: z.string().min(2, t('validation.firstName.min')),
    lastName: z.string().min(2, t('validation.lastName.min')),
    country: z.string().min(1, t('validation.country.required')),
    timezone: z.string().min(1, t('validation.timezone.required')),
    language: z.string().min(1, t('validation.language.required')),
  });
}

export function createTaskSchema(t: (key: string) => string) {
  return z.object({
    title: z.string().min(1, t('validation.taskTitle.required')).max(200, t('validation.taskTitle.max')),
    description: z.string().max(500, t('validation.taskDescription.max')).optional(),
  });
}

// Type helpers for the dynamic schemas
export type LoginFormData = z.infer<ReturnType<typeof createLoginSchema>>;
export type SignupFormData = z.infer<ReturnType<typeof createSignupSchema>>;
export type ResetPasswordFormData = z.infer<ReturnType<typeof createResetPasswordSchema>>;
export type NewPasswordFormData = z.infer<ReturnType<typeof createNewPasswordSchema>>;
export type ChangePasswordFormData = z.infer<ReturnType<typeof createChangePasswordSchema>>;
export type ProfileFormData = z.infer<ReturnType<typeof createProfileSchema>>;
export type TaskFormData = z.infer<ReturnType<typeof createTaskSchema>>;
