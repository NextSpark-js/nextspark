/**
 * Customer Card Component
 * Migrated to NativeWind + UI primitives
 */

import { View } from "react-native";
import type { Customer } from "../types";
import { Text, PressableCard, CardContent, Badge } from "./ui";

interface CustomerCardProps {
  customer: Customer;
  onPress: () => void;
}

export function CustomerCard({ customer, onPress }: CustomerCardProps) {
  return (
    <PressableCard className="mx-4 my-1.5" onPress={onPress}>
      <CardContent>
        {/* Header: Name + Account Badge */}
        <View className="mb-3 flex-row items-center justify-between">
          <Text weight="semibold" className="flex-1 text-base" numberOfLines={1}>
            {customer.name}
          </Text>
          <Badge variant="secondary" className="ml-2">
            #{customer.account}
          </Badge>
        </View>

        {/* Details */}
        <View className="gap-1.5">
          <View className="flex-row">
            <Text variant="muted" className="w-20 text-[13px]">
              Oficina:
            </Text>
            <Text className="flex-1 text-[13px]">{customer.office}</Text>
          </View>

          {customer.phone && (
            <View className="flex-row">
              <Text variant="muted" className="w-20 text-[13px]">
                Teléfono:
              </Text>
              <Text className="flex-1 text-[13px]">{customer.phone}</Text>
            </View>
          )}

          {customer.salesRep && (
            <View className="flex-row">
              <Text variant="muted" className="w-20 text-[13px]">
                Vendedor:
              </Text>
              <Text className="flex-1 text-[13px]">{customer.salesRep}</Text>
            </View>
          )}
        </View>
      </CardContent>
    </PressableCard>
  );
}
