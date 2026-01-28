/**
 * Slider Component - React Native version
 * Custom slider using Animated + PanResponder
 */

import React, { useRef, useState, useCallback, useEffect } from "react"
import {
  View,
  Animated,
  PanResponder,
  StyleSheet,
  LayoutChangeEvent,
  type ViewStyle,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native"
import { useTheme } from "../native/ThemeContext"

export interface SliderProps {
  /** Current value (0-100 by default, or use min/max) */
  value?: number[]
  /** Default value if uncontrolled */
  defaultValue?: number[]
  /** Callback when value changes */
  onValueChange?: (value: number[]) => void
  /** Callback when sliding ends */
  onValueCommit?: (value: number[]) => void
  /** Minimum value */
  min?: number
  /** Maximum value */
  max?: number
  /** Step increment */
  step?: number
  /** Whether the slider is disabled */
  disabled?: boolean
  /** Custom styles for the container */
  style?: ViewStyle
  /** API compatibility - ignored in native */
  className?: string
}

const Slider = React.forwardRef<View, SliderProps>(
  (
    {
      value: controlledValue,
      defaultValue = [0],
      onValueChange,
      onValueCommit,
      min = 0,
      max = 100,
      step = 1,
      disabled = false,
      style,
    },
    ref
  ) => {
    const { colors } = useTheme()
    const [trackWidth, setTrackWidth] = useState(0)

    // Use controlled or uncontrolled value
    const isControlled = controlledValue !== undefined
    const [internalValue, setInternalValue] = useState(defaultValue[0])
    const currentValue = isControlled ? (controlledValue[0] ?? 0) : internalValue

    // Animated value for thumb position
    const pan = useRef(new Animated.Value(0)).current

    // Refs to access current values in PanResponder without recreating it
    const stateRef = useRef({
      trackWidth: 0,
      currentValue: 0,
      isControlled: false,
      disabled: false,
      min: 0,
      max: 100,
      step: 1,
      onValueChange: undefined as ((value: number[]) => void) | undefined,
      onValueCommit: undefined as ((value: number[]) => void) | undefined,
      setInternalValue: (() => {}) as React.Dispatch<React.SetStateAction<number>>,
    })

    // Track starting position for drag gestures
    const startPosition = useRef(0)

    // Keep refs in sync with props/state
    useEffect(() => {
      stateRef.current = {
        trackWidth,
        currentValue,
        isControlled,
        disabled,
        min,
        max,
        step,
        onValueChange,
        onValueCommit,
        setInternalValue,
      }
    })

    // Calculate position from value
    const valueToPosition = useCallback(
      (val: number, width: number = trackWidth) => {
        if (width === 0) return 0
        const percentage = (val - min) / (max - min)
        return percentage * width
      },
      [trackWidth, min, max]
    )

    // Calculate value from position (using ref values for PanResponder)
    const positionToValueRef = (pos: number) => {
      const { trackWidth: w, min: minVal, max: maxVal, step: stepVal } = stateRef.current
      if (w === 0) return minVal
      const percentage = Math.max(0, Math.min(1, pos / w))
      let val = minVal + percentage * (maxVal - minVal)
      // Apply step
      val = Math.round(val / stepVal) * stepVal
      return Math.max(minVal, Math.min(maxVal, val))
    }

    // Calculate position from value (using ref values for PanResponder)
    const valueToPositionRef = (val: number) => {
      const { trackWidth: w, min: minVal, max: maxVal } = stateRef.current
      if (w === 0) return 0
      const percentage = (val - minVal) / (maxVal - minVal)
      return percentage * w
    }

    // Update animated position when value changes (not during drag)
    useEffect(() => {
      const position = valueToPosition(currentValue)
      pan.setValue(position)
    }, [currentValue, valueToPosition, pan])

    // Create PanResponder ONCE - use refs to access current values
    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => !stateRef.current.disabled,
        onMoveShouldSetPanResponder: () => !stateRef.current.disabled,
        onPanResponderGrant: () => {
          // Store current position when drag starts
          pan.stopAnimation()
          startPosition.current = valueToPositionRef(stateRef.current.currentValue)
        },
        onPanResponderMove: (
          _: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          const { trackWidth: w, isControlled: controlled, onValueChange: onChange, setInternalValue: setVal } = stateRef.current

          // Calculate new position based on start position + drag delta
          const newPosition = Math.max(
            0,
            Math.min(w, startPosition.current + gestureState.dx)
          )
          pan.setValue(newPosition)

          const newValue = positionToValueRef(newPosition)
          if (!controlled) {
            setVal(newValue)
          }
          onChange?.([newValue])
        },
        onPanResponderRelease: () => {
          const { onValueCommit: onCommit } = stateRef.current
          const newValue = positionToValueRef((pan as any)._value)
          onCommit?.([newValue])
        },
      })
    ).current

    const handleTrackLayout = (event: LayoutChangeEvent) => {
      const { width } = event.nativeEvent.layout
      // Account for thumb width (16px)
      setTrackWidth(width - 16)
    }

    const handleTrackPress = (event: any) => {
      if (disabled) return
      const { locationX } = event.nativeEvent
      const positionToValue = (pos: number) => {
        if (trackWidth === 0) return min
        const percentage = Math.max(0, Math.min(1, pos / trackWidth))
        let val = min + percentage * (max - min)
        val = Math.round(val / step) * step
        return Math.max(min, Math.min(max, val))
      }

      const newValue = positionToValue(locationX - 8) // Offset for thumb center

      if (!isControlled) {
        setInternalValue(newValue)
      }
      onValueChange?.([newValue])
      onValueCommit?.([newValue])

      // Animate to new position
      Animated.spring(pan, {
        toValue: valueToPosition(newValue),
        useNativeDriver: false,
        friction: 7,
      }).start()
    }

    // Calculate fill width percentage
    const fillPercentage = ((currentValue - min) / (max - min)) * 100

    return (
      <View
        ref={ref}
        style={[styles.container, style]}
        onLayout={handleTrackLayout}
        onStartShouldSetResponder={() => !disabled}
        onResponderRelease={handleTrackPress}
      >
        {/* Track */}
        <View
          style={[
            styles.track,
            { backgroundColor: colors.secondary },
            disabled && styles.trackDisabled,
          ]}
        >
          {/* Filled Range */}
          <View
            style={[
              styles.range,
              {
                backgroundColor: disabled ? colors.muted : colors.primary,
                width: `${fillPercentage}%`,
              },
            ]}
          />
        </View>

        {/* Thumb */}
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.thumb,
            {
              backgroundColor: colors.background,
              borderColor: disabled ? colors.muted : colors.primary,
              transform: [{ translateX: pan }],
            },
            disabled && styles.thumbDisabled,
          ]}
        />
      </View>
    )
  }
)

Slider.displayName = "Slider"

const styles = StyleSheet.create({
  container: {
    height: 20,
    justifyContent: "center",
    position: "relative",
  },
  track: {
    height: 6,
    borderRadius: 3,
    width: "100%",
    overflow: "hidden",
  },
  trackDisabled: {
    opacity: 0.5,
  },
  range: {
    height: "100%",
    borderRadius: 3,
  },
  thumb: {
    position: "absolute",
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  thumbDisabled: {
    opacity: 0.5,
  },
})

export { Slider }
