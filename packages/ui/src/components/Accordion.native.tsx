import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useEffect,
  useState,
} from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { useTheme } from "../native/ThemeContext";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Accordion Context
interface AccordionContextValue {
  type: "single" | "multiple";
  expandedItems: string[];
  toggleItem: (value: string) => void;
  collapsible?: boolean;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

function useAccordionContext() {
  const context = useContext(AccordionContext);
  if (!context) {
    throw new Error("Accordion components must be used within an Accordion provider");
  }
  return context;
}

// AccordionItem Context
interface AccordionItemContextValue {
  value: string;
  isExpanded: boolean;
}

const AccordionItemContext = createContext<AccordionItemContextValue | null>(null);

function useAccordionItemContext() {
  const context = useContext(AccordionItemContext);
  if (!context) {
    throw new Error("AccordionItem components must be used within an AccordionItem");
  }
  return context;
}

// Accordion Root
export interface AccordionProps {
  type?: "single" | "multiple";
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  collapsible?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
  /** API compatibility - ignored in native */
  className?: string;
}

const Accordion = React.forwardRef<View, AccordionProps>(
  (
    {
      type = "single",
      value,
      defaultValue,
      onValueChange,
      collapsible = false,
      children,
      style,
      className,
    },
    ref
  ) => {
    // Internal state for uncontrolled mode
    const [internalValue, setInternalValue] = useState<string[]>(() => {
      if (value !== undefined) {
        return Array.isArray(value) ? value : value ? [value] : [];
      }
      if (defaultValue !== undefined) {
        return Array.isArray(defaultValue) ? defaultValue : defaultValue ? [defaultValue] : [];
      }
      return [];
    });

    // Use controlled value if provided
    const expandedItems = value !== undefined
      ? (Array.isArray(value) ? value : value ? [value] : [])
      : internalValue;

    const toggleItem = (itemValue: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      let newItems: string[];

      if (type === "single") {
        if (expandedItems.includes(itemValue)) {
          newItems = collapsible ? [] : [itemValue];
        } else {
          newItems = [itemValue];
        }
      } else {
        if (expandedItems.includes(itemValue)) {
          newItems = expandedItems.filter((v) => v !== itemValue);
        } else {
          newItems = [...expandedItems, itemValue];
        }
      }

      if (value === undefined) {
        setInternalValue(newItems);
      }

      if (onValueChange) {
        onValueChange(type === "single" ? (newItems[0] || "") : newItems);
      }
    };

    const contextValue = useMemo(
      () => ({ type, expandedItems, toggleItem, collapsible }),
      [type, expandedItems, collapsible]
    );

    return (
      <AccordionContext.Provider value={contextValue}>
        <View ref={ref} style={style}>
          {children}
        </View>
      </AccordionContext.Provider>
    );
  }
);
Accordion.displayName = "Accordion";

// AccordionItem
export interface AccordionItemProps {
  value: string;
  children: React.ReactNode;
  style?: ViewStyle;
  /** API compatibility - ignored in native */
  className?: string;
}

const AccordionItem = React.forwardRef<View, AccordionItemProps>(
  ({ value, children, style, className }, ref) => {
    const { colors } = useTheme();
    const { expandedItems } = useAccordionContext();
    const isExpanded = expandedItems.includes(value);

    const contextValue = useMemo(
      () => ({ value, isExpanded }),
      [value, isExpanded]
    );

    return (
      <AccordionItemContext.Provider value={contextValue}>
        <View
          ref={ref}
          style={[
            styles.item,
            { borderBottomColor: colors.border },
            style,
          ]}
        >
          {children}
        </View>
      </AccordionItemContext.Provider>
    );
  }
);
AccordionItem.displayName = "AccordionItem";

// AccordionTrigger
export interface AccordionTriggerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  /** API compatibility - ignored in native */
  className?: string;
}

const AccordionTrigger = React.forwardRef<View, AccordionTriggerProps>(
  ({ children, style, textStyle, className }, ref) => {
    const { colors } = useTheme();
    const { toggleItem } = useAccordionContext();
    const { value, isExpanded } = useAccordionItemContext();
    const rotateAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

    useEffect(() => {
      Animated.timing(rotateAnim, {
        toValue: isExpanded ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }, [isExpanded, rotateAnim]);

    const rotation = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "180deg"],
    });

    return (
      <Pressable
        ref={ref}
        onPress={() => toggleItem(value)}
        style={({ pressed }) => [
          styles.trigger,
          pressed && styles.pressed,
          style,
        ]}
      >
        {typeof children === "string" ? (
          <Text style={[styles.triggerText, { color: colors.foreground }, textStyle]}>
            {children}
          </Text>
        ) : (
          <View style={styles.triggerContent}>{children}</View>
        )}
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <ChevronIcon color={colors.mutedForeground} />
        </Animated.View>
      </Pressable>
    );
  }
);
AccordionTrigger.displayName = "AccordionTrigger";

// AccordionContent
export interface AccordionContentProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** API compatibility - ignored in native */
  className?: string;
}

const AccordionContent = React.forwardRef<View, AccordionContentProps>(
  ({ children, style, className }, ref) => {
    const { isExpanded } = useAccordionItemContext();

    if (!isExpanded) {
      return null;
    }

    return (
      <View ref={ref} style={[styles.content, style]}>
        {children}
      </View>
    );
  }
);
AccordionContent.displayName = "AccordionContent";

// Simple Chevron Icon component (no external dependency)
interface ChevronIconProps {
  color?: string;
  size?: number;
}

function ChevronIcon({ color = "#666", size = 16 }: ChevronIconProps) {
  return (
    <View style={{ width: size, height: size, justifyContent: "center", alignItems: "center" }}>
      <View
        style={{
          width: size * 0.5,
          height: size * 0.5,
          borderRightWidth: 2,
          borderBottomWidth: 2,
          borderColor: color,
          transform: [{ rotate: "45deg" }, { translateY: -2 }],
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    borderBottomWidth: 1,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  triggerContent: {
    flex: 1,
  },
  triggerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  pressed: {
    opacity: 0.7,
  },
  content: {
    paddingBottom: 16,
  },
});

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
