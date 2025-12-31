import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { TouchableOpacity } from 'react-native';
import FeaturedCarousel from '../FeaturedCarousel';
import { SEASONAL_SPECIALS } from '../../lib/seasonalSpecials';

jest.mock('react-native-reanimated', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Reanimated = require('react-native-reanimated/mock');
    Reanimated.default.call = () => {};
    return Reanimated;
});

jest.mock('expo-blur', () => ({
    BlurView: ({ children }: any) => children,
}));

describe('components/FeaturedCarousel', () => {
    it('calls onSelect with the tapped story', () => {
        const onSelect = jest.fn();
        const { UNSAFE_getAllByType } = render(<FeaturedCarousel onSelect={onSelect} />);

        const touchables = UNSAFE_getAllByType(TouchableOpacity);
        fireEvent.press(touchables[0]);

        expect(onSelect).toHaveBeenCalledWith(SEASONAL_SPECIALS[0]);
    });
});

