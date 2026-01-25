/**
 * TopBar Component - NextSpark Mobile Style
 * Shows user avatar, greeting, notifications, and theme toggle
 * Migrated to NativeWind + UI primitives + Lucide icons
 */

import { View, Pressable } from "react-native";
import { router } from "expo-router";
import { Bell, Moon } from "lucide-react-native";
import { useAuth } from "../providers/AuthProvider";
import {
  Text,
  Avatar,
  AvatarImage,
  AvatarFallback,
  getInitials,
  Badge,
} from "./ui";

interface TopBarProps {
  notificationCount?: number;
}

export function TopBar({ notificationCount = 0 }: TopBarProps) {
  const { user } = useAuth();

  // Get first name for greeting
  const getFirstName = (name?: string | null) => {
    if (!name) return "Usuario";
    return name.split(" ")[0];
  };

  return (
    <View className="flex-row items-center justify-between border-b border-border bg-background px-4 py-3">
      {/* Left: Avatar + Greeting */}
      <View className="flex-row items-center gap-3">
        <Avatar className="bg-amber-500">
          <AvatarImage src={user?.image} />
          <AvatarFallback className="bg-amber-500">
            {getInitials(user?.name)}
          </AvatarFallback>
        </Avatar>
        <Text weight="medium" className="text-base">
          Hola, {getFirstName(user?.name)}
        </Text>
      </View>

      {/* Right: Notifications + Theme Toggle */}
      <View className="flex-row items-center gap-2">
        {/* Notification Bell */}
        <Pressable
          onPress={() => router.push("/(app)/notifications")}
          className="relative h-10 w-10 items-center justify-center"
        >
          <Bell size={22} color="#171717" />
          {notificationCount > 0 && (
            <View className="absolute right-1 top-1">
              <Badge variant="destructive" className="min-w-[18px] px-1 py-0.5">
                <Text className="text-[10px] font-bold text-destructive-foreground">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </Text>
              </Badge>
            </View>
          )}
        </Pressable>

        {/* Theme Toggle (Moon Icon) */}
        <Pressable className="h-10 w-10 items-center justify-center">
          <Moon size={22} color="#171717" />
        </Pressable>
      </View>
    </View>
  );
}
