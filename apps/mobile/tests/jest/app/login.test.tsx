/**
 * Tests for app/login.tsx
 * Covers the one-time code submit flow (validation + mocked API)
 */

import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

jest.mock('@nextsparkjs/mobile', () => require('../__mocks__/nextsparkjs-mobile'))
jest.mock('@/src/components/ui', () => require('../__mocks__/components-ui'))
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }))
jest.mock('expo-linking', () => ({ createURL: jest.fn(() => 'nextspark://') }))

import { router } from 'expo-router'
import { mockUseAuth } from '../__mocks__/nextsparkjs-mobile'
import LoginScreen from '../../../app/login'

async function goToCodeStep() {
  render(<LoginScreen />)
  fireEvent.changeText(screen.getByTestId('login-otp-email'), 'user@example.com')
  fireEvent.press(screen.getByTestId('login-otp-send'))
  await waitFor(() => expect(screen.getByTestId('login-otp-code')).toBeTruthy())
}

describe('LoginScreen — one-time code', () => {
  it('sends the code request with the trimmed email', async () => {
    render(<LoginScreen />)
    fireEvent.changeText(screen.getByTestId('login-otp-email'), '  user@example.com  ')
    fireEvent.press(screen.getByTestId('login-otp-send'))

    await waitFor(() => expect(mockUseAuth.requestOtp).toHaveBeenCalledWith('user@example.com'))
  })

  it('rejects an invalid email before requesting a code', async () => {
    render(<LoginScreen />)
    fireEvent.changeText(screen.getByTestId('login-otp-email'), 'not-an-email')
    fireEvent.press(screen.getByTestId('login-otp-send'))

    expect(mockUseAuth.requestOtp).not.toHaveBeenCalled()
    expect(screen.getByText('Ingresa un email válido')).toBeTruthy()
  })

  it('strips non-digit characters as they are typed, up to the max length', async () => {
    await goToCodeStep()
    const codeInput = screen.getByTestId('login-otp-code')

    fireEvent.changeText(codeInput, '12a3-4b56789999')

    expect(codeInput.props.value).toBe('123456789999'.slice(0, 10))
  })

  it('rejects a code shorter than the minimum without calling loginWithOtp', async () => {
    await goToCodeStep()
    fireEvent.changeText(screen.getByTestId('login-otp-code'), '123')
    fireEvent.press(screen.getByTestId('login-otp-submit'))

    expect(mockUseAuth.loginWithOtp).not.toHaveBeenCalled()
    expect(screen.getByText('Ingresa el código que te enviamos por email')).toBeTruthy()
  })

  it('submits a valid code and navigates to the app', async () => {
    mockUseAuth.loginWithOtp.mockResolvedValueOnce(undefined)
    await goToCodeStep()

    fireEvent.changeText(screen.getByTestId('login-otp-code'), '123456')
    fireEvent.press(screen.getByTestId('login-otp-submit'))

    await waitFor(() =>
      expect(mockUseAuth.loginWithOtp).toHaveBeenCalledWith('user@example.com', '123456')
    )
    expect(router.replace).toHaveBeenCalledWith('/(app)')
  })

  it('surfaces the server error and does not navigate when loginWithOtp fails', async () => {
    mockUseAuth.loginWithOtp.mockRejectedValueOnce(new Error('Código inválido o vencido.'))
    await goToCodeStep()

    fireEvent.changeText(screen.getByTestId('login-otp-code'), '123456')
    fireEvent.press(screen.getByTestId('login-otp-submit'))

    await waitFor(() => expect(screen.getByText('Código inválido o vencido.')).toBeTruthy())
    expect(router.replace).not.toHaveBeenCalled()
  })
})
