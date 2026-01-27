/**
 * API Library - Public API functionality
 * 
 * This module exports all the core functionality for the public API system,
 * including authentication, rate limiting, caching, and utilities.
 */

// Core API functionality
export * from './auth';
export * from './auth/dual-auth';
export * from './keys';
export * from './helpers';
export * from './rate-limit';
export * from './cache';
export * from './distributed-cache';

// Re-export commonly used types and utilities
export type { ApiKeyAuth, ApiKeyValidationResult } from './auth';
export type { ApiScope } from './keys';
