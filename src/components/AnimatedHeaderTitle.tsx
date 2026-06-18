import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import { PALETTE } from '../constants/colors';

interface Props {
  title?: string;
  tintColor?: string;
}

/** Slides the header title in from the left while fading it in, replayed every time the screen gains focus. */
export function AnimatedHeaderTitle({ title, tintColor }: Props) {
  const isFocused = useIsFocused();
  const translateX = useRef(new Animated.Value(-24)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isFocused) return;
    translateX.setValue(-24);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(translateX, { toValue: 0, tension: 90, friction: 8, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [isFocused, translateX, opacity]);

  return (
    <Animated.Text
      style={[styles.title, { color: tintColor ?? PALETTE.textPrimary, opacity, transform: [{ translateX }] }]}
      numberOfLines={1}
    >
      {title}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700' },
});
