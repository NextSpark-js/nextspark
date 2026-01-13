'use client'

import Link from 'next/link'
import { Button } from '../../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu'
import { ScrollArea } from '../../ui/scroll-area'
import { Badge } from '../../ui/badge'
import { Bell, Check, CheckCheck, X, AlertCircle, Info, CheckCircle, AlertTriangle, Settings } from 'lucide-react'
import { useNotifications, type Notification } from '../../../hooks/useNotifications'
import { cn } from '../../../lib/utils'
import { useState, useCallback } from 'react'
import { sel, createAriaLabel } from '../../../lib/test'
import { useTranslations } from 'next-intl'

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-500" />
    default:
      return <Info className="h-4 w-4 text-blue-500" />
  }
}

const formatTimeAgo = (date: Date, locale: 'en' | 'es' = 'es'): string => {
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) {
    return locale === 'en' ? 'Just now' : 'Hace un momento'
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60)
    return locale === 'en' ? `${minutes} min ago` : `Hace ${minutes} min`
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600)
    return locale === 'en' ? `${hours}h ago` : `Hace ${hours}h`
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400)
    return locale === 'en' ? `${days}d ago` : `Hace ${days}d`
  } else {
    return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-ES', { 
      day: 'numeric', 
      month: 'short' 
    })
  }
}

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
}

function NotificationItem({ notification, onMarkAsRead, onDelete }: NotificationItemProps) {
  const handleClick = useCallback(() => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id)
    }
  }, [notification.isRead, notification.id, onMarkAsRead])

  const handleMarkAsRead = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onMarkAsRead(notification.id)
  }, [notification.id, onMarkAsRead])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(notification.id)
  }, [notification.id, onDelete])

  const content = (
    <div 
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent",
        !notification.isRead 
          ? "bg-primary/5 hover:bg-primary/10" 
          : "hover:bg-muted/50"
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      aria-label={createAriaLabel(
        '{title} - {message} - {time} - {status}',
        {
          title: notification.title,
          message: notification.message,
          time: formatTimeAgo(notification.timestamp),
          status: notification.isRead ? 'leída' : 'no leída'
        }
      )}
      data-notification-id={notification.id}
      data-read={notification.isRead}
      data-type={notification.type}
    >
      {/* Notification Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {getNotificationIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className={cn(
            "text-sm font-medium leading-tight",
            !notification.isRead && "text-foreground"
          )}>
            {notification.title}
          </h4>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!notification.isRead && (
              <div className="w-2 h-2 bg-primary rounded-full" />
            )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleDelete}
                aria-label={`Eliminar notificación: ${notification.title}`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </Button>
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground line-clamp-2">
          {notification.message}
        </p>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {formatTimeAgo(notification.timestamp)}
          </span>
          {!notification.isRead && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleMarkAsRead}
                aria-label={`Marcar como leída: ${notification.title}`}
              >
                <Check className="h-3 w-3 mr-1" aria-hidden="true" />
                Marcar leído
              </Button>
          )}
        </div>
      </div>
    </div>
  )

  if (notification.actionUrl) {
    return (
      <Link href={notification.actionUrl} className="block group">
        {content}
      </Link>
    )
  }

  return <div className="group">{content}</div>
}

export function NotificationsDropdown() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications()
  const [statusMessage, setStatusMessage] = useState('')
  const t = useTranslations('common')

  const handleMarkAllAsRead = useCallback(() => {
    markAllAsRead()
    setStatusMessage('Todas las notificaciones marcadas como leídas')
  }, [markAllAsRead])

  return (
    <>
      {/* MANDATORY: Screen reader announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {statusMessage}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="relative"
            aria-label={createAriaLabel(
              '{notifications}{count}',
              {
                notifications: t('notifications.title'),
                count: unreadCount > 0 ? `, ${unreadCount} ${t('notifications.unread')}` : ''
              }
            )}
            aria-haspopup="true"
            aria-expanded="false"
            data-cy={sel('dashboard.topnav.notifications.trigger')}
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            {unreadCount > 0 && (
              <div
                className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center"
                role="status"
                aria-label={`${unreadCount} ${t('notifications.unread')}`}
              >
                <span className="text-[10px] text-white font-medium" aria-hidden="true">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </div>
            )}
          </Button>
        </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>
          <div className="flex items-center justify-between">
            <span>{t('notifications.title')}</span>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {unreadCount} {t('notifications.new')}{unreadCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={handleMarkAllAsRead}
                    aria-label={t('notifications.markAllAsRead')}
                  >
                    <CheckCheck className="h-3 w-3 mr-1" aria-hidden="true" />
                    {t('notifications.markAll')}
                  </Button>
              )}
            </div>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="p-4 text-center">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">{t('notifications.empty')}</p>
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-1 p-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={deleteNotification}
                />
              ))}
            </div>
          </ScrollArea>
        )}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings/notifications" className="w-full text-center">
            <Settings className="h-4 w-4 mr-2" />
            {t('notifications.configure')}
          </Link>
        </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

