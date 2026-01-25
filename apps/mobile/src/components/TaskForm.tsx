/**
 * Task Form Component for Create/Edit
 * Migrated to NativeWind + UI primitives
 */

import { useState, useEffect } from "react";
import { View, ScrollView } from "react-native";
import { Alert } from "@/src/lib/alert";
import type {
  Task,
  TaskStatus,
  TaskPriority,
  CreateTaskInput,
  UpdateTaskInput,
} from "../types";
import { STATUS_LABELS, PRIORITY_LABELS } from "../types";
import { Text, Input, Textarea, Button, PressableBadge, Card } from "./ui";

type TaskFormProps =
  | {
      mode: "create";
      initialData?: undefined;
      onSubmit: (data: CreateTaskInput) => Promise<void>;
      onDelete?: undefined;
      isLoading?: boolean;
    }
  | {
      mode: "edit";
      initialData: Task;
      onSubmit: (data: UpdateTaskInput) => Promise<void>;
      onDelete: () => Promise<void>;
      isLoading?: boolean;
    };

const STATUS_OPTIONS: TaskStatus[] = [
  "todo",
  "in-progress",
  "review",
  "done",
  "blocked",
];
const PRIORITY_OPTIONS: TaskPriority[] = ["low", "medium", "high", "urgent"];

export function TaskForm({
  initialData,
  onSubmit,
  onDelete,
  isLoading = false,
  mode,
}: TaskFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [status, setStatus] = useState<TaskStatus>(
    initialData?.status || "todo"
  );
  const [priority, setPriority] = useState<TaskPriority>(
    initialData?.priority || "medium"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || "");
      setStatus(initialData.status);
      setPriority(initialData.priority);
    }
  }, [initialData]);

  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (!title.trim()) {
      setError("El título es requerido");
      return;
    }

    const data = {
      title: title.trim(),
      description: description.trim() || undefined,
      status,
      priority,
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await onSubmit(data as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error");
    }
  };

  const handleDelete = async () => {
    const confirmed = await Alert.confirmDestructive(
      "Eliminar Tarea",
      "¿Estás seguro que deseas eliminar esta tarea? Esta acción no se puede deshacer.",
      "Eliminar"
    );

    if (confirmed) {
      try {
        await onDelete?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al eliminar");
      }
    }
  };

  // Map status to badge variant
  const getStatusVariant = (s: TaskStatus) => {
    const map: Record<TaskStatus, "todo" | "in-progress" | "review" | "done" | "blocked"> = {
      todo: "todo",
      "in-progress": "in-progress",
      review: "review",
      done: "done",
      blocked: "blocked",
    };
    return map[s];
  };

  // Map priority to badge variant
  const getPriorityVariant = (p: TaskPriority) => {
    const map: Record<TaskPriority, "low" | "medium" | "high" | "urgent"> = {
      low: "low",
      medium: "medium",
      high: "high",
      urgent: "urgent",
    };
    return map[p];
  };

  return (
    <ScrollView
      className="flex-1 bg-secondary p-4"
      keyboardShouldPersistTaps="handled"
    >
      {/* Error Display */}
      {error && (
        <Card className="mb-4 border-destructive bg-red-50">
          <Text variant="error">{error}</Text>
        </Card>
      )}

      {/* Title */}
      <Input
        label="Título"
        required
        value={title}
        onChangeText={setTitle}
        placeholder="Ingresa el título de la tarea..."
        editable={!isLoading}
        containerClassName="mb-5"
      />

      {/* Description */}
      <Textarea
        label="Descripción"
        value={description}
        onChangeText={setDescription}
        placeholder="Describe la tarea..."
        editable={!isLoading}
        containerClassName="mb-5"
      />

      {/* Status */}
      <View className="mb-5 gap-2">
        <Text variant="label">Estado</Text>
        <View className="flex-row flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <PressableBadge
              key={opt}
              variant="outline"
              selectedVariant={getStatusVariant(opt)}
              selected={status === opt}
              onPress={() => setStatus(opt)}
              disabled={isLoading}
            >
              {STATUS_LABELS[opt]}
            </PressableBadge>
          ))}
        </View>
      </View>

      {/* Priority */}
      <View className="mb-5 gap-2">
        <Text variant="label">Prioridad</Text>
        <View className="flex-row flex-wrap gap-2">
          {PRIORITY_OPTIONS.map((opt) => (
            <PressableBadge
              key={opt}
              variant="outline"
              selectedVariant={getPriorityVariant(opt)}
              selected={priority === opt}
              onPress={() => setPriority(opt)}
              disabled={isLoading}
            >
              {PRIORITY_LABELS[opt]}
            </PressableBadge>
          ))}
        </View>
      </View>

      {/* Submit Button */}
      <Button
        onPress={handleSubmit}
        isLoading={isLoading}
        className="mt-2"
      >
        {mode === "create" ? "Crear Tarea" : "Guardar Cambios"}
      </Button>

      {/* Delete Button (edit mode only) */}
      {mode === "edit" && (
        <Button
          variant="outline-destructive"
          onPress={handleDelete}
          disabled={isLoading}
          className="mt-3"
        >
          Eliminar Tarea
        </Button>
      )}

      {/* Spacer */}
      <View className="h-10" />
    </ScrollView>
  );
}
