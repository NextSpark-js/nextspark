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
    title: 'Welcome to the Dashboard',
    message: 'Your account has been set up successfully. Explore all the available features.',
    type: 'success',
    timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutos atrás
    isRead: false,
    actionUrl: '/dashboard/settings/profile'
  },
  {
    id: '2',
    title: 'New pending task',
    message: 'You have 3 incomplete tasks. Want to review them now?',
    type: 'info',
    timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutos atrás
    isRead: false,
    actionUrl: '/dashboard/tasks'
  },
  {
    id: '3',
    title: 'Security settings',
    message: 'We recommend enabling two-factor authentication for extra security.',
    type: 'warning',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 horas atrás
    isRead: true,
    actionUrl: '/dashboard/settings/security'
  },
  {
    id: '4',
    title: 'Profile updated',
    message: 'Your profile information has been updated successfully.',
    type: 'success',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 día atrás
    isRead: true,
    actionUrl: '/dashboard/settings/profile'
  },
  {
    id: '5',
    title: 'New login detected',
    message: 'A new sign-in was detected from Chrome in Mexico City.',
    type: 'info',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 días atrás
    isRead: true
  },
  {
    id: '6',
    title: 'Backup completed',
    message: 'Your data has been backed up successfully.',
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
