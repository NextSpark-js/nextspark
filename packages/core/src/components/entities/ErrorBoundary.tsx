'use client'

import React, { ErrorInfo, ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '../ui/alert'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'

interface EntityErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  errorId?: string
}

interface EntityErrorBoundaryProps {
  children: ReactNode
  entityType?: string
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showDetails?: boolean
}

/**
 * Error Boundary específico para entidades
 * Proporciona recuperación de errores y debugging para el sistema de entidades dinámicas
 */
export class EntityErrorBoundary extends React.Component<
  EntityErrorBoundaryProps,
  EntityErrorBoundaryState
> {
  private retryCount = 0
  private readonly maxRetries = 3

  constructor(props: EntityErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): Partial<EntityErrorBoundaryState> {
    // Generar ID único para el error
    const errorId = `entity-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    return {
      hasError: true,
      error,
      errorId
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { entityType, onError } = this.props
    const { errorId } = this.state

    // Log del error con contexto de entidad
    console.group(`🚨 Entity Error Boundary [${entityType || 'Unknown'}]`)
    console.error('Error ID:', errorId)
    console.error('Error:', error)
    console.error('Error Info:', errorInfo)
    console.error('Component Stack:', errorInfo.componentStack)
    console.error('Retry Count:', this.retryCount)
    console.groupEnd()

    // Guardar en state para mostrar detalles
    this.setState({
      errorInfo
    })

    // Callback personalizado si se proporciona
    if (onError) {
      onError(error, errorInfo)
    }

    // Reportar error a servicio de monitoreo (si existe)
    this.reportError(error, errorInfo, entityType)
  }

  private reportError = async (error: Error, errorInfo: ErrorInfo, entityType?: string) => {
    try {
      // En un entorno real, aquí enviarías el error a un servicio como Sentry
      const errorReport = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        entityType,
        errorId: this.state.errorId,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : ''
      }

      console.log('📊 Error Report:', errorReport)
      
      // Aquí podrías enviar a tu servicio de logging
      // await fetch('/api/errors', { method: 'POST', body: JSON.stringify(errorReport) })
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError)
    }
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++
      console.log(`🔄 Retrying entity component (attempt ${this.retryCount}/${this.maxRetries})`)
      
      this.setState({
        hasError: false,
        error: undefined,
        errorInfo: undefined
      })
    }
  }

  private handleReset = () => {
    this.retryCount = 0
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined
    })
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  private handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard'
    }
  }

  private getErrorType = (error: Error): string => {
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return 'network'
    }
    if (error.message.includes('permission') || error.message.includes('auth')) {
      return 'permission'
    }
    if (error.message.includes('not found') || error.message.includes('404')) {
      return 'not-found'
    }
    if (error.message.includes('config') || error.message.includes('registry')) {
      return 'configuration'
    }
    return 'unknown'
  }

  private getErrorMessage = (error: Error, entityType?: string): { title: string; description: string } => {
    const errorType = this.getErrorType(error)
    const entityName = entityType ? ` de ${entityType}` : ''

    switch (errorType) {
      case 'network':
        return {
          title: 'Error de Conexión',
          description: `No se pudo conectar con el servidor para cargar los datos${entityName}. Verifica tu conexión a internet.`
        }
      case 'permission':
        return {
          title: 'Sin Permisos',
          description: `No tienes los permisos necesarios para acceder a estos datos${entityName}.`
        }
      case 'not-found':
        return {
          title: 'Recurso No Encontrado',
          description: `Los datos${entityName} que solicitas no están disponibles o han sido eliminados.`
        }
      case 'configuration':
        return {
          title: 'Error de Configuración',
          description: `Hay un problema con la configuración${entityName}. Contacta al administrador.`
        }
      default:
        return {
          title: 'Error Inesperado',
          description: `Ha ocurrido un error inesperado${entityName}. Nuestro equipo ha sido notificado.`
        }
    }
  }

  render() {
    const { hasError, error, errorInfo, errorId } = this.state
    const { children, fallback, entityType, showDetails = false } = this.props

    if (hasError && error) {
      // Si hay un fallback personalizado, úsalo
      if (fallback) {
        return fallback
      }

      const { title, description } = this.getErrorMessage(error, entityType)
      const canRetry = this.retryCount < this.maxRetries
      const errorType = this.getErrorType(error)

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-xl font-semibold text-gray-900">
                {title}
              </CardTitle>
              <CardDescription className="text-base text-gray-600">
                {description}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Actions */}
              <div className="flex flex-wrap gap-3 justify-center">
                {canRetry && (
                  <Button 
                    onClick={this.handleRetry} 
                    variant="default"
                    className="inline-flex items-center"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reintentar ({this.maxRetries - this.retryCount} intentos restantes)
                  </Button>
                )}
                
                <Button 
                  onClick={this.handleReset} 
                  variant="outline"
                  className="inline-flex items-center"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Restablecer
                </Button>

                <Button 
                  onClick={this.handleGoHome} 
                  variant="outline"
                  className="inline-flex items-center"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Ir al Dashboard
                </Button>

                <Button 
                  onClick={this.handleReload} 
                  variant="ghost"
                  className="inline-flex items-center"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recargar Página
                </Button>
              </div>

              {/* Error Details (solo en desarrollo o si se habilita explícitamente) */}
              {(showDetails || process.env.NODE_ENV === 'development') && errorInfo && (
                <Alert>
                  <Bug className="h-4 w-4" />
                  <AlertTitle>Detalles del Error (Desarrollo)</AlertTitle>
                  <AlertDescription className="mt-2">
                    <div className="space-y-2 text-sm font-mono">
                      <div>
                        <strong>Error ID:</strong> {errorId}
                      </div>
                      <div>
                        <strong>Tipo:</strong> {errorType}
                      </div>
                      <div>
                        <strong>Entidad:</strong> {entityType || 'N/A'}
                      </div>
                      <div>
                        <strong>Mensaje:</strong> {error.message}
                      </div>
                      {error.stack && (
                        <details className="mt-2">
                          <summary className="cursor-pointer font-semibold">Stack Trace</summary>
                          <pre className="mt-2 overflow-auto text-xs bg-gray-100 p-2 rounded">
                            {error.stack}
                          </pre>
                        </details>
                      )}
                      {errorInfo.componentStack && (
                        <details className="mt-2">
                          <summary className="cursor-pointer font-semibold">Component Stack</summary>
                          <pre className="mt-2 overflow-auto text-xs bg-gray-100 p-2 rounded">
                            {errorInfo.componentStack}
                          </pre>
                        </details>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Help Text */}
              <div className="text-center text-sm text-gray-500">
                Si el problema persiste, contacta al soporte técnico con el ID: <code className="bg-gray-100 px-1 rounded">{errorId}</code>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return children
  }
}

/**
 * Hook para usar el Error Boundary de forma funcional
 */
export function useEntityErrorHandler(entityType?: string) {
  const handleError = React.useCallback((error: Error, errorInfo: ErrorInfo) => {
    console.error(`Entity Error in ${entityType}:`, error, errorInfo)
    
    // Aquí podrías agregar lógica adicional como:
    // - Enviar métricas de errores
    // - Limpiar estado local
    // - Mostrar notificaciones
  }, [entityType])

  return { handleError }
}

/**
 * Componente HOC para envolver automáticamente componentes de entidades
 */
export function withEntityErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  entityType?: string
) {
  const WrappedComponent = (props: P) => (
    <EntityErrorBoundary entityType={entityType}>
      <Component {...props} />
    </EntityErrorBoundary>
  )

  WrappedComponent.displayName = `withEntityErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}
