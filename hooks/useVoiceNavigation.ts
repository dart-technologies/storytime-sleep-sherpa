import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { AnalyticsService } from '../services/analytics';
import { personas } from '../lib/personas';
import { Story } from '../lib/models/story';
import { useElevenLabs } from './useElevenLabs';

export type VoiceIntent = {
    type: 'search' | 'play' | 'clear' | 'none';
    value?: string;
};

export function useVoiceNavigation(stories: Story[]) {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    const [isListening, setIsListening] = useState(false);
    const storiesRef = useRef(stories);

    useEffect(() => {
        storiesRef.current = stories;
    }, [stories]);

    const parseIntent = useCallback((text: string): VoiceIntent => {
        const lowerText = text.toLowerCase();

        if (lowerText.includes('search for') || lowerText.includes('find')) {
            const query = lowerText.split(/search for|find/)[1]?.trim();
            return { type: 'search', value: query };
        }

        if (lowerText.includes('play') || lowerText.includes('start')) {
            const title = lowerText.split(/play|start/)[1]?.trim();
            return { type: 'play', value: title };
        }

        if (lowerText.includes('clear') || lowerText.includes('reset')) {
            return { type: 'clear' };
        }

        return { type: 'none' };
    }, []);

    const handleMessage = useCallback((message: any) => {
        if (message.role === 'user') {
            const intent = parseIntent(String(message?.message || message?.text || ''));
            console.log('[VoiceNav] Detected intent:', intent);

            switch (intent.type) {
                case 'search':
                    if (intent.value) {
                        setSearchQuery(intent.value);
                        AnalyticsService.trackVoiceCommand('search', true);
                    }
                    break;
                case 'play':
                    if (intent.value) {
                        const story = storiesRef.current.find(s =>
                            s.title.toLowerCase().includes(intent.value!.toLowerCase())
                        );
                        if (story) {
                            AnalyticsService.trackVoiceCommand('play', true);
                            router.push({ pathname: '/library/[storyId]', params: { storyId: story.id } });
                        } else {
                            AnalyticsService.trackVoiceCommand('play', false);
                        }
                    }
                    break;
                case 'clear':
                    setSearchQuery('');
                    AnalyticsService.trackVoiceCommand('clear', true);
                    break;
                case 'none':
                    // Maybe track unrecognized commands?
                    break;
            }
        }
    }, [parseIntent, router]);

    // Use Sage as the library guide
    const sage = useMemo(() => personas.find(p => p.id === 'sage') || personas[0], []);
    const { startConversation, stopConversation, status } = useElevenLabs(sage, { onMessage: handleMessage });

    const startVoiceSearch = useCallback(async () => {
        setIsListening(true);
        await startConversation();
    }, [startConversation]);

    const stopVoiceSearch = useCallback(async () => {
        await stopConversation();
        setIsListening(false);
    }, [stopConversation]);

    return {
        searchQuery,
        setSearchQuery,
        isListening,
        startVoiceSearch,
        stopVoiceSearch,
        status,
        handleMessage
    };
}
