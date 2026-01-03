'use client'

import React from 'react'
import { AuthTranslationPreloader } from '../../../lib/i18n/AuthTranslationPreloader'

/**
 * Wrapper para páginas de auth con precarga de traducciones
 * Client component que incluye funcionalidad de precarga
 */
export function AuthWrapperWithPreload({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthTranslationPreloader />
      {children}
    </>
  );
}