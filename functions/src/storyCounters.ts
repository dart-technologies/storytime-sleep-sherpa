import * as admin from 'firebase-admin';

export type StoryCounterField = 'playCount' | 'remixCount' | 'favoritedCount';

export type StoryCounterPatch = {
    playCount?: number;
    remixCount?: number;
    favoritedCount?: number;
};

export function buildStoryCounterPatch(data: Record<string, unknown>): StoryCounterPatch {
    const patch: StoryCounterPatch = {};
    if (typeof (data as any)?.playCount !== 'number') patch.playCount = 0;
    if (typeof (data as any)?.remixCount !== 'number') patch.remixCount = 0;
    if (typeof (data as any)?.favoritedCount !== 'number') patch.favoritedCount = 0;
    return patch;
}

export async function patchStoryCounters(
    ref: { update: (data: Record<string, unknown>) => Promise<unknown> },
    data: Record<string, unknown>,
): Promise<void> {
    const patch = buildStoryCounterPatch(data);
    if (!Object.keys(patch).length) return;
    await ref.update(patch);
}

export async function incrementStoryCounter(storyId: string, field: StoryCounterField, delta: number): Promise<void> {
    const update: Record<string, unknown> = {};
    (update as any)[field] = admin.firestore.FieldValue.increment(delta);
    await admin.firestore().collection('stories').doc(storyId).update(update);
}

