import { revalidateTag as nextRevalidateTag } from 'next/cache'

/**
 * `revalidateTag` as Next 16 spells it. Next 15 declares a single parameter and
 * Next 16 requires the second one, so neither call type-checks on both majors
 * and the cast is what lets one spelling serve the two.
 */
type TagRevalidator = (tag: string, profile: { expire: number }) => void

const revalidateTagOnEitherMajor = nextRevalidateTag as unknown as TagRevalidator

/**
 * Expire everything cached under `tag`, immediately.
 *
 * The profile is `{ expire: 0 }` and not a named one such as `'max'` because
 * Next 16 routes `expire === 0` through the same branch as a missing profile:
 * the path counts as revalidated for static and dynamic data, which is the
 * invalidation Next 15 performs with no profile at all. A named profile would
 * turn every caller into stale-while-revalidate instead. `updateTag` expires
 * immediately too, but it throws outside a Server Action, and this helper is
 * also reachable from route handlers. On Next 15 the second argument reaches a
 * function declared with one parameter and is ignored.
 */
export function revalidateTag(tag: string): void {
  revalidateTagOnEitherMajor(tag, { expire: 0 })
}
