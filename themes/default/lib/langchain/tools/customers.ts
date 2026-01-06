import { z } from 'zod'
import { ToolDefinition } from '@/plugins/langchain/lib/tools-builder'
import { CustomersService } from '@/themes/default/entities/customers/customers.service'
import type { DayOfWeek } from '@/themes/default/entities/customers/customers.types'

/**
 * Tool context for customer operations
 */
export interface CustomerToolContext {
    userId: string
    teamId: string
}

/**
 * Create customer management tools for the AI agent
 *
 * @param context - User and team context for RLS
 * @returns Array of customer-related tool definitions
 */
export function createCustomerTools(context: CustomerToolContext): ToolDefinition<any>[] {
    const { userId, teamId } = context

    return [
        {
            name: 'list_customers',
            description: 'List all customers with optional pagination and sorting.',
            schema: z.object({
                limit: z.number().optional().default(20).describe('Max customers to return'),
                offset: z.number().optional().default(0).describe('Offset for pagination'),
                orderBy: z.enum(['name', 'account', 'office', 'salesRep', 'createdAt'])
                    .optional()
                    .describe('Field to order by'),
                orderDir: z.enum(['asc', 'desc'])
                    .optional()
                    .describe('Order direction'),
            }),
            func: async (params) => {
                try {
                    const result = await CustomersService.list(userId, params)
                    return JSON.stringify({
                        customers: result.customers.map(c => ({
                            id: c.id,
                            name: c.name,
                            account: c.account,
                            office: c.office,
                            salesRep: c.salesRep,
                            phone: c.phone,
                        })),
                        total: result.total,
                    }, null, 2)
                } catch (error) {
                    return `Error listing customers: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
        {
            name: 'search_customers',
            description: 'Search customers by name, account number, office, or sales representative.',
            schema: z.object({
                query: z.string().describe('Search term to match against customer fields'),
                limit: z.number().optional().default(10).describe('Max results to return'),
            }),
            func: async (params) => {
                try {
                    const results = await CustomersService.search(userId, params)
                    return JSON.stringify(results.map(c => ({
                        id: c.id,
                        name: c.name,
                        account: c.account,
                        office: c.office,
                        salesRep: c.salesRep,
                        phone: c.phone,
                    })), null, 2)
                } catch (error) {
                    return `Error searching customers: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
        {
            name: 'get_customer',
            description: 'Get full details of a specific customer by ID.',
            schema: z.object({
                customerId: z.string().describe('The customer ID to retrieve'),
            }),
            func: async ({ customerId }) => {
                try {
                    const customer = await CustomersService.getById(customerId, userId)
                    if (!customer) {
                        return JSON.stringify({ error: 'Customer not found' })
                    }
                    return JSON.stringify(customer, null, 2)
                } catch (error) {
                    return `Error getting customer: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
        {
            name: 'create_customer',
            description: 'Create a new customer. Name, account number, and office are required.',
            schema: z.object({
                name: z.string().describe('Customer or company name'),
                account: z.number().describe('Unique account number'),
                office: z.string().describe('Office location or branch'),
                phone: z.string().optional().describe('Contact phone number'),
                salesRep: z.string().optional().describe('Assigned sales representative'),
                visitDays: z.array(z.enum(['lun', 'mar', 'mie', 'jue', 'vie']))
                    .optional()
                    .describe('Days for in-person visits'),
                contactDays: z.array(z.enum(['lun', 'mar', 'mie', 'jue', 'vie']))
                    .optional()
                    .describe('Days for phone/email contact'),
            }),
            func: async (data) => {
                try {
                    const customer = await CustomersService.create(userId, {
                        ...data,
                        visitDays: data.visitDays as DayOfWeek[] | undefined,
                        contactDays: data.contactDays as DayOfWeek[] | undefined,
                        teamId,
                    })
                    return JSON.stringify(customer, null, 2)
                } catch (error) {
                    return `Error creating customer: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
        {
            name: 'update_customer',
            description: 'Update an existing customer. Only specify fields you want to change.',
            schema: z.object({
                customerId: z.string().describe('The customer ID to update'),
                name: z.string().optional().describe('New customer name'),
                account: z.number().optional().describe('New account number'),
                office: z.string().optional().describe('New office location'),
                phone: z.string().optional().describe('New phone number'),
                salesRep: z.string().optional().describe('New sales representative'),
                visitDays: z.array(z.enum(['lun', 'mar', 'mie', 'jue', 'vie']))
                    .optional()
                    .describe('New visit days'),
                contactDays: z.array(z.enum(['lun', 'mar', 'mie', 'jue', 'vie']))
                    .optional()
                    .describe('New contact days'),
            }),
            func: async ({ customerId, ...updates }) => {
                try {
                    const customer = await CustomersService.update(userId, customerId, {
                        ...updates,
                        visitDays: updates.visitDays as DayOfWeek[] | undefined,
                        contactDays: updates.contactDays as DayOfWeek[] | undefined,
                    })
                    return JSON.stringify(customer, null, 2)
                } catch (error) {
                    return `Error updating customer: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
        {
            name: 'delete_customer',
            description: 'Delete a customer permanently. This action cannot be undone.',
            schema: z.object({
                customerId: z.string().describe('The customer ID to delete'),
            }),
            func: async ({ customerId }) => {
                try {
                    const success = await CustomersService.delete(userId, customerId)
                    return JSON.stringify({
                        success,
                        message: success ? 'Customer deleted successfully' : 'Failed to delete customer',
                    })
                } catch (error) {
                    return `Error deleting customer: ${error instanceof Error ? error.message : 'Unknown error'}`
                }
            },
        },
    ]
}
