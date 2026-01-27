/**
 * Tests for lib/alert.ts
 * Native Alert utility tests (iOS/Android only)
 *
 * Note: Platform.OS is mocked as 'ios' by default in jest.setup.js
 */

import { Alert as RNAlert } from 'react-native'
import { alert, confirm, confirmDestructive, Alert } from '../../../src/lib/alert'

describe('Alert utility (native)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('alert()', () => {
    it('should call RNAlert.alert with title and message', () => {
      alert({
        title: 'Test Title',
        message: 'Test message',
      })

      expect(RNAlert.alert).toHaveBeenCalledWith(
        'Test Title',
        'Test message',
        [{ text: 'OK' }]
      )
    })

    it('should call RNAlert.alert with custom buttons', () => {
      const buttons = [
        { text: 'Cancel', style: 'cancel' as const },
        { text: 'OK', style: 'default' as const },
      ]

      alert({
        title: 'Confirm',
        message: 'Are you sure?',
        buttons,
      })

      expect(RNAlert.alert).toHaveBeenCalledWith(
        'Confirm',
        'Are you sure?',
        buttons
      )
    })

    it('should use default OK button when no buttons provided', () => {
      alert({ title: 'Info' })

      expect(RNAlert.alert).toHaveBeenCalledWith('Info', undefined, [
        { text: 'OK' },
      ])
    })

    it('should pass all button properties to RNAlert', () => {
      const onPressCallback = jest.fn()
      const buttons = [
        {
          text: 'Destructive',
          style: 'destructive' as const,
          onPress: onPressCallback,
        },
      ]

      alert({
        title: 'Warning',
        message: 'This is destructive',
        buttons,
      })

      expect(RNAlert.alert).toHaveBeenCalledWith(
        'Warning',
        'This is destructive',
        buttons
      )
    })

    it('should handle empty message', () => {
      alert({ title: 'Title Only' })

      expect(RNAlert.alert).toHaveBeenCalledWith('Title Only', undefined, [
        { text: 'OK' },
      ])
    })

    it('should handle empty buttons array', () => {
      alert({ title: 'Test', buttons: [] })

      expect(RNAlert.alert).toHaveBeenCalledWith('Test', undefined, [])
    })

    it('should handle multiple buttons', () => {
      const buttons = [
        { text: 'Option 1', style: 'default' as const },
        { text: 'Option 2', style: 'default' as const },
        { text: 'Cancel', style: 'cancel' as const },
      ]

      alert({ title: 'Choose', buttons })

      expect(RNAlert.alert).toHaveBeenCalledWith('Choose', undefined, buttons)
    })
  })

  describe('confirm()', () => {
    it('should call RNAlert.alert with confirm/cancel buttons', () => {
      confirm('Confirm Action?', 'Please confirm this action')

      expect(RNAlert.alert).toHaveBeenCalledWith(
        'Confirm Action?',
        'Please confirm this action',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancelar', style: 'cancel' }),
          expect.objectContaining({ text: 'Confirmar', style: 'default' }),
        ])
      )
    })

    it('should return a promise', () => {
      const result = confirm('Test?')
      expect(result).toBeInstanceOf(Promise)
    })

    it('should have Spanish button labels (Cancelar/Confirmar)', () => {
      confirm('Test', 'Message')

      const call = (RNAlert.alert as jest.Mock).mock.calls[0]
      const buttons = call[2]

      expect(buttons[0].text).toBe('Cancelar')
      expect(buttons[1].text).toBe('Confirmar')
    })
  })

  describe('confirmDestructive()', () => {
    it('should call RNAlert.alert with destructive styling', () => {
      confirmDestructive('Delete Item', 'Cannot be undone')

      expect(RNAlert.alert).toHaveBeenCalledWith(
        'Delete Item',
        'Cannot be undone',
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancelar', style: 'cancel' }),
          expect.objectContaining({ text: 'Eliminar', style: 'destructive' }),
        ])
      )
    })

    it('should use custom destructive button text', () => {
      confirmDestructive('Remove?', 'This will remove the item', 'Remove')

      const call = (RNAlert.alert as jest.Mock).mock.calls[0]
      const buttons = call[2]

      const destructiveButton = buttons.find(
        (b: { style: string }) => b.style === 'destructive'
      )
      expect(destructiveButton.text).toBe('Remove')
    })

    it('should default to "Eliminar" for destructive button', () => {
      confirmDestructive('Delete?', 'Are you sure?')

      const call = (RNAlert.alert as jest.Mock).mock.calls[0]
      const buttons = call[2]

      const destructiveButton = buttons.find(
        (b: { style: string }) => b.style === 'destructive'
      )
      expect(destructiveButton.text).toBe('Eliminar')
    })

    it('should return a promise', () => {
      const result = confirmDestructive('Test?')
      expect(result).toBeInstanceOf(Promise)
    })
  })

  describe('Alert namespace export', () => {
    it('should export Alert with all methods', () => {
      expect(Alert).toHaveProperty('alert')
      expect(Alert).toHaveProperty('confirm')
      expect(Alert).toHaveProperty('confirmDestructive')
      expect(typeof Alert.alert).toBe('function')
      expect(typeof Alert.confirm).toBe('function')
      expect(typeof Alert.confirmDestructive).toBe('function')
    })

    it('should have same functions as named exports', () => {
      expect(Alert.alert).toBe(alert)
      expect(Alert.confirm).toBe(confirm)
      expect(Alert.confirmDestructive).toBe(confirmDestructive)
    })
  })
})
