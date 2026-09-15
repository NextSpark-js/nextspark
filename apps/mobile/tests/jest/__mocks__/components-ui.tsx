/**
 * Mock for @/components/ui
 *
 * The real Button re-exports from @nextsparkjs/ui, a package that is not
 * resolvable from apps/mobile's isolated Jest run (outside the pnpm
 * workspace). Screens under test only need a pressable that respects
 * `disabled` and renders its children.
 */

import React from 'react'
import { Pressable, Text } from 'react-native'

export function Button({ children, onPress, disabled, testID }: any) {
  return (
    <Pressable onPress={onPress} disabled={disabled} testID={testID}>
      <Text>{children}</Text>
    </Pressable>
  )
}
