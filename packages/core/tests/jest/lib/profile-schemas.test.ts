/**
 * Both profile schemas accept an empty country and timezone (an account starts with neither) and still require the
 * names and the language (#433).
 */
import { profileSchema } from '@/core/lib/validation'
import { createProfileSchema } from '@/core/lib/validation-schemas'

const schemas = [['profileSchema', profileSchema], ['createProfileSchema', createProfileSchema((key) => key)]] as const
const valid = { firstName: 'Ana', lastName: 'Pérez', country: '', timezone: '', language: 'es' }

test.each(schemas)('%s accepts an empty country and timezone', (_name, schema) => {
  expect(schema.safeParse(valid).success).toBe(true)
})

test.each(schemas)('%s still requires the names and the language', (_name, schema) => {
  for (const broken of [{ ...valid, firstName: 'A' }, { ...valid, lastName: '' }, { ...valid, language: '' }]) {
    expect(schema.safeParse(broken).success).toBe(false)
  }
})
