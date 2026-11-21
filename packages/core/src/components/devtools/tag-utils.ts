const E2E_DIR = "tests/cypress/e2e/";

/** A node of the tree `/api/devtools/tests` returns (the documentation files under `tests/cypress/e2e`). */
export interface DocTreeNode {
  path: string;
  type: "file" | "folder";
  children?: DocTreeNode[];
}

/** The paths of the documentation files in that tree. */
export function docPaths(tree: readonly DocTreeNode[]): Set<string> {
  const paths = new Set<string>();
  const walk = (nodes: readonly DocTreeNode[]) =>
    nodes.forEach((n) => (n.type === "file" ? paths.add(n.path) : walk(n.children ?? [])));
  walk(tree);
  return paths;
}

/**
 * The Test Cases page for the test file a tag lists: its documentation is the `.bdd.md` next to the Cypress file,
 * served from `tests/cypress/e2e`. Null when the file is not under that directory or has no documentation
 * (`docs`: the documentation files that exist; many Cypress files have none).
 */
export function testDocPath(file: string, docs: ReadonlySet<string>): string | null {
  const i = file.indexOf(E2E_DIR);
  if (i === -1) return null;
  const rest = file.slice(i + E2E_DIR.length).replace(/\.cy\.[jt]sx?$/, ".bdd.md");
  return rest.endsWith(".bdd.md") && docs.has(rest) ? `/devtools/tests/${rest}` : null;
}

/** Selector tags (`@SEL_*`) are generated per data-cy and swamp the "Other" group; they get their own, collapsed. */
export function isSelectorTag(tag: string): boolean {
  return /^@?SEL_/.test(tag);
}
