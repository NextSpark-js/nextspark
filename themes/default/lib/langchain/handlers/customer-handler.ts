/**
 * Customer Handler Node
 *
 * Executes customer operations directly without additional LLM calls.
 * Uses the CustomersService to perform CRUD operations.
 */

import { CustomersService } from '@/themes/default/entities/customers/customers.service'
import { tracer } from '@/plugins/langchain/lib/tracer'
import { config as pluginConfig } from '@/plugins/langchain/plugin.config'
import { createAgentLogger } from '@/plugins/langchain/lib/logger'
import type { OrchestratorState, CustomerHandlerResult, CustomerData, IntentType } from '@/plugins/langchain/lib/graph/types'

/**
 * Transform Customer entity to CustomerData for handler result
 */
function toCustomerData(customer: any): CustomerData {
    return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        accountNumber: customer.account?.toString(),
        office: customer.office,
        salesRep: customer.salesRep,
    }
}

/**
 * Execute customer operation based on intent
 */
async function executeCustomerOperation(
    action: string,
    parameters: Record<string, unknown>,
    context: { userId: string; teamId: string }
): Promise<CustomerHandlerResult> {
    const { userId, teamId } = context

    try {
        switch (action) {
            case 'list': {
                const { customers, total } = await CustomersService.list(userId, {
                    limit: 50,
                    orderBy: 'name',
                    orderDir: 'asc',
                })

                return {
                    success: true,
                    operation: 'list',
                    data: customers.map(toCustomerData),
                    count: total,
                    message: `Found ${total} customer(s)`,
                }
            }

            case 'get': {
                const id = parameters.id as string
                if (!id) {
                    return {
                        success: false,
                        operation: 'get',
                        data: null,
                        message: 'Customer ID is required',
                        error: 'Missing customer ID',
                    }
                }

                const customer = await CustomersService.getById(id, userId)
                if (!customer) {
                    return {
                        success: false,
                        operation: 'get',
                        data: null,
                        message: 'Customer not found',
                        error: 'Customer not found',
                    }
                }

                return {
                    success: true,
                    operation: 'get',
                    data: toCustomerData(customer),
                    message: `Found customer: ${customer.name}`,
                }
            }

            case 'search': {
                const query = parameters.query as string
                if (!query) {
                    return {
                        success: false,
                        operation: 'search',
                        data: null,
                        message: 'Search query is required',
                        error: 'Missing search query',
                    }
                }

                const customers = await CustomersService.search(userId, {
                    query,
                    limit: 20,
                })

                // If user asked for specific fields, include them in message
                const fields = parameters.fields as string[] | undefined
                let fieldInfo = ''
                if (fields && fields.length > 0 && customers.length > 0) {
                    const customer = customers[0]
                    const values = fields.map((f) => {
                        if (f === 'accountNumber' || f === 'account') {
                            return `account: ${customer.account}`
                        }
                        if (f === 'phone') {
                            return `phone: ${customer.phone || 'N/A'}`
                        }
                        return null
                    }).filter(Boolean)
                    if (values.length > 0) {
                        fieldInfo = ` (${values.join(', ')})`
                    }
                }

                return {
                    success: true,
                    operation: 'search',
                    data: customers.map(toCustomerData),
                    count: customers.length,
                    message: `Found ${customers.length} customer(s) matching "${query}"${fieldInfo}`,
                }
            }

            case 'create': {
                const name = parameters.name as string
                if (!name) {
                    return {
                        success: false,
                        operation: 'create',
                        data: null,
                        message: 'Customer name is required',
                        error: 'Missing name',
                    }
                }

                const account = parameters.account as number || Math.floor(Math.random() * 100000)
                const office = parameters.office as string || 'Main'

                const customer = await CustomersService.create(userId, {
                    name,
                    account,
                    office,
                    phone: parameters.phone as string | undefined,
                    salesRep: parameters.salesRep as string | undefined,
                    teamId,
                })

                return {
                    success: true,
                    operation: 'create',
                    data: toCustomerData(customer),
                    message: `Created customer: ${customer.name}`,
                }
            }

            case 'update': {
                const id = parameters.id as string
                if (!id) {
                    return {
                        success: false,
                        operation: 'update',
                        data: null,
                        message: 'Customer ID is required',
                        error: 'Missing customer ID',
                    }
                }

                const updateData: Record<string, unknown> = {}
                if (parameters.name) updateData.name = parameters.name
                if (parameters.account !== undefined) updateData.account = parameters.account
                if (parameters.office) updateData.office = parameters.office
                if (parameters.phone !== undefined) updateData.phone = parameters.phone
                if (parameters.salesRep !== undefined) updateData.salesRep = parameters.salesRep

                const customer = await CustomersService.update(userId, id, updateData)

                return {
                    success: true,
                    operation: 'update',
                    data: toCustomerData(customer),
                    message: `Updated customer: ${customer.name}`,
                }
            }

            case 'delete': {
                const id = parameters.id as string
                if (!id) {
                    return {
                        success: false,
                        operation: 'delete',
                        data: null,
                        message: 'Customer ID is required',
                        error: 'Missing customer ID',
                    }
                }

                const success = await CustomersService.delete(userId, id)
                if (!success) {
                    return {
                        success: false,
                        operation: 'delete',
                        data: null,
                        message: 'Failed to delete customer',
                        error: 'Delete operation failed',
                    }
                }

                return {
                    success: true,
                    operation: 'delete',
                    data: null,
                    message: 'Customer deleted successfully',
                }
            }

            default:
                return {
                    success: false,
                    operation: 'unknown',
                    data: null,
                    message: `Unknown action: ${action}`,
                    error: `Unsupported action: ${action}`,
                }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return {
            success: false,
            operation: action as any,
            data: null,
            message: `Failed to execute ${action}: ${errorMessage}`,
            error: errorMessage,
        }
    }
}

/**
 * Customer handler node
 *
 * Executes customer operations without additional LLM calls.
 * Returns JSON result for combiner to format.
 */
export async function customerHandlerNode(
    state: OrchestratorState
): Promise<Partial<OrchestratorState>> {
    const { context, traceId, loggerTimestamp } = state
    const logger = createAgentLogger({
        agentName: 'graph-orchestrator',
        userName: (context.userName as string) || 'system',
        timestamp: loggerTimestamp,
    })

    // Find customer intent
    const customerIntent = state.intents.find((i) => i.type === 'customer')

    if (!customerIntent) {
        // No customer intent, skip
        return {
            completedHandlers: [...state.completedHandlers, 'customer' as IntentType],
        }
    }

    // Start span for customer handler
    const spanContext = traceId
        ? await tracer.startSpan(
              { userId: context.userId, teamId: context.teamId },
              traceId,
              {
                  name: 'customer-handler',
                  type: 'tool',
                  toolName: `customer_${customerIntent.action}`,
                  input: customerIntent.parameters,
              }
          )
        : null

    await logger.info('CUSTOMER_HANDLER_INPUT', {
        action: customerIntent.action,
        parameters: customerIntent.parameters,
    })

    if (pluginConfig.debug) {
        console.log('[CustomerHandler] Executing:', customerIntent.action, customerIntent.parameters)
    }

    const result = await executeCustomerOperation(
        customerIntent.action,
        customerIntent.parameters,
        {
            userId: state.context.userId,
            teamId: state.context.teamId as string,
        }
    )

    await logger.info('CUSTOMER_HANDLER_OUTPUT', {
        success: result.success,
        operation: result.operation,
        message: result.message,
        count: result.count,
        data: result.data,
    })

    if (pluginConfig.debug) {
        console.log('[CustomerHandler] Result:', result.success, result.message)
    }

    // End span
    if (spanContext && traceId) {
        await tracer.endSpan(
            { userId: context.userId, teamId: context.teamId },
            traceId,
            spanContext.spanId,
            {
                output: { success: result.success, message: result.message, count: result.count },
                toolInput: customerIntent.parameters,
                toolOutput: result,
                error: result.error ? new Error(result.error) : undefined,
            }
        )
    }

    return {
        handlerResults: {
            ...state.handlerResults,
            customer: result,
        },
        completedHandlers: [...state.completedHandlers, 'customer' as IntentType],
    }
}
