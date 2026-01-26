/**
 * Base User interface - Platform agnostic
 * Does NOT depend on app.config.ts or any runtime configuration
 */
export interface BaseUser {
  id: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  image?: string;
  emailVerified?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}
