export declare function useLastAuthMethod(): {
    lastMethod: import("../types/auth").AuthProviderWithNull;
    saveAuthMethod: (method: 'email' | 'google') => void;
    clearAuthMethod: () => void;
    isReady: boolean;
};
//# sourceMappingURL=useLastAuthMethod.d.ts.map