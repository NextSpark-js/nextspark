/**
 * BDD Document Parser
 *
 * Parses BDD markdown documents into structured data.
 * Supports both the new simplified format and legacy HTML table format.
 */

import type { BDDDocument, BDDFeature, BDDTestCase, BDDTestMetadata, BDDScenarios } from './types';

/**
 * Parse YAML frontmatter from markdown
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    return { frontmatter: {}, body: content };
  }

  const [, yamlContent, body] = frontmatterMatch;
  const frontmatter: Record<string, unknown> = {};

  // Simple YAML parsing (key: value pairs)
  yamlContent.split('\n').forEach((line) => {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      // Handle arrays like [tag1, tag2]
      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key] = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim());
      } else {
        frontmatter[key] = value;
      }
    }
  });

  return { frontmatter, body };
}

/**
 * Extract feature info from document
 */
function parseFeature(frontmatter: Record<string, unknown>, body: string): BDDFeature {
  // Try to get title from frontmatter or first H1
  const titleMatch = body.match(/^#\s+(.+)$/m);
  const descMatch = body.match(/^>\s+(.+)$/m);

  // Parse grepTags - handle both array format and quoted strings
  let grepTags = frontmatter.grepTags as string[] | undefined;
  if (grepTags) {
    // Clean up any quotes from the tags
    grepTags = grepTags.map(tag => tag.replace(/^['"]|['"]$/g, ''));
  }

  return {
    title: (frontmatter.feature as string) || titleMatch?.[1] || 'Untitled Feature',
    description: descMatch?.[1] || '',
    priority: frontmatter.priority as BDDFeature['priority'],
    tags: frontmatter.tags as string[],
    grepTags,
    coverage: frontmatter.coverage ? parseInt(String(frontmatter.coverage), 10) : undefined,
  };
}

/**
 * Parse test metadata from markdown section
 */
function parseTestMetadata(section: string): BDDTestMetadata {
  const metadata: BDDTestMetadata = {};

  const priorityMatch = section.match(/\*\*Priority:\*\*\s*(\w+)/i);
  if (priorityMatch) {
    metadata.priority = priorityMatch[1].toLowerCase() as BDDTestMetadata['priority'];
  }

  const typeMatch = section.match(/\*\*Type:\*\*\s*(\w+)/i);
  if (typeMatch) {
    metadata.type = typeMatch[1].toLowerCase() as BDDTestMetadata['type'];
  }

  const tagsMatch = section.match(/\*\*Tags:\*\*\s*(.+)/i);
  if (tagsMatch) {
    metadata.tags = tagsMatch[1].split(',').map((t) => t.trim());
  }

  const automatedMatch = section.match(/\*\*Automated:\*\*\s*(yes|true)/i);
  metadata.automated = !!automatedMatch;

  return metadata;
}

/**
 * Extract Gherkin scenarios (bilingual support)
 * Supports: ```gherkin:en, ```gherkin:es, ```gherkin (fallback to en)
 */
function extractGherkinScenarios(section: string): BDDScenarios {
  const scenarios: BDDScenarios = {};

  // Match language-specific blocks: ```gherkin:en or ```gherkin:es
  const langBlockPattern = /```gherkin:(en|es)\n([\s\S]*?)```/g;
  let match;

  while ((match = langBlockPattern.exec(section)) !== null) {
    const [, lang, content] = match;
    scenarios[lang as 'en' | 'es'] = content.trim();
  }

  // If no language-specific blocks found, try generic ```gherkin block
  if (!scenarios.en && !scenarios.es) {
    const genericMatch = section.match(/```gherkin\n([\s\S]*?)```/);
    if (genericMatch) {
      scenarios.en = genericMatch[1].trim();
    }
  }

  return scenarios;
}

/**
 * Extract Gherkin scenario from code block (legacy, returns first scenario found)
 */
function extractGherkinScenario(section: string): string {
  const scenarios = extractGherkinScenarios(section);
  return scenarios.en || scenarios.es || '';
}

/**
 * Extract expected results list
 */
function extractExpectedResults(section: string): string[] {
  const resultsMatch = section.match(/### Expected Results\n([\s\S]*?)(?=\n---|\n## @test|$)/);
  if (!resultsMatch) return [];

  return resultsMatch[1]
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
}

/**
 * Parse tests from new format (## @test markers)
 */
function parseNewFormatTests(body: string): BDDTestCase[] {
  const testSections = body.split(/(?=## @test )/);
  const tests: BDDTestCase[] = [];

  for (const section of testSections) {
    const headerMatch = section.match(/^## @test\s+([\w-]+):\s*(.+)$/m);
    if (!headerMatch) continue;

    const [, id, title] = headerMatch;
    const scenarios = extractGherkinScenarios(section);

    tests.push({
      id,
      title: title.trim(),
      metadata: parseTestMetadata(section),
      scenario: scenarios.en || scenarios.es || '',
      scenarios,
      expectedResults: extractExpectedResults(section),
    });
  }

  return tests;
}

/**
 * Parse tests from legacy HTML table format
 * This handles the existing bilingual format with <table> tags
 */
function parseLegacyFormatTests(body: string): BDDTestCase[] {
  const tests: BDDTestCase[] = [];

  // Split by test case headers (## TC-XXX or ## 1. Test Name patterns)
  const testSections = body.split(/(?=## (?:\d+\.|TC-|TEST-))/i);

  for (const section of testSections) {
    // Try to extract test ID and title from header
    const headerMatch = section.match(/^## (?:(\d+)\.\s*)?(?:(TC-[\w-]+|TEST-[\w-]+)[:\s]*)?\s*(.+)$/m);
    if (!headerMatch) continue;

    const [, num, explicitId, title] = headerMatch;
    const id = explicitId || `TC-${String(num || tests.length + 1).padStart(3, '0')}`;

    // Extract bilingual scenarios
    const scenarios = extractGherkinScenarios(section);
    const scenario = scenarios.en || scenarios.es || '';

    // Try to determine priority from content
    const metadata: BDDTestMetadata = {};
    if (section.toLowerCase().includes('smoke')) metadata.type = 'smoke';
    if (section.toLowerCase().includes('critical') || section.toLowerCase().includes('high'))
      metadata.priority = 'high';

    if (scenario) {
      tests.push({
        id,
        title: title.trim(),
        metadata,
        scenario,
        scenarios,
      });
    }
  }

  return tests;
}

/**
 * Main parser function
 */
export function parseBDDDocument(content: string): BDDDocument {
  const { frontmatter, body } = parseFrontmatter(content);
  const feature = parseFeature(frontmatter, body);

  // Determine format and parse accordingly
  const isNewFormat = body.includes('## @test ');
  const tests = isNewFormat ? parseNewFormatTests(body) : parseLegacyFormatTests(body);

  // Update feature coverage if not set
  if (!feature.coverage && tests.length > 0) {
    feature.coverage = tests.length;
  }

  return {
    feature,
    tests,
    rawContent: content,
  };
}
