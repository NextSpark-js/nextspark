export declare function resolveDocTitle(
  frontmatterTitle: unknown,
  content: string,
  filePath: string
): { title: string; content: string; source: 'frontmatter' | 'heading' | 'filename' }
