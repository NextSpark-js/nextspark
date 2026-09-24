# 🔧 Core Configuration System

Esta carpeta contiene el **sistema core de configuración** que define la estructura y lógica de configuración, pero **no los valores específicos del proyecto**.

## 📁 Estructura

```
core/lib/config/
├── config-types.ts         # Interfaces y tipos base
├── config-utils.ts         # Utilidades de validación y helpers  
├── config-loader.ts        # Cargador de configuración asíncrono
├── config-sync.ts          # Acceso síncrono para tipos y constantes
├── index.ts                # Re-exportaciones principales
└── README.md               # Esta documentación
```

## 🎯 Principio: Core vs Contents

### **❌ NO modificar este directorio**
- El código aquí es **core inmutable**
- Se actualiza con el boilerplate
- Proporciona la **estructura y lógica**
- Define **cómo** funciona la configuración

### **✅ SÍ modificar `config/`**
- Contiene los **valores específicos** de tu proyecto
- Define **qué valores** tiene tu configuración
- Tu personalización está protegida de actualizaciones

## 🔄 Cómo funciona

### **1. Carga Asíncrona (Recomendada)**
```typescript
import { getApplicationConfig } from '@/core/lib/config'

// En componentes server o funciones async
const config = await getApplicationConfig()
console.log(config.app.name) // Tu nombre de aplicación
```

### **2. Acceso Síncrono (Para tipos)**
```typescript
import { I18N_CONFIG, APP_CONFIG, type SupportedLocale } from '@/core/lib/config'

// Para tipos y constantes que necesitas síncronamente
const defaultLocale: SupportedLocale = I18N_CONFIG.defaultLocale
```

### **3. Validación Automática**
```typescript
import { validateApplicationConfig } from '@/core/lib/config'

const validation = validateApplicationConfig(config)
if (!validation.valid) {
  console.error('Errors:', validation.errors)
}
```

## 🛠️ Utilidades Disponibles

### **Helpers de Environment**
```typescript
import { getEnvConfig, isDevelopment, isProduction } from '@/core/lib/config'

const envConfig = getEnvConfig(config)
if (isDevelopment()) {
  // Lógica de desarrollo
}
```

### **Helpers de CORS**
```typescript
import { getAllowedCorsOrigins, isCorsAllowAllOrigins } from '@/core/lib/config'

const origins = getAllowedCorsOrigins(config)
const allowAll = isCorsAllowAllOrigins(config)
```

### **Helpers de Roles**
```typescript
import { hasRolePermission, getRoleHierarchy } from '@/core/lib/config'

const canAccess = hasRolePermission(config, 'member', 'admin')
const level = getRoleHierarchy(config, 'admin')
```

## 🔍 Debugging

### **Debug en Development**
```typescript
import { debugConfig } from '@/core/lib/config'

// Solo se ejecuta en development
debugConfig(config) // Logs completos de configuración
```

### **Validación Manual**
```typescript
import { validateI18nConfig, validateApplicationConfig } from '@/core/lib/config'

// Validar secciones específicas
const i18nValidation = validateI18nConfig(config.i18n)

// Validar configuración completa
const fullValidation = validateApplicationConfig(config)
```

## 📋 Tipos Disponibles

```typescript
// Importar tipos desde aquí
import type {
  ApplicationConfig,
  I18nConfig,
  UserRolesConfig,
  FeaturesConfig,
  ApiConfig,
  UiConfig,
  SupportedLocale,
  TranslationNamespace,
  UserRole
} from '@/core/lib/config'
```

## ⚠️ Importante

1. **No modificar archivos aquí** - Son parte del core inmutable
2. **Usar `config/`** para valores específicos del proyecto
3. **El loader automático** maneja la carga y validación
4. **Cache incorporado** evita cargas repetidas
5. **Fallback automático** en caso de errores de configuración

## 🔄 Migration Path

Si estás migrando desde el sistema anterior:

```typescript
// ❌ Antes
import { APP_CONFIG } from '@/core/config/app.config'

// ✅ Ahora
import { getApplicationConfig } from '@/core/lib/config'
const config = await getApplicationConfig()
const appConfig = config.app

// ✅ O para acceso síncrono
import { APP_CONFIG } from '@/core/lib/config'
```

La nueva arquitectura garantiza separación limpia entre core y contenido personalizable.
