import type { Persona } from '../../lib/personas';
import { createFlowLogger } from '../../lib/debugLogger';

type CoverArtParams = {
    selectedImageUrl?: string | null;
    title: string;
    summary: string;
    persona: Persona;
    requestId?: string;
    vertexImageModel?: string;
    idToken: string;
    generateStoryIllustration: (params: {
        title: string;
        summary: string;
        persona: Persona;
        requestId?: string;
        vertexImageModel?: string;
        idToken: string;
    }) => Promise<string>;
};

export function startCoverArtGeneration(params: CoverArtParams): {
    coverImageUrl: string | undefined;
    coverPromise: Promise<string | undefined> | null;
} {
    const { selectedImageUrl, title, summary, persona, requestId, vertexImageModel, idToken, generateStoryIllustration } = params;
    let coverImageUrl: string | undefined = selectedImageUrl || undefined;
    let coverPromise: Promise<string | undefined> | null = null;

    if (!coverImageUrl) {
        const coverFlow = createFlowLogger('Cover Background', {
            requestId,
            meta: { personaId: persona.id },
        });
        coverPromise = generateStoryIllustration({
            title,
            summary,
            persona,
            requestId,
            vertexImageModel,
            idToken,
        })
            .then((url) => {
                coverFlow.step('done', { hasUrl: Boolean(url) });
                return url;
            })
            .catch((err) => {
                coverFlow.warn('failed', { message: String(err) });
                return undefined;
            })
            .finally(() => coverFlow.end());
    }

    return { coverImageUrl, coverPromise };
}

export function patchCoverArtAfterSave(params: {
    storyId: string;
    coverImageUrl: string | undefined;
    coverPromise: Promise<string | undefined> | null;
    requestId?: string;
    updateStoryCoverImage: (storyId: string, coverImageUrl: string, options?: { requestId?: string }) => Promise<void>;
}) {
    const { storyId, coverImageUrl, coverPromise, requestId, updateStoryCoverImage } = params;
    if (coverImageUrl) return;
    if (!coverPromise) return;

    void (async () => {
        try {
            const generatedCover = await coverPromise;
            if (generatedCover) {
                await updateStoryCoverImage(storyId, generatedCover, { requestId });
            }
        } catch {
            // ignore post-save patch failures
        }
    })();
}

