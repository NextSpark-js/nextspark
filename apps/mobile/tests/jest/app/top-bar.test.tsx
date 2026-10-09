/**
 * Tests for the authenticated TopBar: it must sit below the status bar / notch
 */

import React from 'react'
import { StyleSheet } from 'react-native'
import { render, screen } from '@testing-library/react-native'

jest.mock('@nextsparkjs/mobile', () => require('../__mocks__/nextsparkjs-mobile'))
jest.mock('@/src/components/ui', () => {
  const { Text, View } = require('react-native')
  const Box = ({ children }: { children?: React.ReactNode }) => <View>{children}</View>
  return { Text, Avatar: Box, AvatarImage: () => null, AvatarFallback: Box, Badge: Box, getInitials: () => 'AL' }
})
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}))

import { TopBar } from '../../../src/components/navigation/TopBar'

describe('TopBar', () => {
  it('pads the top by the safe area inset', () => {
    render(<TopBar />)
    let node = screen.getByText(/Hola,/).parent
    while (node && StyleSheet.flatten(node.props.style)?.paddingTop === undefined) node = node.parent
    expect(StyleSheet.flatten(node?.props.style).paddingTop).toBe(47 + 12)
  })
})
