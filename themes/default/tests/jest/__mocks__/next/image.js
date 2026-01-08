/**
 * Mock for next/image
 */
const React = require('react')

const Image = ({ src, alt, ...props }) => {
  return React.createElement('img', {
    src: typeof src === 'object' ? src.src : src,
    alt: alt || '',
    ...props,
  })
}

module.exports = Image
module.exports.default = Image
