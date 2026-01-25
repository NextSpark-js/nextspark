/**
 * BottomTabBar Component - NextSpark Mobile Style
 * Inicio | Tareas | [Crear] | Clientes | Más
 * Migrated to NativeWind + UI primitives + Lucide icons
 */

import { View, Pressable } from "react-native";
import { Home, CheckSquare, Plus, Users, Menu, type LucideIcon } from "lucide-react-native";
import { Text } from "./ui";

export type TabKey = "home" | "tasks" | "create" | "customers" | "more";

interface BottomTabBarProps {
  activeTab: TabKey;
  onTabPress: (tab: TabKey) => void;
}

interface TabItem {
  key: TabKey;
  label: string;
  Icon: LucideIcon;
}

const TABS: TabItem[] = [
  { key: "home", label: "Inicio", Icon: Home },
  { key: "tasks", label: "Tareas", Icon: CheckSquare },
  { key: "create", label: "Crear", Icon: Plus },
  { key: "customers", label: "Clientes", Icon: Users },
  { key: "more", label: "Más", Icon: Menu },
];

export function BottomTabBar({ activeTab, onTabPress }: BottomTabBarProps) {
  return (
    <View className="flex-row items-end justify-around border-t border-border bg-background pb-2 pt-2">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        const isCreate = tab.key === "create";
        const IconComponent = tab.Icon;

        if (isCreate) {
          return (
            <Pressable
              key={tab.key}
              className="-mt-6 flex-1 items-center"
              onPress={() => onTabPress(tab.key)}
            >
              <View className="h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg">
                <IconComponent size={28} color="#fafafa" strokeWidth={1.5} />
              </View>
              <Text className="mt-1 text-[11px] font-medium text-muted-foreground">
                {tab.label}
              </Text>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={tab.key}
            className="flex-1 items-center justify-center py-2"
            onPress={() => onTabPress(tab.key)}
          >
            <IconComponent
              size={24}
              color={isActive ? "#171717" : "#737373"}
              strokeWidth={isActive ? 2 : 1.5}
            />
            <Text
              className={`mt-1 text-[11px] font-medium ${
                isActive ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
