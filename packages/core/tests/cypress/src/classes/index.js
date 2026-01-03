/**
 * Cypress POM Classes - Main Export
 *
 * Organized hierarchically:
 * - controllers/  - API controllers
 * - components/   - Core UI components (auth, teams, navigation, settings, entities, ui)
 * - shared/       - Utilities (Session, User, factories)
 * - sector7/      - Admin panel
 * - themes/       - Theme-specific pages
 */

// 🎮 API Controllers
export * from './controllers/index.js'

// 🧩 Core Components
export * from './components/index.js'

// 🔗 Shared Utilities
export * from './shared/index.js'

// 👑 Admin Panel
export * from './sector7/index.js'

// 🎨 Theme Pages
export * from './themes/index.js'

/**
 * Import examples:
 *
 * // From main index (all exports)
 * import { LoginForm, EntityList, Session } from '../src/classes'
 *
 * // From specific modules
 * import { LoginForm } from '../src/classes/components/auth'
 * import { EntityList, EntityForm } from '../src/classes/components/entities'
 * import { Session } from '../src/classes/shared'
 * import { Dashboard } from '../src/classes/themes/default/pages/dashboard'
 *
 * // Usage
 * const taskList = new EntityList('tasks')
 * const taskForm = new EntityForm('tasks')
 * const customerList = new EntityList('customers')
 */
