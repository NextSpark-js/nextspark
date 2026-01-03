import type { Team } from '../../lib/teams/types';
interface TeamSwitchModalProps {
    isOpen: boolean;
    fromTeam: Team | null;
    toTeam: Team | null;
    onComplete: () => void;
}
/**
 * TeamSwitchModal - Animated modal for team switching transition
 *
 * Shows a visual transition when the user switches between teams,
 * providing clear feedback and triggering data reload.
 */
export declare function TeamSwitchModal({ isOpen, fromTeam, toTeam, onComplete, }: TeamSwitchModalProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=TeamSwitchModal.d.ts.map