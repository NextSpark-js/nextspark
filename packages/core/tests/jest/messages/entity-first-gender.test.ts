/**
 * The "create the first {entity}" texts take the entity's name from the config, whose gender the catalog cannot know:
 * they carry a masculine noun of their own ("primer registro ({entity})"), never "primer {entity}" in front of a feminine
 * name (#413).
 */
import es from '../../../src/messages/es/entities.json'
import pt from '../../../src/messages/pt/entities.json'
import fr from '../../../src/messages/fr/entities.json'
import it from '../../../src/messages/it/entities.json'
import de from '../../../src/messages/de/entities.json'

const catalogs = { es, pt, fr, it, de } as Record<string, { ui?: Record<string, string> } & Record<string, any>>


test.each(Object.keys(catalogs))('%s: the first-entity texts put the entity in parentheses after a noun', (locale) => {
  const found = JSON.stringify(catalogs[locale])
  for (const key of ['getStarted', 'addFirst']) {
    const match = found.match(new RegExp(`"${key}":"([^"]*)"`))
    expect(match).not.toBeNull()
    expect(match![1]).toContain('({entity})')
  }
})
