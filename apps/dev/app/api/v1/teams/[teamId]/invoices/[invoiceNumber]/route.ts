import { NextRequest, NextResponse } from 'next/server'
import { queryWithRLS } from '@nextsparkjs/core/lib/db'
import {
  createApiResponse,
  createApiError,
  withApiLogging,
  handleCorsPreflightRequest,
  addCorsHeaders,
} from '@nextsparkjs/core/lib/api/helpers'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { MembershipService } from '@nextsparkjs/core/lib/services'
import type { InvoiceResponse } from '@nextsparkjs/core/lib/validation/invoices'

// Handle CORS preflight
export async function OPTIONS() {
  return handleCorsPreflightRequest()
}

// GET /api/v1/teams/:teamId/invoices/:invoiceNumber - Get single invoice (owner only)
export const GET = withRateLimitTier(withApiLogging(
  async (
    req: NextRequest,
    { params }: { params: Promise<{ teamId: string; invoiceNumber: string }> }
  ): Promise<NextResponse> => {
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

      const { teamId, invoiceNumber } = await params

      // Validate that teamId is not empty
      if (!teamId || teamId.trim() === '') {
        const response = createApiError('Team ID is required', 400, null, 'MISSING_TEAM_ID')
        return addCorsHeaders(response)
      }

      // Validate that invoiceNumber is not empty
      if (!invoiceNumber || invoiceNumber.trim() === '') {
        const response = createApiError('Invoice number is required', 400, null, 'MISSING_INVOICE_NUMBER')
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

      // Query single invoice by invoiceNumber
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
        WHERE "teamId" = $1 AND "invoiceNumber" = $2
        LIMIT 1`,
        [teamId, decodeURIComponent(invoiceNumber)],
        authResult.user!.id
      )

      if (invoices.length === 0) {
        const response = createApiError('Invoice not found', 404, null, 'INVOICE_NOT_FOUND')
        return addCorsHeaders(response)
      }

      const response = createApiResponse(invoices[0])
      return addCorsHeaders(response)
    } catch (error) {
      console.error('Error fetching invoice:', error)
      const response = createApiError('Internal server error', 500)
      return addCorsHeaders(response)
    }
  }
), 'read')
