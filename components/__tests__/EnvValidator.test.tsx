import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import EnvValidator from '../EnvValidator';

const mockShowToast = jest.fn();
jest.mock('../ErrorProvider', () => ({
    useError: () => ({ showToast: mockShowToast }),
}));

const mockValidatePublicEnv = jest.fn();
jest.mock('../../lib/env', () => ({
    validatePublicEnv: () => mockValidatePublicEnv(),
}));

describe('EnvValidator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('shows an error toast when required env vars are missing', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { });
        mockValidatePublicEnv.mockReturnValueOnce({
            missingRequired: ['EXPO_PUBLIC_WEB_BASE_URL'],
            missingAgentIds: ['luna'],
            misconfigured: [],
        });

        render(<EnvValidator />);

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({
                type: 'error',
                message: expect.stringContaining('Missing required env vars:'),
            }));
        });

        expect(warnSpy).toHaveBeenCalledWith('[Env] Voice not configured: luna');
        warnSpy.mockRestore();
    });

    it('shows misconfiguration errors and missing voice warnings', async () => {
        mockValidatePublicEnv.mockReturnValueOnce({
            missingRequired: [],
            missingAgentIds: ['luna'],
            misconfigured: ['Bad config'],
        });

        render(<EnvValidator />);

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledTimes(2);
        });

        expect(mockShowToast.mock.calls[0]?.[0]).toMatchObject({
            type: 'error',
            message: 'Env config issue: Bad config',
        });
        expect(mockShowToast.mock.calls[1]?.[0]).toMatchObject({
            type: 'info',
            message: 'Voice not configured: luna',
        });
    });

    it('does not validate env twice', async () => {
        mockValidatePublicEnv.mockReturnValue({
            missingRequired: [],
            missingAgentIds: [],
            misconfigured: [],
        });

        const { rerender } = render(<EnvValidator />);
        await waitFor(() => {
            expect(mockValidatePublicEnv).toHaveBeenCalledTimes(1);
        });

        rerender(<EnvValidator />);
        expect(mockValidatePublicEnv).toHaveBeenCalledTimes(1);
        expect(mockShowToast).not.toHaveBeenCalled();
    });
});

