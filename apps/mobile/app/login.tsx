/**
 * Login Screen
 *
 * Methods come from `APP_CONFIG.auth.methods` (passwordless preset by
 * default: one-time code by email + Google, no password field). Order matters:
 * the first email method ('email-otp' | 'email-password') is the form shown
 * first; when both are configured the user can switch between them.
 */

import { useMemo, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as Linking from 'expo-linking'
import { useAuth, authApi, type AuthLoginMethod } from '@nextsparkjs/mobile'
import { APP_CONFIG } from '@/src/config/app.config'
import { Colors } from '@/src/constants/colors'
import { Button } from '@/src/components/ui'

type EmailMode = 'otp' | 'password'

const OTP_CODE_LENGTH = 6
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function resolveMethods(): AuthLoginMethod[] {
  const configured = APP_CONFIG.auth?.methods ?? []
  return configured.length > 0 ? configured : ['email-otp', 'google']
}

export default function LoginScreen() {
  const { login, requestOtp, loginWithOtp, isLoading } = useAuth()

  const methods = useMemo(resolveMethods, [])
  const otpEnabled = methods.includes('email-otp')
  const passwordEnabled = methods.includes('email-password')
  const googleEnabled = methods.includes('google')
  const primaryEmailMode: EmailMode =
    (methods.find((m) => m === 'email-otp' || m === 'email-password') ?? (otpEnabled ? 'email-otp' : 'email-password')) === 'email-otp'
      ? 'otp'
      : 'password'

  const [emailMode, setEmailMode] = useState<EmailMode>(primaryEmailMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [otpStep, setOtpStep] = useState<'email' | 'code'>('email')
  const [otpCode, setOtpCode] = useState('')
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isOpeningGoogle, setIsOpeningGoogle] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const busy = isLoading || isSendingOtp || isOpeningGoogle

  const switchMode = (mode: EmailMode) => {
    setEmailMode(mode)
    setError(null)
    setNotice(null)
    setOtpStep('email')
    setOtpCode('')
  }

  const handleSendOtp = async () => {
    setError(null)
    setNotice(null)
    const trimmed = email.trim()
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError('Ingresa un email válido')
      return
    }
    setIsSendingOtp(true)
    try {
      await requestOtp(trimmed)
      setEmail(trimmed)
      setOtpCode('')
      setOtpStep('code')
      setNotice(`Te enviamos un código de ${OTP_CODE_LENGTH} dígitos a ${trimmed}. Vence en 5 minutos.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos enviar el código. Intenta de nuevo.')
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleVerifyOtp = async () => {
    setError(null)
    if (otpCode.trim().length !== OTP_CODE_LENGTH) {
      setError(`Ingresa el código de ${OTP_CODE_LENGTH} dígitos de tu email`)
      return
    }
    try {
      await loginWithOtp(email.trim(), otpCode.trim())
      router.replace('/(app)')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido o vencido. Pide uno nuevo.')
    }
  }

  const handlePasswordLogin = async () => {
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

  /**
   * Google OAuth: ask the backend for the provider URL and open it.
   *
   * On Expo web the browser shares cookies with the app, so the session
   * created by the OAuth callback is picked up on return (see `index.tsx`).
   * On a native device the browser session is NOT handed back to the app by
   * itself: wire Better Auth's Expo plugin (`@better-auth/expo`, server +
   * client) for a complete native flow — this button is the integration point.
   */
  const handleGoogleLogin = async () => {
    setError(null)
    setIsOpeningGoogle(true)
    try {
      const callbackURL = Linking.createURL('/')
      const url = await authApi.getSocialSignInUrl('google', callbackURL)
      await Linking.openURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos iniciar sesión con Google.')
    } finally {
      setIsOpeningGoogle(false)
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
            <Text style={styles.subtitle}>
              {emailMode === 'otp' && otpEnabled
                ? 'Ingresa con un código que te enviamos por email'
                : 'Inicia sesión en tu cuenta'}
            </Text>
          </View>

          {/* Feedback */}
          {error && (
            <View style={styles.errorContainer} accessibilityRole="alert">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
          {notice && !error && (
            <View style={styles.noticeContainer} accessibilityLiveRegion="polite">
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          )}

          {/* Google */}
          {googleEnabled && (
            <Button
              variant="outline"
              onPress={handleGoogleLogin}
              isLoading={isOpeningGoogle}
              disabled={busy}
              testID="login-google"
            >
              Continuar con Google
            </Button>
          )}

          {googleEnabled && (otpEnabled || passwordEnabled) && (
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o continúa con tu email</Text>
              <View style={styles.dividerLine} />
            </View>
          )}

          {/* Passwordless: one-time code by email */}
          {otpEnabled && emailMode === 'otp' && (
            <View style={styles.form}>
              {otpStep === 'email' ? (
                <>
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
                      autoComplete="email"
                      editable={!busy}
                      testID="login-otp-email"
                    />
                    <Text style={styles.helpText}>Sin contraseña: te enviamos un código de un solo uso.</Text>
                  </View>
                  <Button
                    onPress={handleSendOtp}
                    isLoading={isSendingOtp}
                    disabled={busy}
                    style={{ marginTop: 8 }}
                    testID="login-otp-send"
                  >
                    Enviarme un código
                  </Button>
                </>
              ) : (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Código de acceso</Text>
                    <TextInput
                      style={[styles.input, styles.codeInput]}
                      value={otpCode}
                      onChangeText={(value) => setOtpCode(value.replace(/\D/g, '').slice(0, OTP_CODE_LENGTH))}
                      placeholder="123456"
                      placeholderTextColor={Colors.foregroundMuted}
                      keyboardType="number-pad"
                      autoComplete="one-time-code"
                      textContentType="oneTimeCode"
                      maxLength={OTP_CODE_LENGTH}
                      editable={!busy}
                      autoFocus
                      testID="login-otp-code"
                    />
                  </View>
                  <Button
                    onPress={handleVerifyOtp}
                    isLoading={isLoading}
                    disabled={busy}
                    style={{ marginTop: 8 }}
                    testID="login-otp-submit"
                  >
                    Ingresar con el código
                  </Button>
                  <View style={styles.linkRow}>
                    <Pressable onPress={handleSendOtp} disabled={busy} testID="login-otp-resend">
                      <Text style={styles.linkText}>Reenviar código</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { setOtpStep('email'); setOtpCode(''); setNotice(null); setError(null) }}
                      disabled={busy}
                      testID="login-otp-change-email"
                    >
                      <Text style={styles.mutedLinkText}>Usar otro email</Text>
                    </Pressable>
                  </View>
                </>
              )}

              {passwordEnabled && (
                <Pressable onPress={() => switchMode('password')} disabled={busy} style={styles.switchLink} testID="login-use-password">
                  <Text style={styles.mutedLinkText}>Prefiero iniciar sesión con contraseña</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Classic: email + password */}
          {passwordEnabled && (emailMode === 'password' || !otpEnabled) && (
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
                  autoComplete="email"
                  editable={!busy}
                  testID="login-email"
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
                  autoComplete="current-password"
                  editable={!busy}
                  testID="login-password"
                />
              </View>

              <Button
                onPress={handlePasswordLogin}
                isLoading={isLoading}
                disabled={busy}
                style={{ marginTop: 8 }}
                testID="login-submit"
              >
                Iniciar Sesión
              </Button>

              {otpEnabled && (
                <Pressable onPress={() => switchMode('otp')} disabled={busy} style={styles.switchLink} testID="login-use-otp">
                  <Text style={styles.mutedLinkText}>Prefiero un código por email</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Dev Hint (password flow only) */}
          {passwordEnabled && (
            <View style={styles.hint}>
              <Text style={styles.hintText}>
                Dev: carlos.mendoza@nextspark.dev / Test1234
              </Text>
            </View>
          )}
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
    textAlign: 'center',
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
  noticeContainer: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  noticeText: {
    color: Colors.foregroundSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: 12,
    color: Colors.foregroundMuted,
    textTransform: 'uppercase',
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
  codeInput: {
    letterSpacing: 8,
    textAlign: 'center',
    fontSize: 22,
  },
  helpText: {
    fontSize: 12,
    color: Colors.foregroundMuted,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  linkText: {
    fontSize: 14,
    color: Colors.foreground,
    fontWeight: '500',
  },
  mutedLinkText: {
    fontSize: 14,
    color: Colors.foregroundSecondary,
  },
  switchLink: {
    alignItems: 'center',
    marginTop: 4,
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
