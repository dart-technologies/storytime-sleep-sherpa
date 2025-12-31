
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// Mocks
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
    useRouter: () => ({ push: mockPush, setParams: jest.fn() }),
    useLocalSearchParams: () => ({ remixId: null, remixContext: null }),
}));

const mockTrackPersonaSelected = jest.fn();
jest.mock('../../services/analytics', () => ({
    AnalyticsService: {
        trackPersonaSelected: (...args: any[]) => mockTrackPersonaSelected(...args),
    },
}));

const mockPlayLatencyMask = jest.fn();
const mockStopLatencyMask = jest.fn();
jest.mock('../../components/ElevenLabsConversationProvider', () => ({
    useElevenLabsConversation: () => ({
        playLatencyMask: mockPlayLatencyMask,
        stopLatencyMask: mockStopLatencyMask,
    }),
}));

jest.mock('../../hooks/useAuth', () => ({
    useAuth: () => ({ user: { displayName: 'Michael C' }, loading: false }),
}));

jest.mock('../../lib/dailyCreateCap', () => ({
    assertUnderDailyCreateCap: jest.fn(async () => undefined),
}));

jest.mock('expo-blur', () => ({
    BlurView: ({ children }: any) => children,
}));

jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

jest.mock('../../components/PersonaCard', () => {
    const { Text, TouchableOpacity } = require('react-native');
    return ({ persona, onPress }: any) => (
        <TouchableOpacity onPress={() => onPress(persona)} testID={`persona-${persona.id}`}>
            <Text>{persona.name}</Text>
        </TouchableOpacity>
    );
});

jest.mock('../../lib/personas', () => ({
    personas: [
        { id: 'luna', name: 'Luna', agentId: 'agent-1' },
        { id: 'kai', name: 'Kai', agentId: 'agent-2' },
    ],
}));

jest.mock('react-native-safe-area-context', () => ({
    SafeAreaView: ({ children }: any) => children,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CreateScreen = require('../../app/(tabs)/create').default;

describe('CreateScreen', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders persona grid', () => {
        const { getByText } = render(<CreateScreen />);
        expect(getByText('Luna')).toBeTruthy();
        expect(getByText('Kai')).toBeTruthy();
        expect(getByText('Storytime')).toBeTruthy();
        expect(getByText('💤 SHERPAS')).toBeTruthy();
        expect(getByText('🪄 Michael')).toBeTruthy();
    });

    it('navigates to intake on persona selection', () => {
        const router = require('expo-router').useRouter();
        const { getByTestId } = render(<CreateScreen />);

        fireEvent.press(getByTestId('persona-luna'));

        expect(mockStopLatencyMask).toHaveBeenCalled();
        expect(mockPlayLatencyMask).toHaveBeenCalledWith(expect.objectContaining({ id: 'luna' }), 'welcome');
        expect(mockTrackPersonaSelected).toHaveBeenCalledWith('luna', { isRemix: false });
        expect(mockPush).toHaveBeenCalledWith({
            pathname: '/create/intake/[personaId]',
            params: { personaId: 'luna', remixId: null, remixContext: null },
        });
    });
});
