/**
 * Mock for @nextsparkjs/core/components/ui/badge
 */
const React = require('react')

const Badge = ({ children, variant = 'default', className = '', ...props }) => {
  return React.createElement('span', {
    className: `badge badge-${variant} ${className}`.trim(),
    'data-testid': 'badge',
    ...props,
  }, children)
}

module.exports = { Badge }
module.exports.Badge = Badge
module.exports.default = Badge
