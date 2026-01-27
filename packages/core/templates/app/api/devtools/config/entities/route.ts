import { getTypedSession } from "@nextsparkjs/core/lib/auth";
import { NextResponse } from "next/server";
import { getEntityRegistry } from "@nextsparkjs/core/lib/entities/queries";
import type { EntityConfig, ChildEntityDefinition } from "@nextsparkjs/core/lib/entities/types";
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit';

// Type guard to check if entity is a full EntityConfig
function isEntityConfig(entity: EntityConfig | ChildEntityDefinition): entity is EntityConfig {
  return 'slug' in entity
}

/**
 * Entity information structure
 */
interface EntityInfo {
  slug: string;
  name: string;
  pluralName: string;
  icon: string;
  enabled: boolean;
  access: {
    public: boolean;
    api: boolean;
    metadata: boolean;
    shared: boolean;
  };
  fields: {
    name: string;
    type: string;
    label?: string;
    required?: boolean;
  }[];
  // Note: Permissions are now defined centrally in permissions.config.ts
  // Use PermissionService to query entity permissions
}

/**
 * GET /api/devtools/config/entities
 *
 * Returns entity registry information
 * Only accessible to developer role
 */
export const GET = withRateLimitTier(async (request: Request) => {
  try {
    // Verify developer role
    const session = await getTypedSession(request.headers);

    if (!session?.user || session.user.role !== "developer") {
      return NextResponse.json(
        {
          success: false,
          error: "Developer access required",
        },
        { status: 403 }
      );
    }

    // Build entity info array
    const entities: EntityInfo[] = [];
    const registry = getEntityRegistry();

    for (const [, entry] of Object.entries(registry)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config = (entry as any).config;
      if (!isEntityConfig(config)) continue;

      entities.push({
        slug: config.slug,
        name: config.names.singular,
        pluralName: config.names.plural,
        icon: config.icon?.name || 'Circle',
        enabled: config.enabled,
        access: config.access,
        fields: config.fields?.map((field: {
          name: string;
          type: string;
          label?: string;
          required?: boolean;
        }) => ({
          name: field.name,
          type: field.type,
          label: field.label,
          required: field.required,
        })) || [],
        // Note: Permissions are now centralized in permissions.config.ts
      });
    }

    // Sort entities alphabetically
    entities.sort((a, b) => a.slug.localeCompare(b.slug));

    return NextResponse.json(
      {
        success: true,
        data: {
          entities,
          count: entities.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[API] /api/devtools/config/entities error:", error);
    return NextResponse.json(
      {
        success: false,
        error: process.env.NODE_ENV === "production"
          ? "Failed to load entity configuration"
          : error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}, 'read');
