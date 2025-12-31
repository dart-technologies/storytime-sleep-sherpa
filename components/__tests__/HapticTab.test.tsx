import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import HapticTab from '../HapticTab';

const mockImpactAsync = jest.fn();
jest.mock('expo-haptics', () => ({
    impactAsync: (...args: any[]) => mockImpactAsync(...args),
    ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
}));

describe('components/HapticTab', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('triggers haptics and forwards press handlers', () => {
        const onPress = jest.fn();
        const onLongPress = jest.fn();

        const { getByTestId } = render(
            <HapticTab
                testID="tab"
                onPress={onPress}
                onLongPress={onLongPress}
                style={null as any}
                accessibilityState={null as any}
            >
                {null}
            </HapticTab>
        );

        fireEvent.press(getByTestId('tab'));
        if (Platform.OS === 'ios') {
            expect(mockImpactAsync).toHaveBeenCalledWith('Light');
        }
        expect(onPress).toHaveBeenCalled();

        fireEvent(getByTestId('tab'), 'onLongPress');
        if (Platform.OS === 'ios') {
            expect(mockImpactAsync).toHaveBeenCalledWith('Medium');
        }
        expect(onLongPress).toHaveBeenCalled();
    });
});
