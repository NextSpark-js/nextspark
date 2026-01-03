'use client'

import { useContextAwareTranslations } from '../hooks/useContextAwareTranslations';
import { useEffect } from 'react';

/**
 * Componente para gestionar el contexto de traducciones y carga dinámica
 * Se integra en el layout principal para manejar transiciones entre contextos
 */
export function TranslationContextManager() {
  const { currentContext, loadedNamespaces } = useContextAwareTranslations();

  // Debug en desarrollo
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[TranslationContextManager] 📍 Current context: ${currentContext}`);
      console.log(`[TranslationContextManager] 📦 Loaded namespaces:`, loadedNamespaces);
    }
  }, [currentContext, loadedNamespaces]);

  // Este componente no renderiza nada, solo gestiona traducciones
  return null;
}

