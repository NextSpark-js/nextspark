import type { NextRequest } from 'next/server'
import { OPTIONS, GET as getUser, PATCH as patchUser } from '@nextsparkjs/core/routes/api/v1/users/[id]/route'

// /api/v1/users/me: the signed-in user (session cookie or API key: `x-api-key` or `Authorization: Bearer`). The static segment wins
// over [id]; the handlers are /users/:id's own, which resolve "me" to the caller after authenticating, so
// the scopes, field allowlist and checks are the same ones. No DELETE: an account is deleted by id.
const me = { params: Promise.resolve({ id: 'me' }) }

export { OPTIONS }
export const GET = (req: NextRequest) => getUser(req, me)
export const PATCH = (req: NextRequest) => patchUser(req, me)
