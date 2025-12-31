import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Platform, TouchableOpacity, ViewStyle } from 'react-native';

/**
 * A custom tab bar button that provides haptic feedback when pressed.
 * This is recommended for building native-feeling tabs in Expo Router.
 */
export default function HapticTab(props: BottomTabBarButtonProps) {
    const { style, onPress, onLongPress, ...rest } = props;

    // Convert any 'null' values to 'undefined' to satisfy React Native's TouchableOpacityProps
    const cleanedProps: any = {};
    Object.keys(rest).forEach((key) => {
        const val = (rest as any)[key];
        cleanedProps[key] = val === null ? undefined : val;
    });

    return (
        <TouchableOpacity
            {...cleanedProps}
            activeOpacity={0.7}
            onPress={(event) => {
                if (Platform.OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                onPress?.(event);
            }}
            onLongPress={(event) => {
                if (Platform.OS === 'ios') {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }
                onLongPress?.(event);
            }}
            style={style as ViewStyle}
        />
    );
}
