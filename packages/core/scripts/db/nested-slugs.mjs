// Whether the project's pages entity accepts nested slugs, as 004_pages_slug_check.sql reads it (#332). The rule is
// the application's (validatePublicSlug): a base path other than '/', or `access.allowNestedSlugs: true` at the root.
// Only literals count. A config that cannot be read gives 'off' (the single-segment rule the table always had) and a
// `warning` that says why.
import fs from 'fs';
import path from 'path';
import { readEntityFacts } from '../build/registry/host/entity-routes.mjs';

const FILE = 'entities/pages/pages.config.ts';

export async function nestedSlugsSetting(projectRoot) {
  const off = reason => ({
    setting: 'off',
    warning: `could not read access.allowNestedSlugs from ${FILE} (${reason}); pages slug CHECK uses the single-segment rule`,
  });
  const file = path.join(projectRoot, FILE);
  try {
    const source = fs.readFileSync(file, 'utf8');
    const exportName = /export\s+const\s+(\w+EntityConfig)\b/.exec(source)?.[1];
    if (!exportName) return off('no exported *EntityConfig');
    const { facts, error } = await readEntityFacts({ source, file, exportName, projectRoot });
    if (!facts) return off(error ?? 'unreadable');
    const basePath = facts.basePath.state === 'absent' ? facts.legacyBasePath : facts.basePath;
    if (basePath.state === 'value' && typeof basePath.value === 'string' && basePath.value !== '/') return { setting: 'on' };
    if (basePath.state === 'unknown') return off('basePath is not a literal');
    if (facts.allowNestedSlugs.state === 'unknown') return off('not a literal');
    return { setting: facts.allowNestedSlugs.state === 'value' && facts.allowNestedSlugs.value === true ? 'on' : 'off' };
  } catch (error) {
    return off(error.code ?? error.message);
  }
}
