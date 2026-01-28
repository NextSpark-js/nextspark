/**
 * Settings Screen
 */

import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch } from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { Colors } from '@/src/constants/colors'

interface SettingItem {
  key: string
  label: string
  description?: string
  icon: string
  type: 'navigation' | 'toggle'
  screen?: string
}

const SETTINGS_SECTIONS = [
  {
    title: 'Cuenta',
    items: [
      {
        key: 'profile',
        label: 'Información Personal',
        description: 'Nombre, email, idioma',
        icon: '👤',
        type: 'navigation' as const,
        screen: 'profile',
      },
      {
        key: 'security',
        label: 'Seguridad',
        description: 'Contraseña, autenticación',
        icon: '🔒',
        type: 'navigation' as const,
      },
    ],
  },
  {
    title: 'Preferencias',
    items: [
      {
        key: 'notifications',
        label: 'Notificaciones',
        icon: '🔔',
        type: 'toggle' as const,
      },
      {
        key: 'darkMode',
        label: 'Modo Oscuro',
        icon: '🌙',
        type: 'toggle' as const,
      },
    ],
  },
  {
    title: 'Soporte',
    items: [
      {
        key: 'help',
        label: 'Centro de Ayuda',
        icon: '❓',
        type: 'navigation' as const,
      },
      {
        key: 'feedback',
        label: 'Enviar Comentarios',
        icon: '💬',
        type: 'navigation' as const,
      },
    ],
  },
]

export default function SettingsScreen() {
  const [toggleStates, setToggleStates] = useState<Record<string, boolean>>({
    notifications: true,
    darkMode: false,
  })

  const handleToggle = (key: string) => {
    setToggleStates((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleNavigation = (item: SettingItem) => {
    if (item.screen) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.push(`/(app)/${item.screen}` as any)
    }
  }

  return (
    <ScrollView style={styles.container}>
      {/* Page Header */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Ajustes</Text>
        <Text style={styles.pageSubtitle}>
          Configura tu cuenta y preferencias
        </Text>
      </View>

      {/* Settings Sections */}
      {SETTINGS_SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionContent}>
            {section.items.map((item, index) => (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.settingItem,
                  index < section.items.length - 1 && styles.settingItemBorder,
                ]}
                onPress={() =>
                  item.type === 'navigation'
                    ? handleNavigation(item)
                    : handleToggle(item.key)
                }
                activeOpacity={0.7}
              >
                <Text style={styles.settingIcon}>{item.icon}</Text>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  {'description' in item && item.description && (
                    <Text style={styles.settingDescription}>
                      {item.description}
                    </Text>
                  )}
                </View>
                {item.type === 'navigation' ? (
                  <Text style={styles.chevron}>›</Text>
                ) : (
                  <Switch
                    value={toggleStates[item.key]}
                    onValueChange={() => handleToggle(item.key)}
                    trackColor={{
                      false: Colors.border,
                      true: Colors.primary,
                    }}
                    thumbColor={Colors.background}
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* App Version */}
      <View style={styles.footer}>
        <Text style={styles.versionText}>NextSpark Mobile v1.0.0</Text>
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
    paddingBottom: 12,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.foreground,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 15,
    color: Colors.foregroundSecondary,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.foregroundSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingIcon: {
    fontSize: 20,
    width: 32,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: Colors.foreground,
    fontWeight: '400',
  },
  settingDescription: {
    fontSize: 13,
    color: Colors.foregroundSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 24,
    color: Colors.foregroundMuted,
    fontWeight: '300',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 13,
    color: Colors.foregroundMuted,
  },
  spacer: {
    height: 40,
  },
})
