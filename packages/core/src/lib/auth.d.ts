export declare const auth: any;
export type Session = typeof auth.$Infer.Session;
export type SessionUser = typeof auth.$Infer.Session.user & {
    name?: string;
    firstName?: string;
    lastName?: string;
    country?: string;
    timezone?: string;
    language?: string;
    flags?: import('./entities/types').UserFlag[];
};
//# sourceMappingURL=auth.d.ts.map