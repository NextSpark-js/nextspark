/**
 * `sel` bound to the `blockEditor` domain only: `import { sel } from '@nextsparkjs/core/selectors/block-editor'`.
 * Same paths and values as the barrel's `sel('blockEditor.…')`, without shipping the other domains to the page.
 */

import { createSelectorHelpers } from '../selector-factory'
import { BLOCK_EDITOR_SELECTORS } from '../domains/block-editor.selectors'

export { BLOCK_EDITOR_SELECTORS }
export const { sel, s, selDev, cySelector } = createSelectorHelpers({ blockEditor: BLOCK_EDITOR_SELECTORS })
