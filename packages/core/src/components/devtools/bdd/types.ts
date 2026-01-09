/**
 * BDD Test Document Types
 *
 * Defines the structure for parsed BDD test documents.
 */

export interface BDDFeature {
  title: string;
  description: string;
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
  grepTags?: string[];
  coverage?: number;
}

export type TestStatus = 'passing' | 'failing' | 'skipped' | 'pending' | 'active';

export interface BDDTestMetadata {
  priority?: 'high' | 'medium' | 'low';
  type?: 'smoke' | 'regression' | 'integration' | 'e2e' | 'selector';
  tags?: string[];
  automated?: boolean;
  /** Test execution status */
  status?: TestStatus;
  /** Reason for status (e.g., "requires OWNER permission") */
  statusReason?: string;
  /** Grep tags for Cypress filtering (e.g., ["@ui-selectors", "@SEL_BILL_001"]) */
  grepTags?: string[];
}

export type BDDLanguage = 'en' | 'es';

export interface BDDScenarios {
  en?: string;
  es?: string;
}

export interface BDDTestCase {
  id: string;
  title: string;
  metadata: BDDTestMetadata;
  /** @deprecated Use scenarios instead */
  scenario: string;
  /** Bilingual scenarios */
  scenarios: BDDScenarios;
  expectedResults?: string[];
  notes?: string;
}

export interface BDDDocument {
  feature: BDDFeature;
  tests: BDDTestCase[];
  rawContent: string;
}
