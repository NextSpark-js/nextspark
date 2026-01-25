/**
 * Task Card Component
 * Migrated to NativeWind + UI primitives
 */

import { View } from "react-native";
import type { Task } from "../types";
import { STATUS_LABELS, PRIORITY_LABELS } from "../types";
import {
  Text,
  PressableCard,
  CardContent,
  CardFooter,
  Badge,
  Separator,
} from "./ui";

interface TaskCardProps {
  task: Task;
  onPress: () => void;
  onStatusChange?: (status: Task["status"]) => void;
}

export function TaskCard({ task, onPress }: TaskCardProps) {
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Map status to badge variant
  const getStatusVariant = (status: Task["status"]) => {
    const map: Record<Task["status"], "todo" | "in-progress" | "review" | "done" | "blocked"> = {
      todo: "todo",
      "in-progress": "in-progress",
      review: "review",
      done: "done",
      blocked: "blocked",
    };
    return map[status];
  };

  // Map priority to badge variant
  const getPriorityVariant = (priority: Task["priority"]) => {
    const map: Record<Task["priority"], "low" | "medium" | "high" | "urgent"> = {
      low: "low",
      medium: "medium",
      high: "high",
      urgent: "urgent",
    };
    return map[priority];
  };

  return (
    <PressableCard className="mx-4 my-1.5" onPress={onPress}>
      <CardContent className="gap-2">
        {/* Title */}
        <Text weight="semibold" className="text-base" numberOfLines={2}>
          {task.title}
        </Text>

        {/* Description */}
        {task.description && (
          <Text variant="muted" className="text-sm leading-5" numberOfLines={2}>
            {task.description}
          </Text>
        )}

        {/* Badges */}
        <View className="mt-1 flex-row flex-wrap gap-2">
          <Badge variant={getStatusVariant(task.status)} showDot>
            {STATUS_LABELS[task.status]}
          </Badge>
          <Badge variant={getPriorityVariant(task.priority)}>
            {PRIORITY_LABELS[task.priority]}
          </Badge>
        </View>
      </CardContent>

      {/* Due Date */}
      {task.dueDate && (
        <CardFooter>
          <Text variant="muted" className="text-xs">
            Vence: {formatDate(task.dueDate)}
          </Text>
        </CardFooter>
      )}
    </PressableCard>
  );
}
