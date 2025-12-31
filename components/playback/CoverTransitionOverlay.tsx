import React from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { playbackStyles as styles } from '../screenStyles/playbackStyles';

export function CoverTransitionOverlay({
    active,
    source,
    overlayStyle,
}: {
    active: boolean;
    source: any;
    overlayStyle: any;
}) {
    if (!active || !source) return null;

    return (
        <Animated.View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <Animated.Image
                source={source as any}
                style={[styles.transitionCover, overlayStyle]}
                resizeMode="cover"
            />
        </Animated.View>
    );
}

