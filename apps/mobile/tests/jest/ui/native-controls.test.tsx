import React from 'react'
import { StyleSheet } from 'react-native'
import { render } from '@testing-library/react-native'
import { Button } from '../../../../../packages/ui/src/components/Button.native'
import { Input } from '../../../../../packages/ui/src/components/Input.native'
import { Select } from '../../../../../packages/ui/src/components/Select.native'
import { Card, CardContent, PressableCard } from '../../../../../packages/ui/src/components/Card.native'

// Jest has no layout engine, so a rendered fontScale cannot be measured: these tests pin the
// style contract that lets the control grow (minHeight, no fixed height) and keeps the size at
// scale 1 (the old fixed heights are now the minimum).
const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, unknown>

describe('native controls grow with the text', () => {
  it.each([
    ['default', 44],
    ['sm', 36],
    ['lg', 48],
    ['icon', 40],
  ] as const)('Button %s has minHeight %i and no fixed height', (size, min) => {
    const { getByTestId } = render(<Button testID="b" size={size}>Go</Button>)
    const style = flat(getByTestId('b').props.style)
    expect(style.minHeight).toBe(min)
    expect(style.height).toBeUndefined()
  })

  it('Input has minHeight 44 and no fixed height', () => {
    const { getByTestId } = render(<Input testID="i" />)
    const style = flat(getByTestId('i').props.style)
    expect(style.minHeight).toBe(44)
    expect(style.height).toBeUndefined()
  })

  it('Select trigger has minHeight 44 and no fixed height', () => {
    const { getByText } = render(<Select options={[]} placeholder="Pick" />)
    // climb from the label to the trigger: the first ancestor that carries a minHeight
    let node = getByText('Pick').parent
    while (node && flat(node.props.style).minHeight === undefined) node = node.parent
    const style = flat(node?.props.style)
    expect(style.minHeight).toBe(44)
    expect(style.height).toBeUndefined()
  })
})

describe('Card className', () => {
  let warn: jest.SpyInstance
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => warn.mockRestore())

  it('warns in development when className is passed to a part, and stays silent without it', () => {
    render(<Card><CardContent>x</CardContent></Card>)
    expect(warn).not.toHaveBeenCalled()
    render(<CardContent className="p-4">x</CardContent>)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('CardContent')
    expect(warn.mock.calls[0][0]).toContain('style')
  })

  it('warns for Card and PressableCard', () => {
    render(<Card className="m-2" />)
    render(<PressableCard className="m-2" />)
    expect(warn.mock.calls.map((c) => c[0]).join('\n')).toMatch(/Card:.*\n.*PressableCard:/)
  })
})
