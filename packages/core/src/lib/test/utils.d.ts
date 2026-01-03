/**
 * Testing Utilities
 * Helper functions for consistent testing attribute generation
 */
/**
 * Create consistent test IDs following the pattern: [component]-[element]-[action?]
 *
 * @param component - Main component name (e.g., 'task', 'nav', 'user')
 * @param element - Element type (e.g., 'card', 'button', 'input')
 * @param action - Optional action (e.g., 'delete', 'edit', 'toggle')
 * @returns Test ID string or undefined in production
 */
export declare function createTestId(component: string, element: string, action?: string): string | undefined;
/**
 * Create Cypress-specific IDs following the pattern: [domain]-[element]
 *
 * @param domain - Application domain (e.g., 'todo', 'nav', 'user')
 * @param element - Element identifier (e.g., 'item', 'button', 'menu')
 * @returns Cypress ID string or undefined in production
 */
export declare function createCyId(domain: string, element: string): string | undefined;
/**
 * Create state-based data attributes for conditional testing
 *
 * @param state - Current state value
 * @returns State attribute value
 */
export declare function createStateAttr(state: 'active' | 'completed' | 'pending' | 'loading' | 'error'): string;
/**
 * Create priority-based data attributes
 *
 * @param priority - Priority level
 * @returns Priority attribute value
 */
export declare function createPriorityAttr(priority: 'low' | 'medium' | 'high'): string;
/**
 * Generate testing props object for components
 *
 * @param config - Testing configuration
 * @returns Testing props object
 */
export declare function createTestingProps(config: {
    testId?: string;
    cyId?: string;
    state?: 'active' | 'completed' | 'pending' | 'loading' | 'error';
    priority?: 'low' | 'medium' | 'high';
    taskId?: string;
    userId?: string;
}): {
    [k: string]: string;
};
/**
 * Accessibility helper for dynamic aria-label generation
 *
 * @param template - Label template with placeholders
 * @param values - Values to replace placeholders
 * @returns Formatted aria-label
 */
export declare function createAriaLabel(template: string, values: Record<string, string | number | boolean>): string;
/**
 * Common testing patterns for different component types
 */
export declare const testingPatterns: {
    task: {
        card: (taskId: string) => {
            [k: string]: string;
        };
        checkbox: () => {
            [k: string]: string;
        };
        title: () => {
            [k: string]: string;
        };
        deleteButton: () => {
            [k: string]: string;
        };
    };
    nav: {
        searchDropdown: () => {
            [k: string]: string;
        };
        notifications: () => {
            [k: string]: string;
        };
        userMenu: () => {
            [k: string]: string;
        };
    };
    form: {
        input: (fieldName: string) => {
            [k: string]: string;
        };
        submitButton: () => {
            [k: string]: string;
        };
    };
};
/**
 * Keyboard navigation helpers
 */
export declare const keyboardHelpers: {
    /**
     * Handle Enter and Space key activation
     */
    createActivationHandler: (onActivate: () => void) => (e: React.KeyboardEvent) => void;
    /**
     * Handle Escape key for closing
     */
    createEscapeHandler: (onClose: () => void) => (e: React.KeyboardEvent) => void;
    /**
     * Handle arrow navigation in lists
     */
    createArrowNavigationHandler: (currentIndex: number, maxIndex: number, onIndexChange: (index: number) => void) => (e: React.KeyboardEvent) => void;
};
/**
 * Create entity-specific Cypress ID following the convention: {slug}-{component}-{detail?}
 *
 * @param entitySlug - Entity slug from config (e.g., 'squads', 'people', 'projects')
 * @param component - Component type (e.g., 'form', 'field', 'section', 'table')
 * @param detail - Optional detail (e.g., field name, section name, action)
 * @returns Cypress ID string or undefined in production
 *
 * @example
 * createEntityCyId('squads', 'form')           // 'squads-form'
 * createEntityCyId('squads', 'field', 'name')  // 'squads-field-name'
 * createEntityCyId('squads', 'form', 'submit') // 'squads-form-submit'
 */
export declare function createEntityCyId(entitySlug: string, component: string, detail?: string): string | undefined;
/**
 * Entity testing helper interface
 */
export interface EntityTestingHelper {
    /** Generic selector: {slug}-{component}-{detail?} - Use for custom/non-standard selectors */
    get: (component: string, detail?: string) => string | undefined;
    /** {slug}-page */
    page: () => string | undefined;
    /** {slug}-form-page */
    formPage: () => string | undefined;
    /** {slug}-form */
    form: () => string | undefined;
    /** {slug}-form-submit */
    formSubmit: () => string | undefined;
    /** {slug}-form-cancel */
    formCancel: () => string | undefined;
    /** {slug}-field-{name} */
    field: (name: string) => string | undefined;
    /** {slug}-field-{name}-option-{value} */
    fieldOption: (name: string, value: string) => string | undefined;
    /** {slug}-field-{name}-error */
    fieldError: (name: string) => string | undefined;
    /** {slug}-section-{name} */
    section: (name: string) => string | undefined;
    /** {slug}-card-{id} */
    card: (id: string) => string | undefined;
    /** {slug}-table */
    table: () => string | undefined;
    /** {slug}-row-{id} */
    row: (id: string) => string | undefined;
    /** {slug}-create-btn */
    createBtn: () => string | undefined;
    /** {slug}-search-input */
    searchInput: () => string | undefined;
    /** {slug}-filter-{field} */
    filter: (field: string) => string | undefined;
    /** {slug}-filter-{field}-trigger */
    filterTrigger: (field: string) => string | undefined;
    /** {slug}-filter-{field}-option-{value} */
    filterOption: (field: string, value: string) => string | undefined;
    /** {slug}-action-{action}-{id} */
    action: (action: string, id: string) => string | undefined;
    /** {slug}-actions-trigger-{id} */
    actionsTrigger: (id: string) => string | undefined;
    /** {slug}-confirm-delete */
    confirmDelete: () => string | undefined;
    /** {slug}-confirm-delete-btn */
    confirmDeleteBtn: () => string | undefined;
    /** {slug}-cancel-delete-btn */
    cancelDeleteBtn: () => string | undefined;
}
/**
 * Create a testing helper factory for a specific entity.
 * Uses the entity slug from config to generate consistent data-cy selectors.
 *
 * Convention: {slug}-{component}-{detail}
 *
 * @param entitySlug - Entity slug from EntityConfig (e.g., 'squads', 'people')
 * @returns EntityTestingHelper with pre-bound selector generators
 *
 * @example
 * // In your component file:
 * import { createEntityTestingHelper } from './'
 * import { squadsEntityConfig } from './squads.config'
 *
 * const testId = createEntityTestingHelper(squadsEntityConfig.slug)
 *
 * // Usage in JSX:
 * <div data-cy={testId.formPage()}>           // squads-form-page
 *   <form data-cy={testId.form()}>            // squads-form
 *     <div data-cy={testId.section('basic')}> // squads-section-basic
 *       <input data-cy={testId.field('name')} /> // squads-field-name
 *     </div>
 *     <button data-cy={testId.formSubmit()}>  // squads-form-submit
 *       Submit
 *     </button>
 *   </form>
 * </div>
 *
 * // Card example:
 * <Card data-cy={testId.card(squad.id)}>     // squads-card-{id}
 *
 * // Custom selector example (for non-standard selectors):
 * <div data-cy={testId.get('color-preset', color)}>  // squads-color-preset-{color}
 */
export declare function createEntityTestingHelper(entitySlug: string): EntityTestingHelper;
//# sourceMappingURL=utils.d.ts.map