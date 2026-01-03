// Import core Cypress support
// Detectar contexto monorepo vs npm install
const isMonorepo = require('fs').existsSync(
  require('path').resolve(__dirname, '../../../../packages/core/package.json')
)

if (isMonorepo) {
  // En monorepo: importar directamente
  require('../../../../packages/core/tests/cypress/support')
} else {
  // En proyecto con npm: importar desde el paquete
  require('@nextsparkjs/core/cypress-support')
}

// Importar commands específicos del theme/proyecto
import './commands'
