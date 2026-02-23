import { getPlacementFromPosition, getViewportInfo } from '../../lib/positioning'

// ---------------------------------------------------------------------------
// getPlacementFromPosition
// ---------------------------------------------------------------------------

describe('getPlacementFromPosition', () => {
  it('maps "top" to "top"', () => {
    expect(getPlacementFromPosition('top')).toBe('top')
  })

  it('maps "bottom" to "bottom"', () => {
    expect(getPlacementFromPosition('bottom')).toBe('bottom')
  })

  it('maps "left" to "left"', () => {
    expect(getPlacementFromPosition('left')).toBe('left')
  })

  it('maps "right" to "right"', () => {
    expect(getPlacementFromPosition('right')).toBe('right')
  })

  it('maps "auto" to "bottom" (default)', () => {
    expect(getPlacementFromPosition('auto')).toBe('bottom')
  })
})

// ---------------------------------------------------------------------------
// getViewportInfo
// ---------------------------------------------------------------------------

describe('getViewportInfo', () => {
  it('returns viewport dimensions from window', () => {
    const info = getViewportInfo()
    expect(info).toHaveProperty('width')
    expect(info).toHaveProperty('height')
    expect(info).toHaveProperty('scrollX')
    expect(info).toHaveProperty('scrollY')
    expect(typeof info.width).toBe('number')
    expect(typeof info.height).toBe('number')
  })
})
