import { MetaService } from '@nextsparkjs/core/lib/services/meta.service';
import { CreateMetaPayload } from '@nextsparkjs/core/types/meta.types';

/**
 * AI History Metadata Service
 *
 * Specialized service for managing ai_history metadata using the core MetaService.
 * Provides ai_history-specific helper methods for common metadata operations.
 *
 * IMPORTANT: All metadata is stored in ai_history_metas table via completeOperation(metas).
 * The ai_history table itself has NO metadata column - only structured fields.
 *
 * ============================================
 * METADATA BY ENDPOINT (Standardized)
 * ============================================
 *
 * analyze-brief (/api/v1/theme/content-buddy/analyze-brief):
 * - briefText: Original brief text (for auditing/debugging)
 * - briefLength: Length of brief text
 * - extractedFieldsCount: Number of fields extracted
 * - audiencesCount: Number of audience entities extracted
 * - objectivesCount: Number of objective entities extracted
 * - productsCount: Number of product entities extracted
 * - totalChildEntities: Total child entities extracted
 * - clientName: Extracted client name
 * - clientIndustry: Extracted client industry
 *
 * generate-content (/api/v1/theme/content-buddy/generate-content):
 * Core generation parameters (reproducibility):
 * - temperature: AI model temperature used
 * - tone: Content tone
 * - brandVoice: Brand voice style
 * - audience: Target audience description
 * - topic: Content topic
 * - postType: Type of post
 * - language: Content language code (e.g., "en", "es")
 *
 * Content specifications (analytics):
 * - wordCount: Target word count
 * - keywords: Comma-separated keywords (e.g., "innovation,tech,ai")
 * - additionalRequirements: Custom user instructions
 *
 * Platform analytics:
 * - platforms: Comma-separated platform list (e.g., "instagram,linkedin,twitter")
 * - platformCount: Number of platforms generated for
 *
 * Multimodal analytics (feature usage tracking):
 * - imageCount: Number of images used in generation
 * - isMultimodal: Boolean - whether images were used
 *
 * Entity relationships (CRITICAL for business analytics):
 * - clientId: Which client generated this content
 * - productId: Related product (if specified)
 * - objectiveId: Marketing objective (if specified)
 * - targetAudienceId: Specific audience segment (if specified)
 *
 * refine-content (/api/v1/theme/content-buddy/refine-content):
 * - userInstruction: User's refinement instruction
 * - sourceOperationId: UUID linking to source operation (for workflow tracking)
 * - temperature: AI model temperature used
 * - tone: Desired tone (if specified)
 * - platform: Social media platform being refined for
 *
 * ============================================
 * DEPRECATED METADATA (Use ai_history columns instead)
 * ============================================
 * - tokensInput: Use ai_history.tokensInput column
 * - tokensOutput: Use ai_history.tokensOutput column
 * - operation: Use ai_history.operation column
 * - model: Use ai_history.model column
 * - provider: Use ai_history.provider column
 */
export class AIHistoryMetaService {
  private static readonly ENTITY_TYPE = 'ai-history'; // ✅ Must match entity registry name (with hyphen, not underscore)

  /**
   * Get all metadata for an AI history record
   */
  static async getAllMetas(
    historyId: string,
    userId: string,
    includePrivate: boolean = true
  ): Promise<Record<string, unknown>> {
    return MetaService.getEntityMetas(
      this.ENTITY_TYPE,
      historyId,
      userId,
      includePrivate
    );
  }

  /**
   * Get specific metadata value
   */
  static async getMeta(
    historyId: string,
    metaKey: string,
    userId: string
  ): Promise<unknown> {
    return MetaService.getEntityMeta(
      this.ENTITY_TYPE,
      historyId,
      metaKey,
      userId
    );
  }

  /**
   * Set a single metadata value
   */
  static async setMeta(
    historyId: string,
    metaKey: string,
    metaValue: unknown,
    userId: string,
    options: Partial<CreateMetaPayload> = {}
  ): Promise<void> {
    return MetaService.setEntityMeta(
      this.ENTITY_TYPE,
      historyId,
      metaKey,
      metaValue,
      userId,
      options
    );
  }

  /**
   * Set multiple metadata values in batch
   */
  static async setBulkMetas(
    historyId: string,
    metas: Record<string, unknown>,
    userId: string,
    options: Partial<CreateMetaPayload> = {}
  ): Promise<void> {
    return MetaService.setBulkEntityMetas(
      this.ENTITY_TYPE,
      historyId,
      metas,
      userId,
      options
    );
  }

  /**
   * Delete a metadata key
   */
  static async deleteMeta(
    historyId: string,
    metaKey: string,
    userId: string
  ): Promise<void> {
    return MetaService.deleteEntityMeta(
      this.ENTITY_TYPE,
      historyId,
      metaKey,
      userId
    );
  }

  /**
   * Delete all metadata for an AI history record
   */
  static async deleteAllMetas(
    historyId: string,
    userId: string
  ): Promise<void> {
    return MetaService.deleteAllEntityMetas(
      this.ENTITY_TYPE,
      historyId,
      userId
    );
  }

  // ============================================
  // AI History-Specific Helper Methods
  // ============================================

  /**
   * Set source operation ID (for refine chains)
   * Example: refine(B) → sourceOperationId = generate(A)
   */
  static async setSourceOperationId(
    historyId: string,
    sourceOperationId: string,
    userId: string
  ): Promise<void> {
    return this.setMeta(
      historyId,
      'sourceOperationId',
      sourceOperationId,
      userId,
      { dataType: 'string', isPublic: false, isSearchable: false }
    );
  }

  /**
   * Get source operation ID (for workflow tracking)
   */
  static async getSourceOperationId(
    historyId: string,
    userId: string
  ): Promise<string | null> {
    const value = await this.getMeta(historyId, 'sourceOperationId', userId);
    return value as string | null;
  }

  /**
   * Set user instruction (for refinements)
   */
  static async setUserInstruction(
    historyId: string,
    instruction: string,
    userId: string
  ): Promise<void> {
    return this.setMeta(
      historyId,
      'userInstruction',
      instruction,
      userId,
      { dataType: 'string', isPublic: false, isSearchable: true }
    );
  }

  /**
   * Get user instruction
   */
  static async getUserInstruction(
    historyId: string,
    userId: string
  ): Promise<string | null> {
    const value = await this.getMeta(historyId, 'userInstruction', userId);
    return value as string | null;
  }

  /**
   * Set generation parameters (temperature, tone, platform, etc.)
   */
  static async setGenerationParams(
    historyId: string,
    params: {
      temperature?: number;
      tone?: string;
      platform?: string;
      style?: string;
      audienceType?: string;
      [key: string]: unknown;
    },
    userId: string
  ): Promise<void> {
    const metas: Record<string, unknown> = {};
    const options: Partial<CreateMetaPayload> = {
      isPublic: false,
      isSearchable: true
    };

    if (params.temperature !== undefined) {
      metas.temperature = params.temperature;
    }
    if (params.tone !== undefined) {
      metas.tone = params.tone;
    }
    if (params.platform !== undefined) {
      metas.platform = params.platform;
    }
    if (params.style !== undefined) {
      metas.style = params.style;
    }
    if (params.audienceType !== undefined) {
      metas.audienceType = params.audienceType;
    }

    // Include any additional custom params
    Object.keys(params).forEach(key => {
      if (!['temperature', 'tone', 'platform', 'style', 'audienceType'].includes(key)) {
        metas[key] = params[key];
      }
    });

    if (Object.keys(metas).length > 0) {
      return this.setBulkMetas(historyId, metas, userId, options);
    }
  }

  /**
   * Get generation parameters
   */
  static async getGenerationParams(
    historyId: string,
    userId: string
  ): Promise<Record<string, unknown>> {
    const allMetas = await this.getAllMetas(historyId, userId, true);
    const params: Record<string, unknown> = {};

    // Extract known generation params
    const knownParams = ['temperature', 'tone', 'platform', 'style', 'audienceType'];
    knownParams.forEach(key => {
      if (key in allMetas) {
        params[key] = allMetas[key];
      }
    });

    return params;
  }

  /**
   * Search AI history records by metadata
   * Example: Find all refinements with specific instruction
   */
  static async searchByMeta(
    metaKey: string,
    metaValue: unknown,
    userId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ historyIds: string[], total: number }> {
    const result = await MetaService.searchByMeta(
      this.ENTITY_TYPE,
      metaKey,
      metaValue,
      userId,
      limit,
      offset
    );

    return {
      historyIds: result.entities,
      total: result.total
    };
  }

  /**
   * Get metadata for multiple AI history records (bulk)
   * Useful for analytics and reporting
   */
  static async getBulkMetas(
    historyIds: string[],
    userId: string,
    includePrivate: boolean = true
  ): Promise<Record<string, Record<string, unknown>>> {
    return MetaService.getBulkEntityMetas(
      this.ENTITY_TYPE,
      historyIds,
      userId,
      includePrivate
    );
  }

  /**
   * Get specific metadata keys for multiple AI history records (bulk)
   */
  static async getBulkSpecificMetas(
    historyIds: string[],
    metaKeys: string[],
    userId: string
  ): Promise<Record<string, Record<string, unknown>>> {
    return MetaService.getBulkSpecificEntityMetas(
      this.ENTITY_TYPE,
      historyIds,
      metaKeys,
      userId
    );
  }

  /**
   * Count metadata entries for an AI history record
   */
  static async countMetas(
    historyId: string,
    userId: string
  ): Promise<number> {
    return MetaService.countEntityMetas(
      this.ENTITY_TYPE,
      historyId,
      userId
    );
  }
}
