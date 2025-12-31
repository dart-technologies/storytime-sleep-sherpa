import { useState } from 'react';
import { useIllustration } from './ai/useIllustration';
import { useStoryGeneration } from './ai/useStoryGeneration';
import { useVisionAnalysis } from './ai/useVisionAnalysis';

export function useGemini() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { generateAIBasedStory } = useStoryGeneration({ setLoading, setError });
    const { analyzeImageWithVision } = useVisionAnalysis({ setLoading, setError });
    const { generateStoryIllustration } = useIllustration({ setLoading, setError });

    return {
        generateAIBasedStory,
        analyzeImageWithVision,
        generateStoryIllustration,
        loading,
        error,
    };
}
