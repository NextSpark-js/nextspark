import { BlockDetailViewer } from "@nextsparkjs/core/components/devtools/BlockDetailViewer";
import { BLOCK_REGISTRY } from "@nextsparkjs/registries/block-registry";
import { notFound } from "next/navigation";

interface BlockDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

/**
 * Block Detail Page
 *
 * Displays detailed information about a specific page builder block.
 * Shows fields, configuration, and test coverage.
 */
export default async function BlockDetailPage({ params }: BlockDetailPageProps) {
  const { slug } = await params;

  // Verify block exists
  if (!BLOCK_REGISTRY[slug]) {
    notFound();
  }

  return (
    <div className="space-y-6" data-cy={`devtools-block-detail-${slug}`}>
      <BlockDetailViewer slug={slug} />
    </div>
  );
}

/**
 * Generate static params for all blocks
 */
export async function generateStaticParams() {
  return Object.keys(BLOCK_REGISTRY).map((slug) => ({
    slug,
  }));
}
