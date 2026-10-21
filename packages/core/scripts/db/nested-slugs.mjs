// `access.allowNestedSlugs` of the project's pages entity, as 004_pages_slug_check.sql reads it (#332).
// Only a literal `true` counts; a config that cannot be read, or sets the option some other way, is 'off'
// (the single-segment rule the table always had).
import fs from 'fs';
import path from 'path';
import { readEntityFacts } from '../build/registry/host/entity-routes.mjs';

export async function nestedSlugsSetting(projectRoot) {
  const file = path.join(projectRoot, 'entities/pages/pages.config.ts');
  try {
    const source = fs.readFileSync(file, 'utf8');
    const exportName = /export\s+const\s+(\w+EntityConfig)\b/.exec(source)?.[1];
    if (!exportName) return 'off';
    const { facts } = await readEntityFacts({ source, file, exportName, projectRoot });
    return facts?.allowNestedSlugs?.state === 'value' && facts.allowNestedSlugs.value === true ? 'on' : 'off';
  } catch {
    return 'off';
  }
}
