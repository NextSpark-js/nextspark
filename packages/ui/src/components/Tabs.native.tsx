import React, { createContext, useContext, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { useTheme } from "../native/ThemeContext";

// Context for Tabs state
interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs components must be used within a Tabs provider");
  }
  return context;
}

// Tabs Root
export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  style?: ViewStyle;
  /** API compatibility - ignored in native */
  className?: string;
  /** API compatibility - ignored in native */
  defaultValue?: string;
}

const Tabs = React.forwardRef<View, TabsProps>(
  ({ value, onValueChange, children, style, className, defaultValue }, ref) => {
    const contextValue = useMemo(
      () => ({ value, onValueChange }),
      [value, onValueChange]
    );

    return (
      <TabsContext.Provider value={contextValue}>
        <View ref={ref} style={style}>
          {children}
        </View>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = "Tabs";

// TabsList
export interface TabsListProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** API compatibility - ignored in native */
  className?: string;
}

const TabsList = React.forwardRef<View, TabsListProps>(
  ({ children, style, className }, ref) => {
    const { colors } = useTheme();

    return (
      <View
        ref={ref}
        style={[
          styles.list,
          { backgroundColor: colors.muted },
          style,
        ]}
      >
        {children}
      </View>
    );
  }
);
TabsList.displayName = "TabsList";

// TabsTrigger
export interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  /** API compatibility - ignored in native */
  className?: string;
}

const TabsTrigger = React.forwardRef<View, TabsTriggerProps>(
  ({ value, children, disabled, style, textStyle, className }, ref) => {
    const { colors } = useTheme();
    const { value: activeValue, onValueChange } = useTabsContext();
    const isActive = activeValue === value;

    return (
      <Pressable
        ref={ref}
        disabled={disabled}
        onPress={() => onValueChange(value)}
        style={({ pressed }) => [
          styles.trigger,
          isActive && [styles.triggerActive, { backgroundColor: colors.background }],
          pressed && styles.pressed,
          disabled && styles.disabled,
          style,
        ]}
      >
        {typeof children === "string" ? (
          <Text
            style={[
              styles.triggerText,
              { color: colors.mutedForeground },
              isActive && { color: colors.foreground },
              textStyle,
            ]}
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </Pressable>
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

// TabsContent
export interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  style?: ViewStyle;
  /** API compatibility - ignored in native */
  className?: string;
}

const TabsContent = React.forwardRef<View, TabsContentProps>(
  ({ value, children, style, className }, ref) => {
    const { value: activeValue } = useTabsContext();

    if (activeValue !== value) {
      return null;
    }

    return (
      <View ref={ref} style={[styles.content, style]}>
        {children}
      </View>
    );
  }
);
TabsContent.displayName = "TabsContent";

const styles = StyleSheet.create({
  list: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  trigger: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  triggerActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  triggerText: {
    fontSize: 14,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    marginTop: 8,
  },
});

export { Tabs, TabsList, TabsTrigger, TabsContent };
