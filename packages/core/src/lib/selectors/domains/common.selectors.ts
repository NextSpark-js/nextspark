/**
 * Common Selectors
 *
 * Shared selectors used across multiple components:
 * - Permission denied
 * - Loading states
 * - Error messages
 * - Toasts
 * - Modals
 */

export const COMMON_SELECTORS = {
  permissionDenied: 'permission-denied',
  loading: 'loading-spinner',
  error: 'error-message',
  toast: 'toast-{type}',
  modal: {
    overlay: 'modal-overlay',
    container: 'modal-container',
    title: 'modal-title',
    close: 'modal-close',
    content: 'modal-content',
    footer: 'modal-footer',
  },
  aiChat: {
    messageInput: 'ai-chat-message-input',
    sendBtn: 'ai-chat-send-btn',
    messageList: 'ai-chat-message-list',
    errorMessage: 'ai-chat-error-message',
    messageUser: 'ai-chat-message-user',
    messageAssistant: 'ai-chat-message-assistant',
    typingIndicator: 'ai-chat-typing-indicator',
    panel: 'ai-chat-panel',
    clearBtn: 'ai-chat-clear-btn',
    cancelBtn: 'ai-chat-cancel-btn',
  },
} as const

export type CommonSelectorsType = typeof COMMON_SELECTORS
