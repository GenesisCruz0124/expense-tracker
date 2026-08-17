import React from 'react';
import { Image, StyleProp, Text, TextStyle, View, ViewStyle } from 'react-native';

import { ACCOUNT_LOGOS, DEFAULT_ACCOUNT_ICON } from '../constants/accountIcons';

interface Props {
  icon?: string | null;
  size?: number;
  textStyle?: StyleProp<TextStyle>;
  imageStyle?: StyleProp<ViewStyle>;
}

/** Renders an account/account-category icon — a real bank logo image for `logo:*` values, an emoji otherwise. */
export function AccountIcon({ icon, size = 16, textStyle, imageStyle }: Props) {
  const value = icon ?? DEFAULT_ACCOUNT_ICON;
  const logo = ACCOUNT_LOGOS[value];
  if (logo) {
    return (
      <View style={[{ width: size, height: size, borderRadius: size * 0.2, overflow: 'hidden' }, imageStyle]}>
        <Image source={logo} style={{ width: size, height: size }} resizeMode="contain" />
      </View>
    );
  }
  return <Text style={[{ fontSize: size }, textStyle]}>{value}</Text>;
}
