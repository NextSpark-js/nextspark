/**
 * Login Screen
 */

import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuth } from '@/src/providers/AuthProvider'
import { Colors } from '@/src/constants/colors'
import { Button } from '@/src/components/ui'

export default function LoginScreen() {
  const { login, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    setError(null)

    if (!email.trim() || !password.trim()) {
      setError('Por favor ingresa tu email y contraseña')
      return
    }

    try {
      await login(email.trim(), password)
      router.replace('/(app)')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión. Por favor intenta de nuevo.')
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>NextSpark</Text>
            <Text style={styles.subtitle}>Inicia sesión en tu cuenta</Text>
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Ingresa tu email"
                placeholderTextColor={Colors.foregroundMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Ingresa tu contraseña"
                placeholderTextColor={Colors.foregroundMuted}
                secureTextEntry
                editable={!isLoading}
              />
            </View>

            <Button
              onPress={handleLogin}
              isLoading={isLoading}
              style={{ marginTop: 8 }}
            >
              Iniciar Sesión
            </Button>
          </View>

          {/* Dev Hint */}
          <View style={styles.hint}>
            <Text style={styles.hintText}>
              Dev: carlos.mendoza@nextspark.dev / Test1234
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.foreground,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.foregroundSecondary,
    marginTop: 8,
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: Colors.destructive,
    fontSize: 14,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.foreground,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: Colors.foreground,
  },
  hint: {
    marginTop: 24,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 12,
    color: Colors.foregroundMuted,
  },
})
