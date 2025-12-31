import { render } from '@testing-library/react-native';
import React from 'react';
import WaveformVisualizer from '../WaveformVisualizer';

// Mock Reanimated
jest.mock('react-native-reanimated', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Reanimated = require('react-native-reanimated/mock');

    // Customize mock to record shared value changes if needed
    Reanimated.default.addWhitelistedNativeProps({
        height: true,
        backgroundColor: true,
    });

    return {
        ...Reanimated,
        useSharedValue: jest.fn(() => ({ value: 10 })),
        useAnimatedStyle: jest.fn((cb) => cb()),
        withTiming: jest.fn((val) => val),
        withRepeat: jest.fn((val) => val),
        withSequence: jest.fn((val) => val),
        interpolate: jest.fn((val, from, to) => to[0]),
        Easing: {
            inOut: jest.fn((val) => val),
            ease: jest.fn(),
            sin: jest.fn(),
        },
    };
});

describe('WaveformVisualizer', () => {
    it('renders correctly', () => {
        render(<WaveformVisualizer isPlaying={false} />);
        // WaveformVisualizer renders a container and 15 bars
        // Since we didn't add testID to bars, we can check by structural elements if needed
        // but for now let's just ensure it doesn't crash during render
    });

    it('renders with custom color', () => {
        render(<WaveformVisualizer isPlaying={true} color="#ff0000" />);
    });
});
