import React from 'react'

/**
 * Wrapper para páginas de auth (versión server para templates con metadata)
 * Server component que puede ser usado en layouts que exportan metadata
 */
export function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
    </>
  );
}
