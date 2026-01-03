import type { BlockInstance } from '@nextsparkjs/core/types/blocks';
interface PageRendererProps {
    page: {
        id: string;
        title: string;
        slug: string;
        blocks: BlockInstance[];
        locale: string;
    };
}
export declare function PageRenderer({ page }: PageRendererProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=page-renderer.d.ts.map