import type { FieldDefinition } from '../../types/blocks'

/**
 * Block field definitions are an array (each field carries its own `name`).
 * Group them by tab, keeping the declaration order.
 */
export function groupFieldsByTab(
  fields: readonly FieldDefinition[] | undefined
): Record<string, FieldDefinition[]> {
  const grouped: Record<string, FieldDefinition[]> = {}
  for (const field of fields ?? []) {
    const tab = field.tab || 'content'
    ;(grouped[tab] ??= []).push(field)
  }
  return grouped
}
