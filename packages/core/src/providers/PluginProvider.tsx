/**
 * Plugin Provider
 * 
 * React provider that initializes and manages the plugin system
 * Loads plugins at application startup and provides plugin context
 */

'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
// TODO: Update plugin registry integration
// import { pluginRegistry } from '@nextsparkjs/registries/plugin-registry'
import type { PluginConfig } from '../types/plugin'

/**
 * Plugin context interface
 */
interface PluginContextValue {
  plugins: PluginConfig[]
  isLoading: boolean
  error: string | null
  isPluginLoaded: (name: string) => boolean
  getPlugin: (name: string) => PluginConfig | null
  getPluginComponent: (pluginName: string, componentName: string) => React.ComponentType<unknown> | null
  getPluginService: (pluginName: string, serviceName: string) => unknown
}

/**
 * Plugin context
 */
const PluginContext = createContext<PluginContextValue | null>(null)

/**
 * Plugin provider props
 */
interface PluginProviderProps {
  children: ReactNode
}

/**
 * Plugin Provider Component
 * Initializes the plugin system and provides plugin context to the app
 */
export function PluginProvider({ children }: PluginProviderProps) {
  const [plugins, setPlugins] = useState<PluginConfig[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * Initialize plugin system
   */
  useEffect(() => {
    let mounted = true

    const initializePlugins = async () => {
      try {
        console.log('[PluginProvider] Initializing plugin system...')
        
        // Initialize the plugin registry
        // TODO: Re-enable when plugin registry is properly integrated
        // await pluginRegistry.initialize()

        if (!mounted) return

        // Get loaded plugins
        // const loadedPlugins = pluginRegistry.getAllPlugins()
        const activePlugins: PluginConfig[] = [] // loadedPlugins
          // .filter((p: any) => p.status === 'active')
          // .map((p: any) => p.config)

        setPlugins(activePlugins)
        setError(null)
        
        console.log(`[PluginProvider] Loaded ${activePlugins.length} active plugins:`, 
          activePlugins.map(p => p.name))
        
      } catch (err) {
        console.error('[PluginProvider] Error initializing plugins:', err)
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize plugins')
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    initializePlugins()

    return () => {
      mounted = false
    }
  }, [])

  /**
   * Check if a plugin is loaded
   */
  const isPluginLoaded = (name: string): boolean => {
    // TODO: Re-enable when plugin registry is properly integrated
    // return pluginRegistry.isPluginLoaded(name)
    return plugins.some(p => p.name === name)
  }

  /**
   * Get plugin configuration by name
   */
  const getPlugin = (name: string): PluginConfig | null => {
    const plugin = plugins.find(p => p.name === name)
    return plugin || null
  }

  /**
   * Get plugin component
   */
  const getPluginComponent = (pluginName: string, componentName: string): React.ComponentType<unknown> | null => {
    const plugin = getPlugin(pluginName)
    
    if (!plugin?.components?.[componentName]) {
      console.warn(`[PluginProvider] Component ${componentName} not found in plugin ${pluginName}`)
      return null
    }

    return plugin.components[componentName]
  }

  /**
   * Get plugin service/hook
   */
  const getPluginService = (pluginName: string, serviceName: string): unknown => {
    const plugin = getPlugin(pluginName)
    
    if (!plugin?.services?.[serviceName]) {
      console.warn(`[PluginProvider] Service ${serviceName} not found in plugin ${pluginName}`)
      return null
    }

    return plugin.services[serviceName]
  }

  const contextValue: PluginContextValue = {
    plugins,
    isLoading,
    error,
    isPluginLoaded,
    getPlugin,
    getPluginComponent,
    getPluginService
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading plugins...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    console.error('[PluginProvider] Plugin system error:', error)
    // Continue rendering the app even if plugins fail to load
    // This ensures the core app functionality remains available
  }

  return (
    <PluginContext.Provider value={contextValue}>
      {children}
    </PluginContext.Provider>
  )
}

/**
 * Hook to use plugin context
 */
export function usePlugins(): PluginContextValue {
  const context = useContext(PluginContext)
  
  if (!context) {
    throw new Error('usePlugins must be used within a PluginProvider')
  }
  
  return context
}

/**
 * Hook to get a specific plugin
 */
export function usePlugin(name: string): PluginConfig | null {
  const { getPlugin } = usePlugins()
  return getPlugin(name)
}

/**
 * Hook to get a plugin component
 */
export function usePluginComponent(pluginName: string, componentName: string): React.ComponentType<unknown> | null {
  const { getPluginComponent } = usePlugins()
  return getPluginComponent(pluginName, componentName)
}

/**
 * Hook to get a plugin service
 */
export function usePluginService<T = unknown>(pluginName: string, serviceName: string): T | null {
  const { getPluginService } = usePlugins()
  return getPluginService(pluginName, serviceName) as T | null
}

/**
 * HOC to render a plugin component
 */
export function withPluginComponent(pluginName: string, componentName: string, fallback?: React.ComponentType<Record<string, unknown>>) {
  return function WithPluginComponent(props: Record<string, unknown>) {
    const Component = usePluginComponent(pluginName, componentName)
    
    if (!Component) {
      if (fallback) {
        const FallbackComponent = fallback
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return <FallbackComponent {...(props as any)} />
      }
      return null
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <Component {...(props as any)} />
  }
}

/**
 * Component to conditionally render content based on plugin availability
 */
interface PluginGateProps {
  pluginName: string
  children: ReactNode
  fallback?: ReactNode
}

export function PluginGate({ pluginName, children, fallback }: PluginGateProps) {
  const { isPluginLoaded } = usePlugins()
  
  if (isPluginLoaded(pluginName)) {
    return <>{children}</>
  }
  
  return <>{fallback}</>
}