'use client'

import { useState } from 'react'

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  timestamp: Date
  isRead: boolean
  actionUrl?: string
}

// Notificaciones de ejemplo
const EXAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    title: 'Bienvenido al Dashboard',
    message: 'Tu cuenta ha sido configurada exitosamente. Explora todas las funcionalidades disponibles.',
    type: 'success',
    timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutos atrás
    isRead: false,
    actionUrl: '/dashboard/settings/profile'
  },
  {
    id: '2',
    title: 'Nueva tarea pendiente',
    message: 'Tienes 3 tareas sin completar. ¿Quieres revisarlas ahora?',
    type: 'info',
    timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutos atrás
    isRead: false,
    actionUrl: '/dashboard/tasks'
  },
  {
    id: '3',
    title: 'Configuración de seguridad',
    message: 'Te recomendamos activar la autenticación de dos factores para mayor seguridad.',
    type: 'warning',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 horas atrás
    isRead: true,
    actionUrl: '/dashboard/settings/security'
  },
  {
    id: '4',
    title: 'Perfil actualizado',
    message: 'Tu información de perfil ha sido actualizada correctamente.',
    type: 'success',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 día atrás
    isRead: true,
    actionUrl: '/dashboard/settings/profile'
  },
  {
    id: '5',
    title: 'Nuevo login detectado',
    message: 'Se detectó un nuevo inicio de sesión desde Chrome en Ciudad de México.',
    type: 'info',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 días atrás
    isRead: true
  },
  {
    id: '6',
    title: 'Backup completado',
    message: 'Se ha realizado una copia de seguridad de tus datos exitosamente.',
    type: 'success',
    timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 semana atrás
    isRead: true
  }
]

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>(EXAMPLE_NOTIFICATIONS)

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === notificationId 
          ? { ...notification, isRead: true }
          : notification
      )
    )
  }

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, isRead: true }))
    )
  }

  const deleteNotification = (notificationId: string) => {
    setNotifications(prev => 
      prev.filter(notification => notification.id !== notificationId)
    )
  }

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date()
    }
    setNotifications(prev => [newNotification, ...prev])
  }

  const unreadCount = notifications.filter(n => !n.isRead).length
  const sortedNotifications = [...notifications].sort((a, b) => 
    b.timestamp.getTime() - a.timestamp.getTime()
  )

  return {
    notifications: sortedNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    addNotification
  }
}
