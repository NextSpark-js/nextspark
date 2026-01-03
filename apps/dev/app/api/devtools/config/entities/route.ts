import { auth } from "@nextsparkjs/core/lib/auth";
import { NextResponse } from "next/server";
import { ENTITY_REGISTRY } from "@nextsparkjs/registries/entity-registry";

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
  // Permissions are now optional in entity config (centralized in permissions.config.ts)
  permissions?: {
    actions: Array<{ action: string; label: string; description?: string }>;
    customActions?: Array<{ action: string; label: string; description?: string }>;
  };
}

/**
 * GET /api/devtools/config/entities
 *
 * Returns entity registry information
 * Only accessible to developer role
 */
export async function GET(request: Request) {
  try {
    // Verify developer role
    const session = await auth.api.getSession({ headers: request.headers });

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

    for (const [, entry] of Object.entries(ENTITY_REGISTRY)) {
      const config = entry.config;

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
        permissions: config.permissions,
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
}
