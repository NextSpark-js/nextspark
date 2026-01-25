/**
 * MoreSheet Component - "Más Opciones" bottom sheet
 * With team switching functionality
 */

import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native'
import { Colors } from '../constants/colors'
import { useAuth } from '../providers/AuthProvider'
import type { Team } from '../types'

interface MoreSheetProps {
  visible: boolean
  onClose: () => void
  onNavigate: (screen: string) => void
  onLogout: () => void
  onTeamChange?: () => void
}

interface MenuItem {
  key: string
  label: string
  icon: string
  screen?: string
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'profile', label: 'Perfil', icon: '👤', screen: 'profile' },
  { key: 'billing', label: 'Facturación', icon: '💳', screen: 'billing' },
  { key: 'api-keys', label: 'Claves API', icon: '🔑', screen: 'api-keys' },
  { key: 'settings', label: 'Ajustes', icon: '⚙', screen: 'settings' },
]

export function MoreSheet({
  visible,
  onClose,
  onNavigate,
  onLogout,
  onTeamChange,
}: MoreSheetProps) {
  const { team, teams, selectTeam } = useAuth()
  const [showTeamList, setShowTeamList] = useState(false)

  const handleMenuItem = (item: MenuItem) => {
    if (item.screen) {
      onNavigate(item.screen)
      onClose()
    }
  }

  const handleTeamSelect = async (selectedTeam: Team) => {
    if (selectedTeam.id !== team?.id) {
      await selectTeam(selectedTeam)
      setShowTeamList(false)
      onClose()
      // Callback to refresh data in the app
      onTeamChange?.()
    } else {
      setShowTeamList(false)
    }
  }

  const toggleTeamList = () => {
    setShowTeamList(!showTeamList)
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>

          {/* Header */}
          <Text style={styles.title}>Más Opciones</Text>
          <Text style={styles.subtitle}>
            Accede a configuraciones y funciones adicionales
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Menu Items */}
            <View style={styles.menuSection}>
              {MENU_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.menuItem}
                  onPress={() => handleMenuItem(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Team Section */}
            {team && teams.length > 0 && (
              <>
                <View style={styles.divider} />

                {/* Current Team - Clickable to toggle list */}
                <TouchableOpacity
                  style={styles.teamItem}
                  onPress={toggleTeamList}
                  activeOpacity={0.7}
                >
                  <View style={styles.teamAvatar}>
                    <Text style={styles.teamAvatarText}>
                      {team.name.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.teamInfo}>
                    <Text style={styles.teamName}>{team.name}</Text>
                    <View style={styles.teamRoleRow}>
                      <Text style={styles.teamRoleIcon}>👥</Text>
                      <Text style={styles.teamRoleText}>
                        {teams.length > 1 ? `${teams.length} equipos disponibles` : 'Equipo'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.chevron, showTeamList && styles.chevronOpen]}>
                    {showTeamList ? '⌄' : '⌃'}
                  </Text>
                </TouchableOpacity>

                {/* Team List (expandable) */}
                {showTeamList && teams.length > 1 && (
                  <View style={styles.teamListContainer}>
                    <Text style={styles.teamListTitle}>Cambiar de equipo</Text>
                    {teams.map((t) => {
                      const isCurrentTeam = t.id === team.id
                      return (
                        <TouchableOpacity
                          key={t.id}
                          style={[
                            styles.teamListItem,
                            isCurrentTeam && styles.teamListItemActive,
                          ]}
                          onPress={() => handleTeamSelect(t)}
                          activeOpacity={0.7}
                        >
                          <View style={[
                            styles.teamListAvatar,
                            isCurrentTeam && styles.teamListAvatarActive,
                          ]}>
                            <Text style={[
                              styles.teamListAvatarText,
                              isCurrentTeam && styles.teamListAvatarTextActive,
                            ]}>
                              {t.name.substring(0, 2).toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.teamListInfo}>
                            <Text style={[
                              styles.teamListName,
                              isCurrentTeam && styles.teamListNameActive,
                            ]}>
                              {t.name}
                            </Text>
                            <Text style={styles.teamListRole}>
                              {t.userRole}
                            </Text>
                          </View>
                          {isCurrentTeam && (
                            <Text style={styles.checkmark}>✓</Text>
                          )}
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
              </>
            )}

            {/* Logout */}
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.logoutItem}
              onPress={onLogout}
              activeOpacity={0.7}
            >
              <Text style={styles.logoutIcon}>↪</Text>
              <Text style={styles.logoutText}>Cerrar Sesión</Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    maxHeight: '85%',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: Colors.borderSecondary,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeIcon: {
    fontSize: 16,
    color: Colors.foregroundSecondary,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.foreground,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.foregroundSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  menuSection: {
    gap: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 16,
  },
  menuIcon: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  menuLabel: {
    fontSize: 16,
    color: Colors.foreground,
    fontWeight: '400',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  teamItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  teamAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  teamAvatarText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.foregroundSecondary,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.foreground,
  },
  teamRoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  teamRoleIcon: {
    fontSize: 12,
  },
  teamRoleText: {
    fontSize: 12,
    color: Colors.foregroundSecondary,
  },
  chevron: {
    fontSize: 14,
    color: Colors.foregroundSecondary,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  teamListContainer: {
    marginTop: 12,
    paddingLeft: 8,
  },
  teamListTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.foregroundSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  teamListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 4,
    borderRadius: 8,
    gap: 12,
  },
  teamListItemActive: {
    backgroundColor: Colors.backgroundTertiary,
  },
  teamListAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  teamListAvatarActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  teamListAvatarText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.foregroundSecondary,
  },
  teamListAvatarTextActive: {
    color: Colors.primaryForeground,
  },
  teamListInfo: {
    flex: 1,
  },
  teamListName: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.foreground,
  },
  teamListNameActive: {
    fontWeight: '600',
  },
  teamListRole: {
    fontSize: 12,
    color: Colors.foregroundSecondary,
    marginTop: 1,
  },
  checkmark: {
    fontSize: 16,
    color: Colors.success,
    fontWeight: '600',
  },
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 16,
  },
  logoutIcon: {
    fontSize: 20,
    color: Colors.destructive,
    width: 28,
    textAlign: 'center',
  },
  logoutText: {
    fontSize: 16,
    color: Colors.destructive,
    fontWeight: '500',
  },
})
