/**
 * NextSpark Package JSON Interface
 * Defines the structure for plugin and theme package.json files
 * Can be exported from @nextsparkjs/core for developer types
 */
export interface NextSparkPackageJson {
  name: string
  version: string
  // Required plugins field for themes (at root level, NOT in nextspark)
  requiredPlugins?: string[]

  nextspark?: {
    type: 'plugin' | 'theme'
    displayName: string
    description: string
    compatibility?: {
      core?: string
      node?: string
    }
    postinstall?: {
      requiredPlugins?: string[]
      templates?: Array<{
        from: string
        to: string
        condition?: 'exists' | '!exists' | 'always' | 'prompt'
        description?: string
      }>
      envVars?: Array<{
        key: string
        description: string
        required: boolean
        default?: string
      }>
      migrations?: string[]
      script?: string
      messages?: {
        success?: string
        docs?: string
        nextSteps?: string[]
      }
    }
  }

  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

/**
 * Options for the install command
 */
export interface InstallOptions {
  force?: boolean
  skipDeps?: boolean
  dryRun?: boolean
  skipPostinstall?: boolean
  version?: string
}

/**
 * Result from fetching a package from npm registry
 */
export interface FetchResult {
  packageJson: NextSparkPackageJson
  extractedPath: string
  cleanup: () => void
}

/**
 * Result from validating a package before installation
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  peerDepIssues: PeerDepIssue[]
}

/**
 * Issue with a peer dependency
 */
export interface PeerDepIssue {
  name: string
  required: string
  installed: string | null
  severity: 'error' | 'warning'
}

/**
 * Result from a successful installation
 */
export interface InstallResult {
  success: boolean
  installedPath: string
  name: string
}

/**
 * Context passed to postinstall handlers
 */
export interface PostinstallContext {
  activeTheme: string | null
  projectRoot: string
  pluginName?: string
  themeName?: string
  coreVersion: string
  timestamp: number
  installingPlugins: Set<string>
}
