/**
 * CreateSheet Component - "Crear" bottom sheet for quick entity creation
 * Migrated to NativeWind + Lucide icons
 */

import { View, TouchableOpacity, Modal, Pressable } from "react-native";
import { Users, CheckSquare, X, type LucideIcon } from "lucide-react-native";
import { Text } from "./ui";

interface CreateSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreateEntity: (entity: string) => void;
}

interface CreateOption {
  key: string;
  label: string;
  description: string;
  Icon: LucideIcon;
}

const CREATE_OPTIONS: CreateOption[] = [
  {
    key: "customer",
    label: "customer",
    description: "Crear nuevo customer",
    Icon: Users,
  },
  {
    key: "task",
    label: "task",
    description: "Crear nuevo task",
    Icon: CheckSquare,
  },
];

export function CreateSheet({
  visible,
  onClose,
  onCreateEntity,
}: CreateSheetProps) {
  const handleCreate = (option: CreateOption) => {
    onCreateEntity(option.key);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 justify-end bg-black/50"
        onPress={onClose}
      >
        <Pressable
          className="rounded-t-[20px] bg-background px-6 pb-10 pt-3"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <View className="mb-4 h-1 w-10 self-center rounded-full bg-border" />

          {/* Close button */}
          <TouchableOpacity
            className="absolute right-5 top-5 h-8 w-8 items-center justify-center rounded-full border border-border"
            onPress={onClose}
          >
            <X size={16} color="#737373" />
          </TouchableOpacity>

          {/* Header */}
          <Text className="mt-2 text-center text-xl font-semibold">Crear</Text>
          <Text className="mb-6 mt-2 text-center text-sm text-muted-foreground">
            Crea un nuevo elemento
          </Text>

          {/* Options */}
          <View className="gap-2">
            {CREATE_OPTIONS.map((option) => {
              const IconComponent = option.Icon;
              return (
                <TouchableOpacity
                  key={option.key}
                  className="flex-row items-center gap-4 py-4"
                  onPress={() => handleCreate(option)}
                  activeOpacity={0.7}
                >
                  <View className="w-8 items-center">
                    <IconComponent size={24} color="#171717" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold">{option.label}</Text>
                    <Text className="mt-0.5 text-sm text-muted-foreground">
                      {option.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
