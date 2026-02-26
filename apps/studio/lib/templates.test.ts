import { TEMPLATES, TEMPLATE_CATEGORIES, getTemplatesByCategory, searchTemplates, getTemplateById } from './templates'

describe('templates', () => {
  test('all templates have required fields', () => {
    for (const t of TEMPLATES) {
      expect(t.id).toBeTruthy()
      expect(t.title).toBeTruthy()
      expect(t.description).toBeTruthy()
      expect(t.prompt.length).toBeGreaterThan(20)
      expect(t.category).toBeTruthy()
      expect(t.icon).toBeTruthy()
      expect(t.tags.length).toBeGreaterThan(0)
      expect(t.color).toBeTruthy()
    }
  })

  test('all template IDs are unique', () => {
    const ids = TEMPLATES.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('all template categories are valid', () => {
    const validCategories = TEMPLATE_CATEGORIES.map(c => c.id)
    for (const t of TEMPLATES) {
      expect(validCategories).toContain(t.category)
    }
  })

  test('every category has at least 2 templates', () => {
    for (const cat of TEMPLATE_CATEGORIES) {
      const count = TEMPLATES.filter(t => t.category === cat.id).length
      expect(count).toBeGreaterThanOrEqual(2)
    }
  })

  test('getTemplatesByCategory filters correctly', () => {
    const crm = getTemplatesByCategory('crm')
    expect(crm.length).toBeGreaterThanOrEqual(2)
    expect(crm.every(t => t.category === 'crm')).toBe(true)
  })

  test('searchTemplates matches on title', () => {
    const results = searchTemplates('Gym')
    expect(results.some(t => t.id === 'gym-crm')).toBe(true)
  })

  test('searchTemplates matches on description', () => {
    const results = searchTemplates('invoice')
    expect(results.some(t => t.id === 'invoice-platform')).toBe(true)
  })

  test('searchTemplates matches on tags', () => {
    const results = searchTemplates('recipes')
    expect(results.some(t => t.id === 'recipe-blog')).toBe(true)
  })

  test('searchTemplates returns all for empty query', () => {
    expect(searchTemplates('')).toEqual(TEMPLATES)
    expect(searchTemplates('  ')).toEqual(TEMPLATES)
  })

  test('searchTemplates is case-insensitive', () => {
    const a = searchTemplates('GYM')
    const b = searchTemplates('gym')
    expect(a).toEqual(b)
  })

  test('getTemplateById returns correct template', () => {
    const t = getTemplateById('tech-blog')
    expect(t).toBeDefined()
    expect(t!.title).toBe('Tech Blog')
  })

  test('getTemplateById returns undefined for invalid id', () => {
    expect(getTemplateById('nonexistent')).toBeUndefined()
  })
})
