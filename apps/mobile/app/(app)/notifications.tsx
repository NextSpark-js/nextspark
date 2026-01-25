/**
 * Notifications Screen
 * Displays mock notifications data
 */

import { useState, useMemo } from "react";
import { View, FlatList, Pressable, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Text, Card, Badge, Separator } from "@/src/components/ui";
import { cn } from "@/src/lib/utils";
import notificationsData from "@/src/data/notifications.mock.json";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data: Record<string, unknown>;
}

const NOTIFICATION_ICONS: Record<string, string> = {
  task_assigned: "📋",
  task_completed: "✅",
  task_due_soon: "⏰",
  task_overdue: "🚨",
  task_comment: "💬",
  customer_added: "👤",
  team_invite: "👥",
  system: "⚙️",
};

const NOTIFICATION_COLORS: Record<string, string> = {
  task_assigned: "bg-blue-100",
  task_completed: "bg-green-100",
  task_due_soon: "bg-amber-100",
  task_overdue: "bg-red-100",
  task_comment: "bg-purple-100",
  customer_added: "bg-cyan-100",
  team_invite: "bg-indigo-100",
  system: "bg-gray-100",
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `hace ${diffMins} min`;
  } else if (diffHours < 24) {
    return `hace ${diffHours}h`;
  } else if (diffDays === 1) {
    return "ayer";
  } else if (diffDays < 7) {
    return `hace ${diffDays} días`;
  } else {
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
    });
  }
}

function NotificationItem({
  notification,
  onPress,
  onMarkAsRead,
}: {
  notification: Notification;
  onPress: () => void;
  onMarkAsRead: () => void;
}) {
  const icon = NOTIFICATION_ICONS[notification.type] || "🔔";
  const bgColor = NOTIFICATION_COLORS[notification.type] || "bg-gray-100";

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onMarkAsRead}
      className={cn(
        "mx-4 my-1 rounded-xl border bg-card p-4",
        notification.read ? "border-border opacity-70" : "border-primary/20"
      )}
    >
      <View className="flex-row gap-3">
        {/* Icon */}
        <View
          className={cn(
            "h-10 w-10 items-center justify-center rounded-full",
            bgColor
          )}
        >
          <Text className="text-lg">{icon}</Text>
        </View>

        {/* Content */}
        <View className="flex-1">
          <View className="flex-row items-start justify-between">
            <Text
              variant="subheading"
              className={cn("flex-1", !notification.read && "font-bold")}
              numberOfLines={1}
            >
              {notification.title}
            </Text>
            {!notification.read && (
              <View className="ml-2 h-2 w-2 rounded-full bg-primary" />
            )}
          </View>

          <Text variant="muted" className="mt-1" numberOfLines={2}>
            {notification.message}
          </Text>

          <Text variant="muted" size="xs" className="mt-2">
            {formatTimeAgo(notification.createdAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>(
    notificationsData.notifications as Notification[]
  );
  const [refreshing, setRefreshing] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh delay
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
    );

    // Navigate based on type
    if (notification.type.startsWith("task_") && notification.data.taskId) {
      router.push(`/(app)/task/${notification.data.taskId}`);
    } else if (notification.type === "customer_added" && notification.data.customerId) {
      router.push(`/(app)/customer/${notification.data.customerId}`);
    }
  };

  const handleMarkAsRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  return (
    <View className="flex-1 bg-secondary">
      {/* Header */}
      <View className="flex-row items-center justify-between bg-background px-4 py-3 border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <Text size="xl">←</Text>
        </Pressable>
        <Text variant="heading" size="lg">
          Notificaciones
        </Text>
        <View className="w-10" />
      </View>

      {/* Actions Bar */}
      {notifications.length > 0 && (
        <View className="flex-row items-center justify-between px-4 py-2 bg-background border-b border-border">
          <View className="flex-row items-center gap-2">
            {unreadCount > 0 && (
              <Badge variant="default">
                {unreadCount} sin leer
              </Badge>
            )}
          </View>
          <View className="flex-row gap-3">
            {unreadCount > 0 && (
              <Pressable onPress={handleMarkAllAsRead}>
                <Text variant="muted" size="sm" className="text-primary">
                  Marcar todo leído
                </Text>
              </Pressable>
            )}
            <Pressable onPress={handleClearAll}>
              <Text variant="muted" size="sm" className="text-destructive">
                Limpiar
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-6xl mb-4">🔔</Text>
          <Text variant="heading" size="lg" className="text-center">
            Sin notificaciones
          </Text>
          <Text variant="muted" className="text-center mt-2">
            Cuando recibas notificaciones, aparecerán aquí
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationItem
              notification={item}
              onPress={() => handleNotificationPress(item)}
              onMarkAsRead={() => handleMarkAsRead(item.id)}
            />
          )}
          contentContainerStyle={{ paddingVertical: 8 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ItemSeparatorComponent={() => <View className="h-1" />}
        />
      )}
    </View>
  );
}
