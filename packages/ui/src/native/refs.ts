/**
 * Ref types of the React Native primitives. React Native 0.87+ types View, Text, Image and TextInput as
 * function components, so the instance type is read from the component; on older releases it resolves
 * to the class instance, as `forwardRef<View, ...>` did.
 */
import type { ComponentRef } from "react";
import type { Image, Text, TextInput, View } from "react-native";

export type ViewRef = ComponentRef<typeof View>;
export type TextRef = ComponentRef<typeof Text>;
export type ImageRef = ComponentRef<typeof Image>;
export type TextInputRef = ComponentRef<typeof TextInput>;
