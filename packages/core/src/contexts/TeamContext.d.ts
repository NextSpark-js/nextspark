import { ReactNode } from 'react';
import { Team, UserTeamMembership } from '../lib/teams/types';
interface TeamContextValue {
    currentTeam: Team | null;
    userTeams: UserTeamMembership[];
    isLoading: boolean;
    isSwitching: boolean;
    canCurrentUserCreateTeam: boolean;
    switchTeam: (teamId: string) => Promise<void>;
    refreshTeams: () => Promise<void>;
}
export declare function TeamProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
export declare function useTeamContext(): TeamContextValue;
export {};
//# sourceMappingURL=TeamContext.d.ts.map