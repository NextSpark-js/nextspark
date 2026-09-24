# 📊 Amplitude Analytics Plugin

> **Enterprise-grade user analytics and behavioral tracking plugin for NextSpark applications**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](./package.json)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.0+-61dafb.svg)](https://reactjs.org/)
[![Test Coverage](https://img.shields.io/badge/coverage-90%25-brightgreen.svg)](#testing)

## 🎯 **Características Principales**

### **📈 Analytics Avanzado**
- **Auto-tracking inteligente** de page views, clicks, forms y navegación SPA
- **Event batching** optimizado para performance con cola offline
- **Real-time dashboards** con métricas de negocio y técnicas
- **Cache LRU con TTL** para optimización de performance

### **🔒 Seguridad y Privacidad Enterprise**
- **Gestión de consentimiento GDPR/CCPA** granular por categoría
- **Enmascaramiento automático de PII** con 13+ patrones de detección
- **Rate limiting** con sliding window (1000 eventos/minuto)
- **Audit logging** con retención configurable y severidad

### **🧪 A/B Testing y Experimentación**
- **Asignación determinística** con sticky sessions por user/device/session
- **Statistical significance** calculation con confidence intervals
- **Targeting avanzado** por propiedades, geolocation, device type
- **Exposure y conversion tracking** automático

### **🎬 Session Replay**
- **Grabación privacy-first** con masking automático de elementos sensibles
- **Sampling inteligente** para optimización de performance
- **Selective recording** con páginas excluidas configurables
- **Compression y batching** para transmisión eficiente

### **🎨 Integración con Temas**
- **Theme-aware components** que respetan el design system
- **CSS custom properties** para integración seamless
- **Component overrides** a través del sistema de temas
- **Dark mode support** automático

### **🌍 Internacionalización**
- **Plugin translation namespace** (`plugins.amplitude.*`)
- **Soporte completo English/Spanish** con 200+ strings
- **Fallback automático** para keys faltantes
- **Integration con sistema i18n** de la aplicación

## 🚀 **Instalación y Configuración**

### **1. Configuración Básica**

```typescript
// plugins/amplitude/plugin.config.ts
import { amplitudePlugin } from './plugin.config';

const config = {
  apiKey: 'your-amplitude-api-key-32-chars',
  serverZone: 'US', // or 'EU'
  enableSessionReplay: true,
  enableABTesting: true,
  enableConsentManagement: true,
  debugMode: false, // Set to true for development
};
```

### **2. Provider Setup**

```tsx
// app/layout.tsx
import { AmplitudeProvider } from '@/plugins/amplitude/providers/AmplitudeProvider';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AmplitudeProvider overrideConfig={config}>
          {children}
        </AmplitudeProvider>
      </body>
    </html>
  );
}
```

### **3. Hook Usage**

```tsx
// components/YourComponent.tsx
import { useAmplitude } from '@/plugins/amplitude/hooks/useAmplitude';

export function YourComponent() {
  const { track, identify, isInitialized } = useAmplitude();

  const handleClick = async () => {
    await track('Button Clicked', {
      buttonId: 'cta-signup',
      page: '/home',
      user_plan: 'free'
    });
  };

  const handleUserLogin = async (userId: string) => {
    await identify(userId, {
      plan: 'premium',
      signup_date: new Date().toISOString(),
      feature_flags: ['new_ui', 'advanced_analytics']
    });
  };

  if (!isInitialized) {
    return <div>Loading analytics...</div>;
  }

  return (
    <button onClick={handleClick}>
      Track This Click
    </button>
  );
}
```

## 📋 **API Reference**

### **useAmplitude Hook**

```typescript
const {
  track,           // (eventType: string, properties?: object) => Promise<void>
  identify,        // (userId: string, properties?: object) => Promise<void>
  setUserProperties, // (properties: object) => Promise<void>
  reset,           // () => void
  isInitialized,   // boolean
  context,         // { config, consent, error }
  lastError        // Error | null
} = useAmplitude();
```

### **useExperiment Hook**

```typescript
const {
  getVariant,      // (experimentId: string, userId: string) => string | null
  trackExposure,   // (experimentId: string, variantId?: string) => Promise<void>
  trackConversion, // (experimentId: string, metricId?: string, value?: number) => Promise<void>
  isInExperiment,  // (experimentId: string, userId: string) => boolean
  registerExperiment, // (config: ExperimentConfig) => void
  canRunExperiments   // boolean
} = useExperiment();
```

### **useSessionReplay Hook**

```typescript
const {
  startRecording,  // () => Promise<boolean>
  stopRecording,   // () => Promise<void>
  pauseRecording,  // () => void
  resumeRecording, // () => void
  isRecording,     // boolean
  canRecord,       // boolean
  recordingState,  // RecordingState object
  privacyControls  // PrivacyControls object
} = useSessionReplay();
```

## 🧪 **A/B Testing y Experimentos**

### **Configuración de Experimento**

```typescript
// Registrar experimento
const experimentConfig = {
  id: 'checkout-flow-v2',
  name: 'New Checkout Flow',
  status: 'running',
  variants: [
    { 
      id: 'control', 
      name: 'Original Checkout', 
      allocation: 50, 
      isControl: true,
      config: { showProgressBar: false, steps: 3 }
    },
    { 
      id: 'treatment', 
      name: 'Streamlined Checkout', 
      allocation: 50, 
      isControl: false,
      config: { showProgressBar: true, steps: 2 }
    }
  ],
  targeting: {
    userProperties: { plan: 'premium' },
    deviceType: ['desktop', 'mobile']
  },
  startDate: new Date(),
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  sampleSize: 10000,
  confidenceLevel: 0.95
};

registerExperiment(experimentConfig);
```

### **Uso con Componentes**

```tsx
// Declarative A/B Testing
import { ExperimentWrapper, ABTest, FeatureFlag } from '@/plugins/amplitude/components/ExperimentWrapper';

// Wrapper básico
<ExperimentWrapper 
  experimentId="checkout-flow-v2"
  trackExposureOnMount={true}
>
  {(variant, config) => (
    variant === 'treatment' ? 
      <StreamlinedCheckout config={config} /> : 
      <OriginalCheckout config={config} />
  )}
</ExperimentWrapper>

// A/B Test simplificado
<ABTest 
  experimentId="button-color-test"
  variants={{
    control: <button className="btn-blue">Sign Up</button>,
    red: <button className="btn-red">Sign Up</button>,
    green: <button className="btn-green">Sign Up</button>
  }}
/>

// Feature Flag
<FeatureFlag flag="new-dashboard">
  <NewDashboard />
</FeatureFlag>
```

### **Tracking de Conversiones**

```typescript
// En el componente de checkout
const { trackConversion } = useExperiment();

const handlePurchaseComplete = async (orderValue: number) => {
  await trackConversion('checkout-flow-v2', 'purchase', orderValue);
};
```

## 🎬 **Session Replay**

### **Configuración de Privacidad**

```typescript
const sessionReplayConfig = {
  enabled: true,
  sampleRate: 0.1, // 10% de sesiones
  privacyMode: 'balanced', // 'strict' | 'balanced' | 'permissive'
  maskAllInputs: true,
  blockSelector: [
    '[data-private]',
    '.sensitive-data',
    '#credit-card-form'
  ],
  maskSelector: [
    'input[type="email"]',
    '.user-details',
    '[data-mask]'
  ],
  ignoredPages: ['/admin', '/payment']
};
```

### **Control Programático**

```tsx
import { useSessionReplay } from '@/plugins/amplitude/hooks/useSessionReplay';

function SessionControls() {
  const { 
    startRecording, 
    stopRecording, 
    isRecording, 
    recordingState 
  } = useSessionReplay();

  return (
    <div>
      <p>Recording: {isRecording ? 'Active' : 'Stopped'}</p>
      <p>Duration: {recordingState.duration}ms</p>
      <p>Events: {recordingState.eventsCount}</p>
      
      <button onClick={startRecording}>Start Recording</button>
      <button onClick={stopRecording}>Stop Recording</button>
    </div>
  );
}
```

## 🔒 **Gestión de Consentimiento**

### **ConsentManager Component**

```tsx
import { ConsentManager, useConsent } from '@/plugins/amplitude/components/ConsentManager';

function App() {
  const { 
    isConsentModalOpen, 
    openConsentModal, 
    closeConsentModal,
    hasConsent,
    getConsentStatus 
  } = useConsent();

  return (
    <>
      <button onClick={openConsentModal}>
        Privacy Settings
      </button>
      
      <ConsentManager
        isOpen={isConsentModalOpen}
        onClose={closeConsentModal}
        onConsentChange={(consent) => {
          console.log('Consent updated:', consent);
        }}
        position="center"
        showBadge={true}
      />
      
      {hasConsent('analytics') && (
        <AnalyticsComponents />
      )}
    </>
  );
}
```

### **Estados de Consentimiento**

```typescript
// Verificar consentimiento específico
if (hasConsent('sessionReplay')) {
  // Iniciar session replay
}

// Obtener estado completo
const status = getConsentStatus();
console.log(`${status.granted}/${status.total} categorías habilitadas`);
console.log(`${status.percentage}% de consentimiento`);
```

## 📊 **Dashboard y Monitoring**

### **Analytics Dashboard**

```tsx
import { AnalyticsDashboard } from '@/plugins/amplitude/components/AnalyticsDashboard';

<AnalyticsDashboard
  refreshInterval={30000}  // 30 segundos
  showAdvancedMetrics={true}
  timeRange="24h"
  compactMode={false}
/>
```

### **Performance Monitor**

```tsx
import { PerformanceMonitor } from '@/plugins/amplitude/components/PerformanceMonitor';

<PerformanceMonitor
  refreshInterval={5000}   // 5 segundos
  showAlerts={true}
  showCharts={true}
  alertThresholds={{
    errorRate: 0.05,      // 5%
    memoryUsageMB: 100,
    latencyMs: 1000,
    queueSize: 1000
  }}
  onAlert={(alert) => {
    console.warn('Performance Alert:', alert);
    // Enviar a sistema de alertas
  }}
/>
```

## 🧪 **Testing**

### **Ejecutar Tests**

```bash
# Tests unitarios
npm test

# Tests con watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Type checking
npm run type-check
```

### **Mock para Testing**

```typescript
// __tests__/setup.ts
jest.mock('@/plugins/amplitude/hooks/useAmplitude', () => ({
  useAmplitude: () => ({
    track: jest.fn().mockResolvedValue(undefined),
    identify: jest.fn().mockResolvedValue(undefined),
    isInitialized: true,
    context: { config: mockConfig, consent: mockConsent, error: null }
  })
}));
```

## 🎨 **Personalización y Temas**

### **CSS Custom Properties**

```css
/* Personalizar colores del plugin */
:root {
  --amplitude-primary: #3b82f6;
  --amplitude-success: #10b981;
  --amplitude-warning: #f59e0b;
  --amplitude-error: #ef4444;
}

/* Dark mode */
[data-theme="dark"] {
  --amplitude-bg-primary: #1f2937;
  --amplitude-text-primary: #f9fafb;
}
```

### **Component Overrides**

```tsx
// Sistema de temas (ejemplo)
const themeOverrides = {
  'amplitude.consent': {
    Modal: CustomModal,
    Button: CustomButton,
    Card: CustomCard
  }
};
```

## 🔧 **Configuración Avanzada**

### **Plugin Configuration Schema**

```typescript
const advancedConfig = {
  // API Configuration
  apiKey: 'your-32-char-api-key',
  serverZone: 'US' | 'EU',
  
  // Features
  enableSessionReplay: true,
  enableABTesting: true,
  enableConsentManagement: true,
  
  // Performance
  batchSize: 30,              // Events per batch
  flushInterval: 10000,       // ms between flushes
  sampleRate: 1.0,            // 0-1 sampling rate
  
  // Security
  piiMaskingEnabled: true,
  rateLimitEventsPerMinute: 1000,
  errorRetryAttempts: 3,
  errorRetryDelayMs: 1000,
  
  // Debug
  debugMode: false,
};
```

### **Event Queue Configuration**

```typescript
const queueConfig = {
  maxSize: 10000,
  batchSize: 30,
  flushIntervalMs: 10000,
  maxRetries: 3,
  enablePersistence: true,
  priorityQueueEnabled: true
};
```

### **Cache Configuration**

```typescript
const cacheConfig = {
  maxSize: 5000,
  defaultTtlMs: 30 * 60 * 1000, // 30 minutos
  maxMemoryMB: 20,
  enablePersistence: true
};
```

## 🚨 **Troubleshooting**

### **Problemas Comunes**

#### **Plugin no inicializa**
```typescript
// Verificar API key
console.log('API Key length:', config.apiKey.length); // Debe ser 32
console.log('API Key format:', /^[a-zA-Z0-9]{32}$/.test(config.apiKey));

// Verificar contexto
const { error, isInitialized } = useAmplitudeContext();
if (error) console.error('Amplitude Error:', error);
```

#### **Eventos no se envían**
```typescript
// Verificar consentimiento
const { consent } = useAmplitudeContext();
console.log('Analytics consent:', consent.analytics);

// Verificar rate limiting
import { rateLimiter } from '@/plugins/amplitude/lib/security';
console.log('Rate limit OK:', rateLimiter.checkRateLimit('user-id'));
```

#### **Performance Issues**
```typescript
// Verificar métricas
import { getPerformanceStats } from '@/plugins/amplitude/lib/performance';
const stats = getPerformanceStats();
console.log('Memory usage:', stats.amplitudeCore.memoryUsage);
console.log('Queue size:', stats.amplitudeCore.eventQueueSize);
```

### **Debug Mode**

```typescript
// Habilitar debug mode
const debugConfig = {
  ...config,
  debugMode: true
};

// Logs adicionales en consola
// Performance metrics detalladas
// Event tracking verbose
// Error reporting extendido
```

## 📈 **Performance y Optimización**

### **Métricas Monitoreadas**
- **Initialization Time**: < 50ms
- **Event Processing**: < 10ms promedio
- **Memory Usage**: < 5MB máximo
- **Cache Hit Rate**: > 85%
- **Error Rate**: < 1%

### **Best Practices**
1. **Batch events** en lugar de enviar individualmente
2. **Use consent management** para compliance automático
3. **Configure sampling** para session replay (10-30%)
4. **Monitor performance** con alertas automáticas
5. **Test thoroughly** con coverage > 90%

## 🏗️ **Arquitectura**

```
plugins/amplitude/
├── plugin.config.ts          # Configuración principal
├── types/amplitude.types.ts   # Tipos TypeScript
├── providers/                 # React Providers
├── hooks/                     # Custom Hooks
├── components/               # UI Components
├── lib/                      # Core Logic
│   ├── amplitude-core.ts     # Amplitude SDK Wrapper
│   ├── performance.ts        # Performance Monitoring
│   ├── security.ts           # Security & Privacy
│   ├── queue.ts              # Event Queue System
│   └── cache.ts              # LRU Cache with TTL
├── utils/                    # Utilities
├── translations/             # i18n Files
├── styles/                   # CSS Styles
└── __tests__/                # Test Suite
```

## 📄 **License**

MIT License - ver [LICENSE](./LICENSE) para detalles completos.

## 🤝 **Contributing**

1. Fork el repositorio
2. Crear feature branch (`git checkout -b feature/amazing-feature`)
3. Commit cambios (`git commit -m 'Add amazing feature'`)
4. Push al branch (`git push origin feature/amazing-feature`)
5. Crear Pull Request

## 📞 **Soporte**

- **Issues**: [GitHub Issues](https://github.com/your-org/nextspark/issues)
- **Docs**: [Plugin Documentation](./docs/)
- **Team**: NextSpark Development Team

---

**🎊 Resultado**: Plugin de analytics enterprise-grade, completamente modular, que valida la arquitectura WordPress-like y establece la base para un ecosistema de plugins escalable.
