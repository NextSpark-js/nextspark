import { z } from 'zod'
import { ToolDefinition } from '@/plugins/langchain/lib/tools-builder'
import { PagesManagementService } from '@/themes/default/entities/pages/pages-management.service'
import { BLOCK_REGISTRY } from '@nextsparkjs/registries/block-registry'

/**
 * Tool context for page operations
 */
export interface PageToolContext {
    userId: string
    teamId: string
}

/**
 * Create page management tools for the AI agent
 *
 * @param context - User and team context for RLS
 * @returns Array of page-related tool definitions
 */
export function createPageTools(context: PageToolContext): ToolDefinition<any>[] {
    const { userId, teamId } = context

    return [
        // ============================================
        // PAGE CRUD
        // ============================================
        {
            name: 'list_pages',
            description: 'List all pages with optional status filter.',
            schema: z.object({
                status: z.enum(['draft', 'published', 'all'])
                    .optional()
                    .default('all')
                    .describe('Filter by page status'),
                limit: z.number().optional().default(20).describe('Max pages to return'),
                offset: z.number().optional().default(0).describe('Offset for pagination'),
                locale: z.string().optional().describe('Filter by locale'),
            }),
            func: async (params) => {
                try {
                    const result = await PagesManagementService.list(userId, { ...params, teamId })
                    return JSON.stringify({
                        pages: result.pages.map(p => ({
                            id: p.id,
                            title: p.title,
                            slug: p.slug,
                            status: p.status,
                            blockCount: p.blocks.length,
                            locale: p.locale,
                        })),
                        total: result.total,
                    }, null, 2)
                } catch (error) {
                    return `Error listing pages: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
        {
            name: 'get_page',
            description: 'Get full page details including all blocks.',
            schema: z.object({
                pageId: z.string().describe('The page ID to retrieve'),
            }),
            func: async ({ pageId }) => {
                try {
                    const page = await PagesManagementService.getById(userId, pageId)
                    if (!page) {
                        return JSON.stringify({ error: 'Page not found' })
                    }
                    return JSON.stringify(page, null, 2)
                } catch (error) {
                    return `Error getting page: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
        {
            name: 'create_page',
            description: 'Create a new page. Title and slug are required.',
            schema: z.object({
                title: z.string().describe('Page title'),
                slug: z.string().describe('URL-friendly slug (lowercase, hyphens only)'),
                locale: z.string().optional().default('en').describe('Page locale'),
                status: z.enum(['draft', 'published'])
                    .optional()
                    .default('draft')
                    .describe('Initial page status'),
                seoTitle: z.string().optional().describe('SEO meta title'),
                seoDescription: z.string().optional().describe('SEO meta description'),
            }),
            func: async (data) => {
                try {
                    const page = await PagesManagementService.create(userId, { ...data, teamId })
                    return JSON.stringify(page, null, 2)
                } catch (error) {
                    return `Error creating page: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
        {
            name: 'update_page',
            description: 'Update page metadata (title, slug, SEO). Does not modify blocks.',
            schema: z.object({
                pageId: z.string().describe('The page ID to update'),
                title: z.string().optional().describe('New page title'),
                slug: z.string().optional().describe('New URL slug'),
                seoTitle: z.string().optional().describe('New SEO title'),
                seoDescription: z.string().optional().describe('New SEO description'),
            }),
            func: async ({ pageId, ...updates }) => {
                try {
                    const page = await PagesManagementService.update(userId, pageId, updates)
                    return JSON.stringify(page, null, 2)
                } catch (error) {
                    return `Error updating page: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
        {
            name: 'delete_page',
            description: 'Delete a page permanently. This cannot be undone.',
            schema: z.object({
                pageId: z.string().describe('The page ID to delete'),
            }),
            func: async ({ pageId }) => {
                try {
                    const success = await PagesManagementService.delete(userId, pageId)
                    return JSON.stringify({
                        success,
                        message: success ? 'Page deleted successfully' : 'Failed to delete page',
                    })
                } catch (error) {
                    return `Error deleting page: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },

        // ============================================
        // BLOCK OPERATIONS
        // ============================================
        {
            name: 'add_block',
            description: 'Add a new block to a page. Use list_available_blocks to see available block types.',
            schema: z.object({
                pageId: z.string().describe('The page ID to add the block to'),
                blockSlug: z.string().describe('Block type slug (e.g., hero, cta-section, features-grid)'),
                props: z.record(z.string(), z.unknown())
                    .optional()
                    .default({})
                    .describe('Block properties (title, content, etc.)'),
                position: z.number()
                    .optional()
                    .describe('Position in the page (0 = first). Appends to end if not specified.'),
            }),
            func: async ({ pageId, blockSlug, props, position }) => {
                try {
                    const page = await PagesManagementService.addBlock(
                        userId, pageId, blockSlug, props || {}, position
                    )
                    return JSON.stringify(page, null, 2)
                } catch (error) {
                    return `Error adding block: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
        {
            name: 'update_block',
            description: 'Update a block properties. Only specify properties you want to change.',
            schema: z.object({
                pageId: z.string().describe('The page ID containing the block'),
                blockId: z.string().describe('The block instance ID to update'),
                props: z.record(z.string(), z.unknown()).describe('Properties to update (merged with existing)'),
            }),
            func: async ({ pageId, blockId, props }) => {
                try {
                    const page = await PagesManagementService.updateBlock(userId, pageId, blockId, props)
                    return JSON.stringify(page, null, 2)
                } catch (error) {
                    return `Error updating block: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
        {
            name: 'remove_block',
            description: 'Remove a block from a page.',
            schema: z.object({
                pageId: z.string().describe('The page ID containing the block'),
                blockId: z.string().describe('The block instance ID to remove'),
            }),
            func: async ({ pageId, blockId }) => {
                try {
                    const page = await PagesManagementService.removeBlock(userId, pageId, blockId)
                    return JSON.stringify(page, null, 2)
                } catch (error) {
                    return `Error removing block: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
        {
            name: 'reorder_blocks',
            description: 'Reorder blocks in a page by providing the block IDs in the new order.',
            schema: z.object({
                pageId: z.string().describe('The page ID to reorder blocks in'),
                blockIds: z.array(z.string()).describe('Block IDs in the desired order'),
            }),
            func: async ({ pageId, blockIds }) => {
                try {
                    const page = await PagesManagementService.reorderBlocks(userId, pageId, blockIds)
                    return JSON.stringify(page, null, 2)
                } catch (error) {
                    return `Error reordering blocks: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },

        // ============================================
        // PUBLICATION
        // ============================================
        {
            name: 'publish_page',
            description: 'Publish a draft page to make it live and accessible.',
            schema: z.object({
                pageId: z.string().describe('The page ID to publish'),
            }),
            func: async ({ pageId }) => {
                try {
                    const page = await PagesManagementService.publish(userId, pageId)
                    return JSON.stringify({
                        ...page,
                        message: `Page published successfully. View at: /p/${page.slug}`,
                    }, null, 2)
                } catch (error) {
                    return `Error publishing page: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
        {
            name: 'unpublish_page',
            description: 'Unpublish a page (set to draft). It will no longer be publicly accessible.',
            schema: z.object({
                pageId: z.string().describe('The page ID to unpublish'),
            }),
            func: async ({ pageId }) => {
                try {
                    const page = await PagesManagementService.unpublish(userId, pageId)
                    return JSON.stringify({
                        ...page,
                        message: 'Page unpublished successfully. It is now a draft.',
                    }, null, 2)
                } catch (error) {
                    return `Error unpublishing page: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },

        // ============================================
        // DISCOVERY
        // ============================================
        {
            name: 'list_available_blocks',
            description: 'Get information about available block types that can be added to pages.',
            schema: z.object({
                category: z.string()
                    .optional()
                    .describe('Filter by category (hero, content, features, cta, testimonials, etc.)'),
            }),
            func: async ({ category }) => {
                try {
                    const allBlocks = Object.values(BLOCK_REGISTRY)
                    const filteredBlocks = category
                        ? allBlocks.filter(b => b.category === category)
                        : allBlocks

                    return JSON.stringify({
                        blocks: filteredBlocks.map(b => ({
                            slug: b.slug,
                            name: b.name,
                            description: b.description,
                            category: b.category,
                        })),
                        total: filteredBlocks.length,
                        categories: [...new Set(allBlocks.map(b => b.category))],
                    }, null, 2)
                } catch (error) {
                    return `Error listing available blocks: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
    ]
}
