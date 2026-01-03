/**
 * Hook System for Plugin Architecture
 *
 * Provides a WordPress-like hook system for plugins to interact with the core
 */
type HookCallback<T = Record<string, unknown>> = (data: T, ...args: unknown[]) => Promise<T> | T;
type HookCallbackVoid<T = Record<string, unknown>> = (data: T, ...args: unknown[]) => Promise<void> | void;
/**
 * Hook system implementation
 */
export declare class HookSystem {
    private filters;
    private actions;
    private hookStats;
    /**
     * Add a filter hook
     * Filters allow plugins to modify data as it passes through the system
     */
    addFilter(hookName: string, callback: HookCallback, priority?: number): void;
    /**
     * Apply filter hooks to data
     */
    applyFilters<T>(hookName: string, data: T, ...args: unknown[]): Promise<T>;
    /**
     * Add an action hook
     * Actions allow plugins to execute code at specific points
     */
    addAction(hookName: string, callback: HookCallbackVoid, priority?: number): void;
    /**
     * Execute action hooks
     */
    doAction<T>(hookName: string, data: T, ...args: unknown[]): Promise<void>;
    /**
     * Emit an event (alias for doAction for semantic clarity)
     */
    emit<T>(eventName: string, data: T, ...args: unknown[]): Promise<void>;
    /**
     * Remove a filter hook
     */
    removeFilter(hookName: string, callback: HookCallback): boolean;
    /**
     * Remove an action hook
     */
    removeAction(hookName: string, callback: HookCallbackVoid): boolean;
    /**
     * Check if a hook has any callbacks
     */
    hasHook(hookName: string): boolean;
    /**
     * Get all registered hooks
     */
    getAllHooks(): {
        filters: string[];
        actions: string[];
    };
    /**
     * Record hook execution statistics
     */
    private recordHookStats;
    /**
     * Get hook execution statistics
     */
    getHookStats(): Record<string, {
        calls: number;
        totalTime: number;
        avgTime: number;
    }>;
    /**
     * Clear all hooks (useful for testing)
     */
    clear(): void;
    /**
     * Get hook count
     */
    getHookCount(): {
        filters: number;
        actions: number;
    };
}
declare global {
    var __HOOK_SYSTEM__: HookSystem | undefined;
}
/**
 * Create or get the global hook system
 * Uses globalThis to persist across module reloads in Next.js (Turbopack/Webpack)
 */
export declare function createHookSystem(): HookSystem;
/**
 * Get the global hook system
 */
export declare function getGlobalHooks(): HookSystem;
export declare const addFilter: (hookName: string, callback: HookCallback, priority?: number) => void;
export declare const applyFilters: <T>(hookName: string, data: T, ...args: unknown[]) => Promise<T>;
export declare const addAction: (hookName: string, callback: HookCallbackVoid, priority?: number) => void;
export declare const doAction: <T>(hookName: string, data: T, ...args: unknown[]) => Promise<void>;
export declare const emit: <T>(eventName: string, data: T, ...args: unknown[]) => Promise<void>;
export declare const removeFilter: (hookName: string, callback: HookCallback) => boolean;
export declare const removeAction: (hookName: string, callback: HookCallbackVoid) => boolean;
export declare const hasHook: (hookName: string) => boolean;
export declare const getAllHooks: () => {
    filters: string[];
    actions: string[];
};
export declare const getHookStats: () => Record<string, {
    calls: number;
    totalTime: number;
    avgTime: number;
}>;
export {};
//# sourceMappingURL=hook-system.d.ts.map