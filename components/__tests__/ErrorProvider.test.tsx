import React from 'react';
import { render, act, renderHook, fireEvent } from '@testing-library/react-native';
import { ErrorProvider, useError } from '../ErrorProvider';
import { Text, TouchableOpacity } from 'react-native';

describe('ErrorProvider', () => {
    it('provides showToast function and renders children', () => {
        const TestComponent = () => {
            const { showToast } = useError();
            return (
                <TouchableOpacity onPress={() => showToast({ message: 'Test Message' })}>
                    <Text>Click Me</Text>
                </TouchableOpacity>
            );
        };

        const { getByText, queryByText } = render(
            <ErrorProvider>
                <TestComponent />
            </ErrorProvider>
        );

        expect(getByText('Click Me')).toBeTruthy();
        expect(queryByText('Test Message')).toBeNull();

        act(() => {
            fireEvent.press(getByText('Click Me'));
        });

        expect(getByText('Test Message')).toBeTruthy();
    });

    it('throws error when useError is used outside ErrorProvider', () => {
        const { result } = renderHook(() => {
            try {
                return useError();
            } catch (e) {
                return (e as Error).message;
            }
        });
        expect(result.current).toBe('useError must be used within an ErrorProvider');
    });
});
