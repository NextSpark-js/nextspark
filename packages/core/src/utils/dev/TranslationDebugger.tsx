'use client'

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { TranslationDebugInfo, DebugNamespaceInfo } from '../../messages/types';

/**
 * Componente de debug para monitorear el estado de las traducciones
 * Solo se muestra en desarrollo para ayudar a diagnosticar problemas de i18n
 * 
 * Para activarlo, agregar ?debug-i18n=true a la URL
 */
export function TranslationDebugger() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [debugInfo, setDebugInfo] = useState<TranslationDebugInfo>({
    locale: '',
    timestamp: '',
    namespaces: {}
  });
  const locale = useLocale();

  // Llamar todos los hooks de traducción en el nivel superior
  // Solo usar namespaces del core para evitar problemas con hooks condicionales
  const tCommon = useTranslations('common');
  const tDashboard = useTranslations('dashboard');
  const tSettings = useTranslations('settings');
  const tAuth = useTranslations('auth');
  const tPublic = useTranslations('public');
  const tValidation = useTranslations('validation');
  const tAdmin = useTranslations('admin');

  // Solo habilitar en desarrollo
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const params = new URLSearchParams(window.location.search);
    setIsEnabled(params.get('debug-i18n') === 'true');
  }, []);

  // Test de traducciones disponibles
  useEffect(() => {
    if (!isEnabled) return;

    const testTranslations = () => {
      const info: TranslationDebugInfo = {
        locale,
        timestamp: new Date().toLocaleTimeString(),
        namespaces: {}
      };

      // Test de namespaces comunes usando las referencias ya creadas
      const namespacesToTest = [
        { name: 'common', t: tCommon },
        { name: 'dashboard', t: tDashboard },
        { name: 'settings', t: tSettings },
        { name: 'auth', t: tAuth },
        { name: 'public', t: tPublic },
        { name: 'validation', t: tValidation },
        { name: 'admin', t: tAdmin }
      ];
      
      namespacesToTest.forEach(({ name: namespace, t }) => {
        try {
          // Test con una key genérica
          const testKeys = ['title', 'description', 'name', 'loading', 'error'];
          info.namespaces[namespace] = {
            available: true,
            testKeys: testKeys.reduce((acc, key) => {
              try {
                const value = t(key);
                acc[key] = value !== key; // Si devuelve la key, no está traducida
              } catch {
                acc[key] = false;
              }
              return acc;
            }, {} as Record<string, boolean>)
          };
        } catch (error) {
          info.namespaces[namespace] = { 
            available: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        }
      });

      setDebugInfo(info);
    };

    testTranslations();
    // Actualizar cada 5 segundos
    const interval = setInterval(testTranslations, 5000);
    return () => clearInterval(interval);
  }, [isEnabled, locale, tCommon, tDashboard, tSettings, tAuth, tPublic, tValidation, tAdmin]);

  if (!isEnabled || process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div 
      style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: 'white',
        padding: '12px',
        borderRadius: '8px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 9999,
        maxWidth: '400px',
        maxHeight: '300px',
        overflow: 'auto',
        border: '2px solid #00ff00',
      }}
    >
      <div style={{ marginBottom: '8px', fontWeight: 'bold', color: '#00ff00' }}>
        🌍 i18n Debug Panel
      </div>
      
      <div style={{ marginBottom: '4px' }}>
        <strong>Locale:</strong> {debugInfo.locale}
      </div>
      
      <div style={{ marginBottom: '4px' }}>
        <strong>Last Check:</strong> {debugInfo.timestamp}
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Namespaces:</strong>
      </div>
      
      {Object.entries(debugInfo.namespaces || {}).map(([namespace, info]: [string, DebugNamespaceInfo]) => (
        <div key={namespace} style={{ marginLeft: '8px', marginBottom: '4px' }}>
          <span style={{ color: info.available ? '#00ff00' : '#ff0000' }}>
            {info.available ? '✓' : '✗'}
          </span>
          <span style={{ marginLeft: '4px' }}>{namespace}</span>
          
          {info.available && info.testKeys && (
            <div style={{ marginLeft: '16px', fontSize: '10px' }}>
              {Object.entries(info.testKeys).map(([key, works]: [string, boolean]) => (
                <span key={key} style={{ 
                  color: works ? '#90EE90' : '#FFB6C1',
                  marginRight: '4px'
                }}>
                  {key}:{works ? '✓' : '✗'}
                </span>
              ))}
            </div>
          )}
          
          {!info.available && (
            <div style={{ marginLeft: '16px', color: '#ff0000', fontSize: '10px' }}>
              Error: {info.error}
            </div>
          )}
        </div>
      ))}
      
      <div style={{ 
        marginTop: '8px', 
        padding: '4px', 
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '4px',
        fontSize: '10px'
      }}>
        Para ocultar: remueve <code>?debug-i18n=true</code> de la URL
      </div>
    </div>
  );
}
