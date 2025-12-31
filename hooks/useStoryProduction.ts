import { useCallback } from 'react';
import { SoundscapeId } from '../lib/assetMapper';
import { createFlowLogger } from '../lib/debugLogger';
import { auth, getFirebaseIdToken } from '../lib/firebase';
import { assertUnderDailyCreateCap, incrementDailyCreateCount } from '../lib/dailyCreateCap';
import { normalizeOneLine } from '../lib/stringUtils';
import type { StoryGeneration } from '../lib/models/story';
import { Persona } from '../lib/personas';
import { AnalyticsService } from '../services/analytics';
import { startCoverArtGeneration, patchCoverArtAfterSave } from './production/coverArt';
import { useProductionState } from './production/useProductionState';
import { useGemini } from './useGemini';
import { useNarration } from './useNarration';
import { useStories } from './useStories';
import { CrashlyticsService } from '../services/crashlytics';

export type ProductionPhase = 'idle' | 'generatingStory' | 'creatingCover' | 'narratingAudio' | 'savingStory' | 'completed' | 'error';

export interface ProductionState {
    phase: ProductionPhase;
    progress: number; // 0-100 placeholder
    error: string | null;
    storyId: string | null;
    requestId: string | null;
}

export interface ProductionParams {
    persona: Persona;
    durationSec: number;
    // Context
    convoHistory: Array<{ role: string; content: string }>;
    intakeSummary?: { title?: string; summary?: string };
    imageAnalysis?: string | null;
    selectedImageUrl?: string | null;
    remix?: {
        storyId: string;
        title?: string;
        summary?: string;
        generation?: StoryGeneration | null;
        contextText?: string | null;
    };
    // Options
    vertexTextModel?: string;
    vertexImageModel?: string;
    soundscapeId?: SoundscapeId;
    requestId?: string;
    // Callbacks
    onPhaseChange?: (phase: ProductionPhase) => void;
}

export function useStoryProduction() {
    const { generateAIBasedStory, generateStoryIllustration } = useGemini();
    const { narrateStory } = useNarration();
    const { saveStory, updateStoryCoverImage } = useStories();

    const {
        state,
        isCancelledRef,
        setPhase,
        markCompleted,
        markError,
        setRequestId,
        cancel,
        reset,
    } = useProductionState();

    const produceStory = useCallback(async (params: ProductionParams): Promise<string | null> => {
        isCancelledRef.current = false;
        const {
            persona,
            durationSec,
            convoHistory,
            intakeSummary,
            imageAnalysis,
            selectedImageUrl,
            remix,
            vertexTextModel,
            vertexImageModel,
            soundscapeId,
            requestId: preferredRequestId,
            onPhaseChange
        } = params;

        const updatePhase = (phase: ProductionPhase) => {
            CrashlyticsService.logBreadcrumb(`Production Phase: ${phase} (${flow.requestId})`);
            setPhase(phase, onPhaseChange);
        };

        const flow = createFlowLogger('Produce Story', {
            requestId: preferredRequestId,
            meta: {
                personaId: persona.id,
                durationSec,
                hasImage: Boolean(selectedImageUrl),
                hasAnalysis: Boolean(imageAnalysis),
            },
        });
        setRequestId(flow.requestId);

        try {
            flow.step('begin');
            const uid = auth.currentUser?.uid;
            if (uid) {
                await assertUnderDailyCreateCap(uid);
            }
            updatePhase('generatingStory');
            const flowStartMs = Date.now();
            const source = remix?.storyId ? 'remix' : 'create';
            void AnalyticsService.trackStoryGenerationStart(persona.id, durationSec, { source });

            // 1. Auth Token
            const idToken = await getFirebaseIdToken();

            // 2. Prepare History
            const history = convoHistory.slice(-50);
            if (intakeSummary?.summary || intakeSummary?.title) {
                const titleHint = intakeSummary?.title ? `Title idea: ${intakeSummary.title}` : '';
                const summaryHint = intakeSummary?.summary ? `Summary: ${intakeSummary.summary}` : '';
                const content = [titleHint, summaryHint].filter(Boolean).join('\n');
                if (content) {
                    history.push({ role: 'assistant', content: `Final intake summary:\n${content}` });
                }
            }

            const baseGeneration = remix?.generation || null;
            const baseIntakeSummary = baseGeneration?.intakeSummary || null;
            const baseContextTextRaw =
                typeof remix?.contextText === 'string' && remix.contextText.trim() ? remix.contextText.trim() : '';
            const baseContextText = normalizeOneLine(
                baseContextTextRaw
                    .replace(/\[\s*pause\s*\]/gi, ' ')
                    .replace(/\[PAUSE\]/g, ' ')
                    .replace(/<break[^>]*>/gi, ' ')
                    .replace(/["“”]/g, '')
            ).slice(0, 800).trim();
            const baseConvoExcerpt = Array.isArray(baseGeneration?.convoHistory)
                ? baseGeneration.convoHistory
                    .slice(-10)
                    .map((turn) => {
                        const role = typeof (turn as any)?.role === 'string' ? String((turn as any).role).trim() : '';
                        const content = typeof (turn as any)?.content === 'string' ? String((turn as any).content).trim() : '';
                        if (!content) return null;
                        return `${role ? role.toUpperCase() : 'USER'}: ${content}`;
                    })
                    .filter(Boolean)
                    .join('\n')
                : '';

            if (remix?.storyId) {
                const baseTitleLine = typeof remix.title === 'string' && remix.title.trim() ? `Base story title: ${remix.title.trim()}` : '';
                const baseSummaryLine = typeof remix.summary === 'string' && remix.summary.trim() ? `Base story summary: ${remix.summary.trim()}` : '';
                const baseIntakeTitleLine = baseIntakeSummary?.title ? `Base intake title hint: ${baseIntakeSummary.title}` : '';
                const baseIntakeSummaryLine = baseIntakeSummary?.summary ? `Base intake summary hint: ${baseIntakeSummary.summary}` : '';
                const baseContextLine = baseContextText ? `Base context text: ${baseContextText}` : '';
                const baseTranscriptLine = baseConvoExcerpt ? `Base convo excerpt:\n${baseConvoExcerpt}` : '';
                const baseLines = [
                    baseTitleLine,
                    baseSummaryLine,
                    baseIntakeTitleLine,
                    baseIntakeSummaryLine,
                    baseContextLine,
                    baseTranscriptLine,
                ].filter(Boolean).join('\n');
                history.push({
                    role: 'assistant',
                    content: baseLines
                        ? `Remix base context (previous story inputs):\n${baseLines}\n\nUse this base context along with the conversation above to create a remixed story.`
                        : 'Remix base context: Use the previous story as the foundation, and apply the conversation above to create a remixed story.',
                });
            }

            const effectiveVertexTextModel =
                typeof vertexTextModel === 'string' && vertexTextModel.trim() ? vertexTextModel.trim() : undefined;
            const effectiveVertexImageModel =
                typeof vertexImageModel === 'string' && vertexImageModel.trim() ? vertexImageModel.trim() : undefined;

            const combinedImageAnalysis = [
                typeof baseGeneration?.imageAnalysis === 'string' && baseGeneration.imageAnalysis.trim()
                    ? `Base image insights: ${baseGeneration.imageAnalysis.trim()}`
                    : null,
                typeof imageAnalysis === 'string' && imageAnalysis.trim()
                    ? `New image insights: ${imageAnalysis.trim()}`
                    : null,
            ].filter(Boolean).join('\n');

            const generation: StoryGeneration = {
                version: 1,
                source: remix?.storyId ? 'remix' : 'create',
                durationSec,
                convoHistory: history,
                intakeSummary: intakeSummary || null,
                imageAnalysis: combinedImageAnalysis || null,
                vertexTextModel: effectiveVertexTextModel || null,
                vertexImageModel: effectiveVertexImageModel || null,
            };

            // 3. Generate Text (Vertex AI)
            const generateStartMs = Date.now();
            const storyResult = await generateAIBasedStory({
                persona,
                durationSec,
                convoHistory: history,
                imageContext: combinedImageAnalysis || undefined,
                requestId: flow.requestId,
                vertexTextModel: effectiveVertexTextModel,
                idToken,
            });
            flow.step('generate:done', { ms: Date.now() - generateStartMs });

            // Normalize Title/Summary
            const resolvedTitle = normalizeOneLine(
                typeof intakeSummary?.title === 'string' && intakeSummary.title.trim()
                    ? intakeSummary.title
                    : typeof storyResult?.title === 'string' && storyResult.title.trim()
                        ? storyResult.title
                        : `${persona.name}'s Dream`
            ).slice(0, 80).trim();

            const resolvedSummary = normalizeOneLine(
                typeof intakeSummary?.summary === 'string' && intakeSummary.summary.trim()
                    ? intakeSummary.summary
                    : typeof (storyResult as any)?.summary === 'string' && String((storyResult as any).summary).trim()
                        ? String((storyResult as any).summary)
                        : `A calming, kid-friendly sleep journey with ${persona.name}.`
            ).slice(0, 240).trim();

            if (isCancelledRef.current) throw new Error('Cancelled');

            // 4. Create Cover Image (Async/Parallel start)
            updatePhase('creatingCover');
            const { coverImageUrl, coverPromise } = startCoverArtGeneration({
                selectedImageUrl,
                title: resolvedTitle,
                summary: resolvedSummary,
                persona,
                requestId: flow.requestId,
                vertexImageModel: effectiveVertexImageModel,
                idToken,
                generateStoryIllustration,
            });

            const narrativeText = typeof storyResult?.narrative === 'string' ? storyResult.narrative : '';
            if (!narrativeText.trim()) {
                throw new Error('Story generation succeeded but no narrative returned');
            }

            // 5. Narrate Audio (ElevenLabs)
            updatePhase('narratingAudio');
            flow.step('narrate:begin');
            const narrateStartMs = Date.now();
            const audioResult = await narrateStory({
                text: narrativeText,
                voiceId: persona.voiceId,
                personaId: persona.id,
                requestId: flow.requestId,
                idToken,
            });
            const audioUrl = audioResult.audioUrl;
            if (!audioUrl) throw new Error('Narration failed: No audio URL returned');
            flow.step('narrate:done', { ms: Date.now() - narrateStartMs });

            if (isCancelledRef.current) throw new Error('Cancelled');

            // 6. Save (Firestore)
            updatePhase('savingStory');
            const saveStartMs = Date.now();
            const storyId = await saveStory({
                personaId: persona.id,
                personaName: persona.name,
                title: resolvedTitle,
                summary: resolvedSummary,
                audioUrl,
                coverImageUrl, // Might be null here, patched later
                remixOfStoryId: remix?.storyId || undefined,
                soundscapeId,
                isFavorite: false,
                isPublic: false,
                duration: durationSec,
                generation,
            }, { requestId: flow.requestId });
            flow.step('save:done', { ms: Date.now() - saveStartMs, storyId });

            if (uid) {
                try {
                    await incrementDailyCreateCount(uid);
                } catch {
                    // ignore
                }
            }

            // 7. Patch Cover Image (if pending)
            patchCoverArtAfterSave({
                storyId,
                coverImageUrl,
                coverPromise,
                requestId: flow.requestId,
                updateStoryCoverImage,
            });

            // 8. Analytics
            void AnalyticsService.trackStoryGeneration(persona.id, durationSec, {
                storyId,
                source,
            });

            updatePhase('completed');
            markCompleted(storyId);

            flow.end({ totalMs: Date.now() - flowStartMs });
            return storyId;

        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message !== 'Cancelled') {
                CrashlyticsService.logError(
                    error instanceof Error ? error : new Error(String(error)),
                    `ProduceStory: ${params.persona.id} (${flow.requestId})`
                );
                console.error('[ProduceStory] failed', error);
                markError(message);
                flow.error('failed', { message });
            }
            return null;
        }
    }, [
        generateAIBasedStory,
        generateStoryIllustration,
        narrateStory,
        saveStory,
        updateStoryCoverImage,
        setPhase,
        markCompleted,
        markError,
    ]);

    const cancelProduction = useCallback(() => {
        cancel();
    }, [cancel]);

    const resetProduction = useCallback(() => {
        reset();
    }, [reset]);

    return {
        produceStory,
        cancelProduction,
        resetProduction,
        productionState: state,
    };
}
