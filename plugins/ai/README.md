# AI Plugin

Plugin empresarial de IA con soporte multi-modelo, generación de contenido, y características de seguridad. Diseñado para integrarse dinámicamente con el sistema de entidades y plugins.

## Características

### 🤖 Soporte Multi-Modelo
- **Locales**: Ollama, LM Studio, LocalAI
- **Cloud**: OpenAI, Anthropic, Groq
- **Selección automática** basada en casos de uso
- **Fallback estratégico** cuando los modelos no están disponibles

### 🎯 Generación de Contenido
- **Templates flexibles** para diferentes tipos de contenido
- **Optimización por plataforma** (Twitter, Instagram, LinkedIn, etc.)
- **Generación de variantes** automática
- **Sugerencias basadas en IA**

### 🛡️ Características de Seguridad
- **Detección de PII** automática
- **Filtros de contenido** tóxico
- **Enmascaramiento de datos** sensibles
- **Cumplimiento GDPR/CCPA**

### 💰 Gestión de Costos
- **Seguimiento de tokens** en tiempo real
- **Estimación de costos** por solicitud
- **Límites de cuota** configurables
- **Rate limiting** dinámico

### 🔌 Integración con Entidades
- **Procesamiento dinámico** de cualquier tipo de entidad
- **Análisis automático** de contenido
- **Mejora inteligente** de datos
- **Sugerencias contextuales**

## Instalación y Configuración

### ⭐ Nuevo: Variables de Entorno a Nivel de Plugin

**¡Ahora puedes configurar el plugin con variables de entorno específicas!**

1. **Copia el archivo de ejemplo:**
   ```bash
   cp contents/plugins/ai/.env.example contents/plugins/ai/.env
   ```

2. **Configura tus claves API:**
   ```env
   # API Keys
   ANTHROPIC_API_KEY=sk-ant-api03-tu_clave_anthropic
   OPENAI_API_KEY=sk-tu_clave_openai

   # Configuración del Plugin
   AI_PLUGIN_ENABLED=true
   AI_PLUGIN_DEBUG=false
   AI_PLUGIN_DEFAULT_PROVIDER=ollama

   # Ollama (Modelos Locales)
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_DEFAULT_MODEL=llama3.2:3b

   # Gestión de Costos
   AI_PLUGIN_COST_TRACKING_ENABLED=true
   AI_PLUGIN_DAILY_COST_LIMIT=10.00
   AI_PLUGIN_MONTHLY_COST_LIMIT=100.00
   ```

### Ventajas de la Configuración a Nivel de Plugin

- ✅ **Aislamiento**: Configuración específica del plugin sin contaminar `.env` principal
- ✅ **Modularidad**: Cada plugin maneja sus propias variables de entorno
- ✅ **Seguridad**: Las claves API están contenidas en el ámbito del plugin
- ✅ **Flexibilidad**: Diferentes plugins pueden usar diferentes claves API
- ✅ **Fallback**: Recurre a variables de entorno del sistema si no existe `.env` del plugin

### Variables de Entorno del Sistema (Método Anterior)

También puedes usar variables de entorno globales:

```env
# OpenAI
OPENAI_API_KEY=tu_clave_openai

# Anthropic
ANTHROPIC_API_KEY=tu_clave_anthropic

# Groq
GROQ_API_KEY=tu_clave_groq

# Configuración local (opcional)
OLLAMA_BASE_URL=http://localhost:11434
LM_STUDIO_BASE_URL=http://localhost:1234
```

### Configuración del Plugin

El plugin se registra automáticamente en el sistema y carga su configuración desde:

1. **Primera prioridad**: `contents/plugins/ai/.env` (archivo específico del plugin)
2. **Segunda prioridad**: Variables de entorno del sistema (`process.env`)
3. **Tercera prioridad**: Valores por defecto incorporados

## Uso

### 1. Componentes React

#### AIProvider
Proveedor de contexto para toda la funcionalidad de IA:

\`\`\`tsx
import { AIProvider } from '@/contents/plugins/ai/components/AIProvider'

function App() {
  return (
    <AIProvider
      userId="user123"
      preferLocal={false}
      autoSelect={true}
    >
      <YourApp />
    </AIProvider>
  )
}
\`\`\`

#### AIChat
Interfaz de chat con IA integrada:

\`\`\`tsx
import { AIChat } from '@/contents/plugins/ai/components/AIChat'

function ChatPage() {
  return (
    <AIChat
      entityContext={{
        type: 'task',
        id: 'task_123',
        data: { title: 'Proyecto importante' }
      }}
      contentType="custom"
      showModelSelector={true}
      onEntityProcessed={(result) => {
        console.log('Entidad procesada:', result)
      }}
    />
  )
}
\`\`\`

#### ContentGenerator
Generador de contenido con templates:

\`\`\`tsx
import { ContentGenerator } from '@/contents/plugins/ai/components/ContentGenerator'

function ContentPage() {
  return (
    <ContentGenerator
      defaultContentType="social"
      showTemplates={true}
      autoSuggestions={true}
      onContentGenerated={(content) => {
        console.log('Contenido generado:', content)
      }}
    />
  )
}
\`\`\`

### 2. Hooks

#### useAI
Hook principal para funcionalidad de IA:

\`\`\`tsx
import { useAI } from '@/contents/plugins/ai/hooks/useAI'

function MyComponent() {
  const ai = useAI({
    userId: 'user123',
    autoCheck: true
  })

  const handleGenerate = async () => {
    const result = await ai.generateText('Escribe un email profesional')
    console.log(result)
  }

  const handleAnalyze = async () => {
    const analysis = await ai.analyze('Este es mi contenido')
    console.log(analysis)
  }

  return (
    <div>
      <button onClick={handleGenerate}>Generar</button>
      <button onClick={handleAnalyze}>Analizar</button>
    </div>
  )
}
\`\`\`

#### useContentGeneration
Hook especializado para generación de contenido:

\`\`\`tsx
import { useContentGeneration } from '@/contents/plugins/ai/hooks/useContentGeneration'

function ContentComponent() {
  const content = useContentGeneration({
    defaultContentType: 'blog',
    autoSuggestions: true
  })

  const handleGenerate = async () => {
    const result = await content.generateContent(
      'Escribe sobre tecnología',
      {
        platform: 'linkedin',
        tone: 'profesional',
        audience: 'desarrolladores'
      }
    )
    console.log(result)
  }

  return <button onClick={handleGenerate}>Generar Contenido</button>
}
\`\`\`

### 3. API REST

#### ⭐ Nuevo: Generar Contenido Multi-Proveedor

**Usando Anthropic Claude (configuración del plugin):**
\`\`\`bash
POST /api/plugin/ai/generate
Content-Type: application/json

{
  "prompt": "Explica la computación cuántica en términos simples",
  "model": "claude-3-5-haiku-20241022",
  "contentType": "blog",
  "maxTokens": 500
}
\`\`\`

**Usando OpenAI GPT (configuración del plugin):**
\`\`\`bash
POST /api/plugin/ai/generate
Content-Type: application/json

{
  "prompt": "Escribe una función para invertir una cadena",
  "model": "gpt-4o-mini",
  "contentType": "analysis",
  "temperature": 0.3
}
\`\`\`

**Usando Ollama Local (sin clave API requerida):**
\`\`\`bash
POST /api/plugin/ai/generate
Content-Type: application/json

{
  "prompt": "Crea una publicación en redes sociales sobre sostenibilidad",
  "model": "llama3.2:3b",
  "contentType": "social"
}
\`\`\`

**Respuesta con seguimiento de costos en tiempo real:**
\`\`\`json
{
  "success": true,
  "data": {
    "content": "Contenido generado aquí...",
    "model": "claude-3-5-haiku-20241022",
    "provider": "anthropic",
    "isLocal": false,
    "tokens": {
      "input": 25,
      "output": 150,
      "total": 175
    },
    "cost": 0.000194,
    "metadata": {
      "costBreakdown": {
        "inputTokens": 25,
        "outputTokens": 150,
        "inputCost": 0.00000625,
        "outputCost": 0.0001875,
        "totalCost": 0.000194
      }
    }
  }
}
\`\`\`

#### Información de Capacidades
\`\`\`bash
GET /api/plugin/ai/generate
\`\`\`

#### Generar Contenido (Método Anterior)
\`\`\`bash
POST /api/v1/ai/generate
Content-Type: application/json

{
  "prompt": "Escribe un tweet sobre IA",
  "contentType": "social",
  "platform": "twitter",
  "tone": "casual"
}
\`\`\`

#### Analizar Contenido
\`\`\`bash
POST /api/v1/ai/analyze
Content-Type: application/json

{
  "content": "Este es mi contenido para analizar",
  "analysisType": "comprehensive"
}
\`\`\`

#### Procesar Entidad
\`\`\`bash
POST /api/v1/ai/entity
Content-Type: application/json

{
  "entityType": "task",
  "entityId": "task_123",
  "action": "analyze",
  "prompt": "Analiza esta tarea y sugiere mejoras"
}
\`\`\`

### 4. Integración Directa con AIAPI

Para uso directo desde el código del servidor:

\`\`\`tsx
import { AIAPI } from '@/contents/plugins/ai/lib/ai-api'

// Generación simple
const text = await AIAPI.generateText('Hola mundo')

// Generación avanzada
const response = await AIAPI.generateContentAdvanced({
  prompt: 'Escribe un artículo',
  systemPrompt: 'Eres un experto escritor',
  options: {
    contentType: 'blog',
    temperature: 0.7
  }
})

// Procesamiento de entidades
const result = await AIAPI.processEntity(
  'user',
  { name: 'Juan', email: 'juan@example.com' },
  'analyze'
)

// Verificación de seguridad
const safety = await AIAPI.isContentSafe('Este contenido')
\`\`\`

## Arquitectura

### Estructura de Archivos
\`\`\`
contents/plugins/ai/
├── plugin.config.ts          # Configuración principal del plugin
├── types/
│   └── ai.types.ts           # Definiciones de tipos TypeScript
├── lib/
│   ├── ai-api.ts            # API exportable principal
│   ├── ai-core.ts           # Funcionalidad core de IA
│   ├── model-selector.ts    # Selección de modelos
│   ├── prompts.ts           # Sistema de prompts modulares
│   ├── safety.ts            # Características de seguridad
│   ├── cost-tracker.ts      # Seguimiento de costos
│   └── rate-limiter.ts      # Rate limiting
├── hooks/
│   ├── useAI.ts             # Hook principal de IA
│   ├── useContentGeneration.ts # Hook de generación
│   └── useModelSelection.ts  # Hook de selección de modelos
├── components/
│   ├── AIProvider.tsx       # Proveedor de contexto React
│   ├── AIChat.tsx           # Componente de chat
│   ├── ContentGenerator.tsx # Generador de contenido
│   ├── ModelSelector.tsx    # Selector de modelos
│   └── UsageMonitor.tsx     # Monitor de uso
└── api/
    └── endpoints.ts         # Endpoints dinámicos de API
\`\`\`

### Flujo de Datos

1. **Configuración**: El plugin se registra automáticamente en el sistema
2. **Inicialización**: Los modelos y servicios se configuran al activar
3. **Solicitud**: Los usuarios pueden usar componentes, hooks, o API
4. **Procesamiento**: Las solicitudes pasan por el AI Core
5. **Seguridad**: Se aplican filtros de contenido y PII
6. **Modelo**: Se selecciona el modelo óptimo automáticamente
7. **Generación**: Se ejecuta la solicitud de IA
8. **Respuesta**: Se devuelve el contenido procesado
9. **Seguimiento**: Se registran métricas y costos

### Integración con Entidades

El plugin puede procesar cualquier tipo de entidad dinámicamente:

\`\`\`tsx
// Para tareas
await AIAPI.processEntity('task', taskData, 'analyze')

// Para usuarios
await AIAPI.processEntity('user', userData, 'enhance')

// Para posts
await AIAPI.processEntity('post', postData, 'summarize')

// Para proyectos
await AIAPI.processEntity('project', projectData, 'suggest')
\`\`\`

### Endpoints Dinámicos

El sistema de endpoints se adapta automáticamente:

- \`/api/v1/ai/\` → Info del plugin
- \`/api/v1/ai/generate\` → Generación de contenido
- \`/api/v1/ai/analyze\` → Análisis de contenido
- \`/api/v1/ai/enhance\` → Mejora de contenido
- \`/api/v1/ai/entity\` → Procesamiento de entidades
- \`/api/v1/ai/models\` → Modelos disponibles
- \`/api/v1/ai/usage\` → Estadísticas de uso
- \`/api/v1/ai/health\` → Estado del plugin

## Casos de Uso

### 1. Asistente de Tareas
Analiza y mejora tareas automáticamente:

\`\`\`tsx
const enhancedTask = await AIAPI.processEntity(
  'task',
  { title: 'Hacer algo', description: 'Pendiente' },
  'enhance'
)
\`\`\`

### 2. Generación de Contenido Social
Crea contenido optimizado para diferentes plataformas:

\`\`\`tsx
const tweetContent = await content.generateContent(
  'Lanzamiento de producto',
  { platform: 'twitter', tone: 'emocionante' }
)
\`\`\`

### 3. Chat con Contexto de Entidad
Chat que entiende el contexto de entidades específicas:

\`\`\`tsx
<AIChat
  entityContext={{
    type: 'project',
    id: 'project_456',
    data: projectData
  }}
/>
\`\`\`

### 4. Análisis de Contenido
Analiza contenido para obtener insights:

\`\`\`tsx
const analysis = await ai.analyze(content, 'comprehensive')
// Retorna: legibilidad, sentimiento, temas, SEO, etc.
\`\`\`

## Contribución

Para extender el plugin:

1. **Nuevos Modelos**: Agrega configuraciones en \`model-selector.ts\`
2. **Nuevos Endpoints**: Registra en \`endpoints.ts\`
3. **Nuevos Tipos de Contenido**: Extiende \`prompts.ts\`
4. **Nuevos Componentes**: Agrega en \`components/\`
5. **Nuevos Hooks**: Implementa en \`hooks/\`

## Seguridad y Privacidad

- **Datos sensibles**: Se enmascaran automáticamente
- **Contenido tóxico**: Se filtra antes del procesamiento
- **Logs**: No se almacenan datos de usuario
- **Cumplimiento**: Compatible con GDPR y CCPA
- **Rate limiting**: Previene abuso del sistema

## Monitoreo y Métricas

El plugin incluye monitoreo completo:

- **Uso por usuario**: Tokens, costos, solicitudes
- **Rendimiento**: Tiempo de respuesta, tasa de éxito
- **Modelos**: Popularidad, efectividad
- **Errores**: Seguimiento y alertas
- **Cuotas**: Límites diarios y mensuales

## Soporte

Para problemas o preguntas:

1. Revisa los logs del plugin en la consola
2. Verifica la configuración de variables de entorno
3. Confirma que los modelos estén disponibles
4. Chequea los límites de cuota y rate limiting

El plugin está diseñado para ser completamente flexible y extensible, integrándose perfectamente con el sistema de entidades dinámicas.