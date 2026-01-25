/**
 * Profile Screen - User information and settings
 */

import { View, Text, TextInput, ScrollView, StyleSheet } from 'react-native'
import { useAuth } from '@/src/providers/AuthProvider'
import { Colors } from '@/src/constants/colors'

export default function ProfileScreen() {
  const { user } = useAuth()

  // Split name into first and last name
  const nameParts = user?.name?.split(' ') || ['', '']
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''

  return (
    <ScrollView style={styles.container}>
      {/* Page Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Información Personal</Text>
        <Text style={styles.pageSubtitle}>
          Gestiona tu información personal y preferencias básicas de tu cuenta.
        </Text>
      </View>

      {/* Personal Data Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>👤</Text>
          <View>
            <Text style={styles.cardTitle}>Datos Personales</Text>
            <Text style={styles.cardSubtitle}>
              Actualiza tu nombre, país, zona horaria e idioma preferido
            </Text>
          </View>
        </View>

        {/* Name Field */}
        <View style={styles.field}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            editable={false}
            placeholder="Tu nombre"
            placeholderTextColor={Colors.foregroundMuted}
          />
        </View>

        {/* Last Name Field */}
        <View style={styles.field}>
          <Text style={styles.label}>Apellido</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            editable={false}
            placeholder="Tu apellido"
            placeholderTextColor={Colors.foregroundMuted}
          />
        </View>

        {/* Email Field */}
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.emailInputWrapper}>
            <Text style={styles.emailIcon}>✉</Text>
            <TextInput
              style={[styles.input, styles.emailInput]}
              value={user?.email || ''}
              editable={false}
              placeholder="Tu email"
              placeholderTextColor={Colors.foregroundMuted}
            />
          </View>
          <Text style={styles.hint}>No se puede cambiar</Text>
        </View>

        {/* Auth Method */}
        <View style={styles.field}>
          <Text style={styles.label}>Método de Autenticación</Text>
          <View style={styles.readOnlyRow}>
            <Text style={styles.readOnlyIcon}>✉</Text>
            <Text style={styles.readOnlyText}>Email</Text>
          </View>
        </View>

        {/* Verification Status */}
        <View style={styles.field}>
          <Text style={styles.label}>Estado de Verificación</Text>
          <View style={styles.readOnlyRow}>
            <Text style={styles.verifiedIcon}>✓</Text>
            <Text style={styles.verifiedText}>Verificado</Text>
          </View>
        </View>

        {/* Language */}
        <View style={styles.field}>
          <Text style={styles.label}>Idioma</Text>
          <View style={styles.selectWrapper}>
            <Text style={styles.selectIcon}>文</Text>
            <Text style={styles.selectText}>Español</Text>
            <Text style={styles.selectChevron}>⌄</Text>
          </View>
        </View>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  header: {
    padding: 20,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.foreground,
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 15,
    color: Colors.foregroundSecondary,
    lineHeight: 22,
  },
  card: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 24,
  },
  cardIcon: {
    fontSize: 20,
    marginTop: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.foreground,
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.foregroundSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.foreground,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.foreground,
  },
  emailInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  emailIcon: {
    fontSize: 16,
    color: Colors.foregroundMuted,
    marginRight: 10,
  },
  emailInput: {
    flex: 1,
    borderWidth: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  hint: {
    fontSize: 12,
    color: Colors.foregroundMuted,
    marginTop: 6,
  },
  readOnlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readOnlyIcon: {
    fontSize: 16,
    color: Colors.foregroundSecondary,
  },
  readOnlyText: {
    fontSize: 15,
    color: Colors.foreground,
  },
  verifiedIcon: {
    fontSize: 16,
    color: Colors.success,
  },
  verifiedText: {
    fontSize: 15,
    color: Colors.success,
    fontWeight: '500',
  },
  selectWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectIcon: {
    fontSize: 16,
    color: Colors.foregroundSecondary,
    marginRight: 10,
  },
  selectText: {
    flex: 1,
    fontSize: 15,
    color: Colors.foreground,
  },
  selectChevron: {
    fontSize: 16,
    color: Colors.foregroundSecondary,
  },
  spacer: {
    height: 40,
  },
})
