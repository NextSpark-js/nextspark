/**
 * Message Serializer for LangChain
 *
 * Handles serialization/deserialization of LangChain BaseMessage objects
 * to/from JSON for database storage.
 */

import {
    BaseMessage,
    HumanMessage,
    AIMessage,
    SystemMessage,
    ToolMessage,
} from '@langchain/core/messages'

/**
 * Serialized message format for database storage
 */
export interface SerializedMessage {
    type: 'human' | 'ai' | 'system' | 'tool'
    content: string
    name?: string
    additional_kwargs?: Record<string, unknown>
    response_metadata?: Record<string, unknown>
    tool_call_id?: string
}

/**
 * Serialize LangChain messages to JSON-compatible format
 */
export function serializeMessages(messages: BaseMessage[]): SerializedMessage[] {
    return messages.map((msg) => {
        // Convert content to string (it might be complex objects)
        const content = typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content)

        const serialized: SerializedMessage = {
            type: msg._getType() as SerializedMessage['type'],
            content,
        }

        if (msg.name) {
            serialized.name = msg.name
        }

        if (msg.additional_kwargs && Object.keys(msg.additional_kwargs).length > 0) {
            serialized.additional_kwargs = msg.additional_kwargs
        }

        // AIMessage has response_metadata
        if (msg._getType() === 'ai' && (msg as AIMessage).response_metadata) {
            serialized.response_metadata = (msg as AIMessage).response_metadata
        }

        // ToolMessage has tool_call_id
        if (msg._getType() === 'tool' && (msg as ToolMessage).tool_call_id) {
            serialized.tool_call_id = (msg as ToolMessage).tool_call_id
        }

        return serialized
    })
}

/**
 * Deserialize JSON messages back to LangChain BaseMessage objects
 */
export function deserializeMessages(serialized: SerializedMessage[]): BaseMessage[] {
    return serialized.map((msg) => {
        switch (msg.type) {
            case 'human':
                return new HumanMessage({
                    content: msg.content,
                    name: msg.name,
                    additional_kwargs: msg.additional_kwargs,
                })

            case 'ai':
                return new AIMessage({
                    content: msg.content,
                    name: msg.name,
                    additional_kwargs: msg.additional_kwargs,
                    response_metadata: msg.response_metadata,
                })

            case 'system':
                return new SystemMessage({
                    content: msg.content,
                    name: msg.name,
                    additional_kwargs: msg.additional_kwargs,
                })

            case 'tool':
                return new ToolMessage({
                    content: msg.content,
                    tool_call_id: msg.tool_call_id || '',
                    name: msg.name,
                    additional_kwargs: msg.additional_kwargs,
                })

            default:
                // Fallback to HumanMessage for unknown types
                return new HumanMessage({
                    content: msg.content,
                    name: msg.name,
                    additional_kwargs: msg.additional_kwargs,
                })
        }
    })
}
