/**
 * Testing and Accessibility Types
 * Centralized attributes for test automation and accessibility compliance
 */
/**
 * Testing attributes for automation (Cypress, Jest, etc.)
 */
export interface TestingProps {
    'data-testid'?: string;
    'data-cy'?: string;
    'data-state'?: 'active' | 'completed' | 'pending' | 'loading' | 'error';
    'data-priority'?: 'low' | 'medium' | 'high';
    'data-status'?: 'active' | 'completed' | 'pending';
    'data-task-id'?: string;
    'data-user-id'?: string;
}
/**
 * Accessibility attributes for WCAG compliance
 */
export interface AccessibilityProps {
    'aria-label'?: string;
    'aria-labelledby'?: string;
    'aria-describedby'?: string;
    'aria-expanded'?: boolean;
    'aria-selected'?: boolean;
    'aria-checked'?: boolean | 'mixed';
    'aria-disabled'?: boolean;
    'aria-hidden'?: boolean;
    'aria-live'?: 'off' | 'polite' | 'assertive';
    'aria-atomic'?: boolean;
    'aria-controls'?: string;
    'aria-activedescendant'?: string;
    'aria-haspopup'?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog';
    'role'?: 'button' | 'link' | 'menuitem' | 'option' | 'tab' | 'tabpanel' | 'dialog' | 'alertdialog' | 'region' | 'banner' | 'navigation' | 'main' | 'complementary' | 'contentinfo';
    'tabIndex'?: number;
}
/**
 * Combined props for components that need both testing and accessibility
 */
export interface ComponentTestingProps extends TestingProps, AccessibilityProps {
}
/**
 * Keyboard navigation props
 */
export interface KeyboardNavigationProps {
    onKeyDown?: (event: React.KeyboardEvent) => void;
    onKeyUp?: (event: React.KeyboardEvent) => void;
    onKeyPress?: (event: React.KeyboardEvent) => void;
}
/**
 * Focus management props
 */
export interface FocusManagementProps {
    autoFocus?: boolean;
    tabIndex?: number;
    onFocus?: (event: React.FocusEvent) => void;
    onBlur?: (event: React.FocusEvent) => void;
}
/**
 * Complete accessibility + testing props
 */
export interface FullAccessibilityProps extends ComponentTestingProps, KeyboardNavigationProps, FocusManagementProps {
}
/**
 * Component-specific testing attribute types
 */
export interface TaskTestingProps extends TestingProps {
    'data-task-id': string;
    'data-status': 'active' | 'completed';
    'data-priority'?: 'low' | 'medium' | 'high';
}
export interface NavigationTestingProps extends TestingProps {
    'data-nav-item': string;
    'data-current'?: boolean;
    'data-expanded'?: boolean;
}
export interface FormTestingProps extends TestingProps {
    'data-field-name': string;
    'data-field-type': 'input' | 'textarea' | 'select' | 'checkbox' | 'radio';
    'data-required'?: boolean;
    'data-invalid'?: boolean;
}
/**
 * Testing ID naming patterns
 */
export type TestIdPattern = `${string}-card` | `${string}-button` | `${string}-input` | `${string}-dropdown` | `${string}-modal` | `${string}-form` | `${string}-list` | `${string}-item` | `${string}-title` | `${string}-description` | `${string}-checkbox` | `${string}-toggle` | `${string}-menu` | `${string}-nav` | `${string}-search` | `${string}-notification`;
/**
 * Cypress ID naming patterns
 */
export type CypressIdPattern = `todo-${string}` | `task-${string}` | `nav-${string}` | `user-${string}` | `form-${string}` | `modal-${string}` | `dropdown-${string}` | `search-${string}` | `notification-${string}`;
//# sourceMappingURL=testing.types.d.ts.map