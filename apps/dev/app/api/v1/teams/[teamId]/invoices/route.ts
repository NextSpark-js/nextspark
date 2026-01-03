import { NextRequest, NextResponse } from 'next/server'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'
import {
  createApiResponse,
  createApiError,
  createPaginationMeta,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders,
} from '@nextsparkjs/core/lib/api/helpers'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { MembershipService } from '@nextsparkjs/core/lib/services'
import { invoiceQuerySchema } from '@nextsparkjs/core/lib/validation/invoices'
import type { InvoiceResponse } from '@nextsparkjs/core/lib/validation/invoices'

// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// GET /api/v1/teams/:teamId/invoices - List team invoices (owner only)
export const GET = withApiLogging(
  async (req: NextRequest, { params }: { params: Promise<{ teamId: string }> }): Promise<NextResponse> => {
    try {
      // Authenticate using dual auth (API key OR session)
      const authResult = await authenticateRequest(req)

      if (!authResult.success) {
        return NextResponse.json(
          { success: false, error: 'Authentication required', code: 'AUTHENTICATION_FAILED' },
          { status: 401 }
        )
      }

      if (authResult.rateLimitResponse) {
        return authResult.rateLimitResponse as NextResponse
      }

      const { teamId } = await params

      // Validate that teamId is not empty
      if (!teamId || teamId.trim() === '') {
        const response = createApiError('Team ID is required', 400, null, 'MISSING_TEAM_ID')
        return addCorsHeaders(response)
      }

      // Check if user has permission to view invoices using MembershipService
      const membership = await MembershipService.get(authResult.user!.id, teamId)
      const actionResult = membership.canPerformAction('billing.invoices')

      if (!actionResult.allowed) {
        const response = NextResponse.json(
          {
            success: false,
            error: actionResult.message,
            reason: actionResult.reason,
            meta: actionResult.meta,
          },
          { status: 403 }
        )
        return addCorsHeaders(response)
      }

      // Parse query parameters for pagination
      const { searchParams } = new URL(req.url)
      const queryParams = Object.fromEntries(
        Object.entries({
          limit: searchParams.get('limit'),
          offset: searchParams.get('offset'),
        }).filter(([, value]) => value !== null && value !== '')
      )

      const validatedQuery = invoiceQuerySchema.parse(queryParams)
      const { limit, offset } = validatedQuery

      // Query invoices with pagination (ordered by date DESC)
      const invoices = await queryWithRLS<InvoiceResponse>(
        `SELECT
          id,
          "teamId",
          "invoiceNumber",
          to_char(date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date,
          amount::NUMERIC(10,2)::FLOAT as amount,
          currency,
          status::TEXT as status,
          "pdfUrl",
          description,
          to_char("createdAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "createdAt",
          to_char("updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "updatedAt"
        FROM "invoices"
        WHERE "teamId" = $1
        ORDER BY date DESC
        LIMIT $2 OFFSET $3`,
        [teamId, limit, offset],
        authResult.user!.id
      )

      // Get total count for pagination
      const totalResult = await queryWithRLS<{ count: string }>(
        `SELECT COUNT(*) as count FROM "invoices" WHERE "teamId" = $1`,
        [teamId],
        authResult.user!.id
      )

      const total = parseInt(totalResult[0]?.count || '0', 10)

      // Calculate pagination metadata
      const page = Math.floor(offset / limit) + 1
      const paginationMeta = createPaginationMeta(page, limit, total)

      const response = createApiResponse(invoices, paginationMeta)
      return addCorsHeaders(response)
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        const zodError = error as { issues?: unknown[] }
        const response = createApiError('Validation error', 400, zodError.issues, 'VALIDATION_ERROR')
        return addCorsHeaders(response)
      }

      console.error('Error fetching invoices:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response)
    }
  }
)
