const E2E_DIR = "tests/cypress/e2e/";

/**
 * The Test Cases page for the test file a tag lists: its documentation is the `.bdd.md` next to the Cypress file,
 * served from `tests/cypress/e2e`. Null when the file is not under that directory.
 */
export function testDocPath(file: string): string | null {
  const i = file.indexOf(E2E_DIR);
  if (i === -1) return null;
  const rest = file.slice(i + E2E_DIR.length).replace(/\.cy\.[jt]sx?$/, ".bdd.md");
  return rest.endsWith(".bdd.md") ? `/devtools/tests/${rest}` : null;
}

/** Selector tags (`@SEL_*`) are generated per data-cy and swamp the "Other" group; they get their own, collapsed. */
export function isSelectorTag(tag: string): boolean {
  return /^@?SEL_/.test(tag);
}
