import React from 'react';
import { render } from '@testing-library/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BreathingGuide } from '../BreathingGuide';

jest.mock('react-native-reanimated', () => {
    const Reanimated = jest.requireActual('react-native-reanimated/mock');
    Reanimated.default.call = () => { };
    return Reanimated;
});

jest.mock('expo-linear-gradient', () => {
    const React = require('react');

    function LinearGradientMock({ children }: any) {
        return React.createElement(React.Fragment, null, children);
    }

    return {
        LinearGradient: LinearGradientMock,
    };
});

describe('BreathingGuide', () => {
    it('renders rings without gradients', () => {
        const { UNSAFE_queryAllByType } = render(
            <BreathingGuide variant="rings" />
        );

        expect(UNSAFE_queryAllByType(LinearGradient)).toHaveLength(0);
    });

    it.each([
        { name: 'short hex', color: '#abc', expectedFirst: 'rgba(170, 187, 204, 0.12)' },
        { name: 'hex', color: '#112233', expectedFirst: 'rgba(17, 34, 51, 0.12)' },
        { name: 'rgb', color: 'rgb(10, 20, 30)', expectedFirst: 'rgba(10, 20, 30, 0.12)' },
        { name: 'rgba', color: 'rgba(10, 20, 30, 0.5)', expectedFirst: 'rgba(10, 20, 30, 0.12)' },
        { name: 'invalid hex length', color: '#abcd', expectedFirst: '#abcd' },
        { name: 'invalid hex digits', color: '#zzzzzz', expectedFirst: '#zzzzzz' },
        { name: 'invalid rgba', color: 'rgba(1,2,3)', expectedFirst: 'rgba(1,2,3)' },
        { name: 'invalid rgb', color: 'rgb(1,2)', expectedFirst: 'rgb(1,2)' },
        { name: 'unknown', color: 'red', expectedFirst: 'red' },
    ])('applies alpha to $name colors', ({ color, expectedFirst }) => {
        const { UNSAFE_getAllByType } = render(
            <BreathingGuide variant="glow" color={color} />
        );

        const gradients = UNSAFE_getAllByType(LinearGradient);
        expect(gradients).toHaveLength(2);
        expect(gradients[0]?.props.colors?.[0]).toBe(expectedFirst);
    });
});

