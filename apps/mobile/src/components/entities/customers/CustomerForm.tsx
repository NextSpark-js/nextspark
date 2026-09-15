/**
 * Customer Form Component for Create/Edit
 * Migrated to NativeWind + UI primitives
 */

import { useState, useEffect } from "react";
import { View, ScrollView } from "react-native";
import { Alert } from "@nextsparkjs/mobile";
import type {
  Customer,
  CreateCustomerInput,
  UpdateCustomerInput,
} from "../../../entities/customers";
import { Text, Input, Button, Card } from "../../ui";

type CustomerFormProps =
  | {
      mode: "create";
      initialData?: undefined;
      onSubmit: (data: CreateCustomerInput) => Promise<void>;
      onDelete?: undefined;
      isLoading?: boolean;
    }
  | {
      mode: "edit";
      initialData: Customer;
      onSubmit: (data: UpdateCustomerInput) => Promise<void>;
      onDelete: () => Promise<void>;
      isLoading?: boolean;
    };

export function CustomerForm({
  initialData,
  onSubmit,
  onDelete,
  isLoading = false,
  mode,
}: CustomerFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [account, setAccount] = useState(
    initialData?.account?.toString() || ""
  );
  const [office, setOffice] = useState(initialData?.office || "");
  const [phone, setPhone] = useState(initialData?.phone || "");
  const [salesRep, setSalesRep] = useState(initialData?.salesRep || "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setAccount(initialData.account?.toString() || "");
      setOffice(initialData.office);
      setPhone(initialData.phone || "");
      setSalesRep(initialData.salesRep || "");
    }
  }, [initialData]);

  const handleSubmit = async () => {
    setError(null);

    // Validation
    if (!name.trim()) {
      setError("El nombre es requerido");
      return;
    }
    if (!account.trim() || isNaN(Number(account))) {
      setError("El número de cuenta es requerido");
      return;
    }
    if (!office.trim()) {
      setError("La oficina es requerida");
      return;
    }

    const data = {
      name: name.trim(),
      account: Number(account),
      office: office.trim(),
      phone: phone.trim() || undefined,
      salesRep: salesRep.trim() || undefined,
    };

    try {
      await onSubmit(data as CreateCustomerInput & UpdateCustomerInput);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error");
    }
  };

  const handleDelete = async () => {
    const confirmed = await Alert.confirmDestructive(
      "Eliminar Cliente",
      "¿Estás seguro que deseas eliminar este cliente? Esta acción no se puede deshacer.",
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

      {/* Name */}
      <Input
        label="Nombre"
        required
        value={name}
        onChangeText={setName}
        placeholder="Ingresa el nombre del cliente..."
        editable={!isLoading}
        containerClassName="mb-5"
      />

      {/* Account Number */}
      <Input
        label="Número de Cuenta"
        required
        value={account}
        onChangeText={setAccount}
        placeholder="Ingresa el número de cuenta..."
        keyboardType="numeric"
        editable={!isLoading}
        containerClassName="mb-5"
      />

      {/* Office */}
      <Input
        label="Oficina"
        required
        value={office}
        onChangeText={setOffice}
        placeholder="Ingresa la ubicación de oficina..."
        editable={!isLoading}
        containerClassName="mb-5"
      />

      {/* Phone */}
      <Input
        label="Teléfono"
        value={phone}
        onChangeText={setPhone}
        placeholder="Ingresa el número de teléfono..."
        keyboardType="phone-pad"
        editable={!isLoading}
        containerClassName="mb-5"
      />

      {/* Sales Rep */}
      <Input
        label="Representante de Ventas"
        value={salesRep}
        onChangeText={setSalesRep}
        placeholder="Ingresa el nombre del vendedor..."
        editable={!isLoading}
        containerClassName="mb-5"
      />

      {/* Submit Button */}
      <Button onPress={handleSubmit} isLoading={isLoading} className="mt-2">
        {mode === "create" ? "Crear Cliente" : "Guardar Cambios"}
      </Button>

      {/* Delete Button (edit mode only) */}
      {mode === "edit" && (
        <Button
          variant="outline-destructive"
          onPress={handleDelete}
          disabled={isLoading}
          className="mt-3"
        >
          Eliminar Cliente
        </Button>
      )}

      {/* Spacer */}
      <View className="h-10" />
    </ScrollView>
  );
}
