/**
 * Feature Service
 *
 * Provides feature and flow query operations.
 * Uses pre-computed data from testing-registry for O(1) operations.
 *
 * @module FeatureService
 */

import {
  FEATURE_REGISTRY,
  FLOW_REGISTRY,
  TAGS_REGISTRY,
  COVERAGE_SUMMARY,
  type FeatureEntry,
  type FlowEntry,
  type FeatureCategory,
  type FlowCategory,
} from '@nextsparkjs/registries/testing-registry'

/**
 * Feature Service - Provides runtime feature/flow queries
 *
 * This service layer abstracts feature registry access, making the registry
 * a pure data structure (Data-Only pattern). All query logic lives here.
 *
 * Performance: All operations are O(1) or O(n) with zero I/O.
 */
export class FeatureService {
  // ===========================================================================
  // FEATURE QUERIES
  // ===========================================================================

  /**
   * Get a feature by key
   */
  static getFeature(key: string): FeatureEntry | undefined {
    return FEATURE_REGISTRY[key]
  }

  /**
   * Get all features
   */
  static getAllFeatures(): FeatureEntry[] {
    return Object.values(FEATURE_REGISTRY)
  }

  /**
   * Get features by category
   */
  static getFeaturesByCategory(category: FeatureCategory): FeatureEntry[] {
    return Object.values(FEATURE_REGISTRY).filter(f => f.category === category)
  }

  /**
   * Get features without test coverage
   */
  static getFeaturesWithoutTests(): FeatureEntry[] {
    return Object.values(FEATURE_REGISTRY).filter(f => !f.testing.hasTests)
  }

  /**
   * Get features with test coverage
   */
  static getFeaturesWithTests(): FeatureEntry[] {
    return Object.values(FEATURE_REGISTRY).filter(f => f.testing.hasTests)
  }

  /**
   * Check if a feature exists
   */
  static hasFeature(key: string): boolean {
    return key in FEATURE_REGISTRY
  }

  /**
   * Get feature tag from key
   */
  static getFeatureTag(key: string): string {
    return `@feat-${key}`
  }

  // ===========================================================================
  // FLOW QUERIES
  // ===========================================================================

  /**
   * Get a flow by key
   */
  static getFlow(key: string): FlowEntry | undefined {
    return FLOW_REGISTRY[key]
  }

  /**
   * Get all flows
   */
  static getAllFlows(): FlowEntry[] {
    return Object.values(FLOW_REGISTRY)
  }

  /**
   * Get flows by category
   */
  static getFlowsByCategory(category: FlowCategory): FlowEntry[] {
    return Object.values(FLOW_REGISTRY).filter(f => f.category === category)
  }

  /**
   * Get critical path flows
   */
  static getCriticalFlows(): FlowEntry[] {
    return Object.values(FLOW_REGISTRY).filter(f => f.criticalPath)
  }

  /**
   * Get flows without test coverage
   */
  static getFlowsWithoutTests(): FlowEntry[] {
    return Object.values(FLOW_REGISTRY).filter(f => !f.testing.hasTests)
  }

  /**
   * Check if a flow exists
   */
  static hasFlow(key: string): boolean {
    return key in FLOW_REGISTRY
  }

  /**
   * Get flow tag from key
   */
  static getFlowTag(key: string): string {
    return `@flow-${key}`
  }

  // ===========================================================================
  // TAG QUERIES
  // ===========================================================================

  /**
   * Get all tags in a category
   */
  static getTagsByCategory(category: keyof typeof TAGS_REGISTRY) {
    return TAGS_REGISTRY[category]
  }

  /**
   * Get all feature tags
   */
  static getFeatureTags() {
    return TAGS_REGISTRY.features
  }

  /**
   * Get all flow tags
   */
  static getFlowTags() {
    return TAGS_REGISTRY.flows
  }

  // ===========================================================================
  // COVERAGE QUERIES
  // ===========================================================================

  /**
   * Get coverage summary
   */
  static getCoverageSummary() {
    return COVERAGE_SUMMARY
  }

  /**
   * Get feature coverage percentage
   */
  static getFeatureCoveragePercent(): number {
    const { total, withTests } = COVERAGE_SUMMARY.features
    return total > 0 ? Math.round((withTests / total) * 100) : 0
  }

  /**
   * Get flow coverage percentage
   */
  static getFlowCoveragePercent(): number {
    const { total, withTests } = COVERAGE_SUMMARY.flows
    return total > 0 ? Math.round((withTests / total) * 100) : 0
  }
}
