import { collection, deleteDoc, doc, setDoc } from '@react-native-firebase/firestore';
import { useCallback } from 'react';
import type { Story } from '../../lib/models/story';
import { firestore as db } from '../../lib/firebase';
import { createFlowLogger, createRequestId, isVerboseDebugLoggingEnabled } from '../../lib/debugLogger';
import { getFirestoreWriteTimeoutMs } from '../../lib/env';
import { settleWithTimeout } from '../../lib/promiseUtils';
import { useOptionalError } from '../../components/ErrorProvider';
import { useAuth } from '../useAuth';
import { dreamsStore } from '../useStore';
import { omitUndefined, sanitizeFirestoreValue, sanitizeForTinyBaseRow } from './storyRowUtils';
import { CrashlyticsService } from '../../services/crashlytics';

function safeDeleteLocalStory(localId: string) {
    if (typeof (dreamsStore as any)?.delRow === 'function') {
        (dreamsStore as any).delRow('myStories', localId);
    }
}

function getFirstName(displayName: string | null | undefined): string {
    const trimmed = String(displayName || '').trim();
    if (!trimmed) return 'Friend';
    return trimmed.split(/\s+/)[0] || 'Friend';
}

export function useStoryCRUD() {
    const { user } = useAuth();
    const errorContext = useOptionalError();

    const saveStory = useCallback(async (
        storyData: Omit<Story, 'id' | 'userId' | 'createdAt'>,
        options?: { requestId?: string; timeoutMs?: number; optimistic?: boolean }
    ) => {
        if (!user) throw new Error('User must be authenticated to save a story');

        const defaultTimeoutMs = getFirestoreWriteTimeoutMs();

        const requestId = options?.requestId || createRequestId('save_story');
        const flow = createFlowLogger('Save Story', {
            requestId,
            meta: {
                personaId: storyData?.personaId,
                isPublic: Boolean(storyData?.isPublic),
                summaryLength: typeof storyData?.summary === 'string' ? storyData.summary.length : 0,
                narrativeLength: typeof storyData?.narrative === 'string' ? storyData.narrative.length : 0,
                hasCoverImageUrl: Boolean(storyData?.coverImageUrl),
                firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || null,
                timeoutMs: typeof options?.timeoutMs === 'number' ? options.timeoutMs : defaultTimeoutMs,
            },
        });
        let endMeta: Record<string, unknown> | undefined = undefined;

        const newStory = sanitizeFirestoreValue(omitUndefined({
            ...storyData,
            userId: user.uid,
            userName: user.displayName || 'Friend',
            userFirstName: getFirstName(user.displayName),
            userPhotoUrl: user.photoURL || undefined,
            playCount: 0,
            remixCount: 0,
            favoritedCount: 0,
            isFeatured: false,
            createdAt: Date.now(),
        })) as Record<string, any>;

        const storiesRef = collection(db, 'stories');
        const docRef = doc(storiesRef);
        const docId = docRef.id;

        try {
            flow.step('optimistic:insert', { docId });
            dreamsStore.setRow('myStories', docId, sanitizeForTinyBaseRow({ ...newStory, id: docId }));

            flow.step('firestore:setDoc:begin');
            const writePromise = setDoc(docRef, newStory);
            const timeoutMs = typeof options?.timeoutMs === 'number' ? options.timeoutMs : defaultTimeoutMs;
            const settled = await settleWithTimeout(writePromise, timeoutMs);

            if (settled.status === 'fulfilled') {
                flow.step('firestore:setDoc:done', { docId });
                endMeta = { status: 'saved', docId };
                return docId;
            }

            if (settled.status === 'timeout') {
                flow.warn('firestore:setDoc:timeout', { timeoutMs, docId });
                errorContext?.showToast({
                    type: 'info',
                    message: 'Saving story is taking longer than expected (syncing in background).',
                });
                endMeta = { status: 'pending', docId };

                writePromise
                    .then(() => {
                        if (isVerboseDebugLoggingEnabled()) {
                            // eslint-disable-next-line no-console
                            console.log('[Save Story] background write resolved', { requestId, docId });
                        }
                    })
                    .catch((error) => {
                        safeDeleteLocalStory(docId);
                        errorContext?.showToast({
                            type: 'error',
                            message: 'Story failed to save to the cloud. Please try again.',
                        });
                        console.error('[Save Story] background write failed', {
                            requestId,
                            docId,
                            message: error instanceof Error ? error.message : String(error),
                            code: typeof (error as any)?.code === 'string' ? (error as any).code : undefined,
                            name: error instanceof Error ? error.name : undefined,
                        });
                    });

                return docId;
            }

            safeDeleteLocalStory(docId);
            throw settled.reason;
        } catch (error) {
            console.error('Error saving story:', error);
            CrashlyticsService.logError(error instanceof Error ? error : new Error(String(error)), `SaveStory: ${requestId}`);
            flow.error('error', error instanceof Error ? { message: error.message, name: error.name } : String(error));
            errorContext?.showToast({ message: 'Story failed to save. Please try again.', type: 'error' });
            endMeta = { status: 'error' };
            throw error;
        } finally {
            flow.end(endMeta);
        }
    }, [errorContext, user]);

    const updateStoryCoverImage = useCallback(async (
        storyId: string,
        coverImageUrl: string,
        options?: { requestId?: string }
    ) => {
        if (!user) throw new Error('User must be authenticated to update a story');

        const requestId = options?.requestId || createRequestId('update_cover');
        const flow = createFlowLogger('Update Cover', {
            requestId,
            meta: {
                storyId,
                coverImageUrlLength: typeof coverImageUrl === 'string' ? coverImageUrl.length : 0,
            },
        });

        try {
            const isMine = dreamsStore.hasRow('myStories', storyId);
            if (isMine) {
                const row = dreamsStore.getRow('myStories', storyId);
                dreamsStore.setRow('myStories', storyId, sanitizeForTinyBaseRow({ ...row, coverImageUrl }));
                flow.step('local:update');
            } else {
                flow.warn('local:missing');
            }

            const storiesRef = collection(db, 'stories');
            const docRef = doc(storiesRef, storyId);
            flow.step('firestore:setDoc:begin');
            await setDoc(docRef, sanitizeFirestoreValue({ coverImageUrl }) as any, { merge: true });
            flow.step('firestore:setDoc:done');
        } catch (error) {
            CrashlyticsService.logError(error instanceof Error ? error : new Error(String(error)), `UpdateStoryCover: ${storyId}`);
            flow.error('error', error instanceof Error ? { message: error.message } : String(error));
            throw error;
        } finally {
            flow.end();
        }
    }, [user]);

    const toggleFavorite = useCallback(async (storyId: string, currentStatus: boolean) => {
        if (!user) {
            errorContext?.showToast({ type: 'info', message: 'Sign in to favorite stories.' });
            return;
        }

        const next = !currentStatus;
        const requestId = createRequestId('favorite');
        const flow = createFlowLogger('Favorite Story', {
            requestId,
            meta: { storyId, next },
        });

        try {
            if (next) {
                dreamsStore.setRow('favorites', storyId, sanitizeForTinyBaseRow({ id: storyId, likedAt: Date.now() }));
            } else if (typeof (dreamsStore as any)?.delRow === 'function') {
                (dreamsStore as any).delRow('favorites', storyId);
            }

            const docRef = doc(collection(db, 'users', user.uid, 'favorites'), storyId);
            if (next) {
                await setDoc(docRef, sanitizeFirestoreValue({ likedAt: Date.now() }) as any, { merge: true });
            } else {
                await deleteDoc(docRef);
            }

            flow.step('done');
        } catch (error) {
            if (next) {
                try {
                    (dreamsStore as any).delRow('favorites', storyId);
                } catch {
                    // ignore
                }
            } else {
                try {
                    dreamsStore.setRow('favorites', storyId, sanitizeForTinyBaseRow({ id: storyId, likedAt: Date.now() }));
                } catch {
                    // ignore
                }
            }
            CrashlyticsService.logError(error instanceof Error ? error : new Error(String(error)), `ToggleFavorite: ${storyId}`);
            flow.error('error', error instanceof Error ? { message: error.message } : String(error));
            const message = error instanceof Error ? error.message : String(error);
            const code = typeof (error as any)?.code === 'string' ? (error as any).code : undefined;
            const isPermissionDenied = code === 'firestore/permission-denied' || message.includes('permission-denied');
            errorContext?.showToast({
                type: 'error',
                message: isPermissionDenied
                    ? 'Favorites are not enabled yet (permission denied). Deploy updated Firestore rules and try again.'
                    : 'Could not update favorite. Please try again.',
            });
        } finally {
            flow.end();
        }
    }, [errorContext, user]);

    const setStoryPublic = useCallback(async (storyId: string, nextPublic: boolean) => {
        if (!user) throw new Error('User must be authenticated to update a story');

        const requestId = createRequestId('story_public');
        const flow = createFlowLogger('Set Story Public', {
            requestId,
            meta: { storyId, nextPublic },
        });

        const isMine = dreamsStore.hasRow('myStories', storyId);
        if (!isMine) {
            flow.warn('blocked:not-my-story');
            flow.end();
            return;
        }

        const previousRow = dreamsStore.getRow('myStories', storyId);
        dreamsStore.setRow(
            'myStories',
            storyId,
            sanitizeForTinyBaseRow({
                ...(previousRow || {}),
                id: storyId,
                isPublic: nextPublic,
                ...(nextPublic ? {} : { isFeatured: false }),
            })
        );

        try {
            const storiesRef = collection(db, 'stories');
            const docRef = doc(storiesRef, storyId);
            await setDoc(
                docRef,
                sanitizeFirestoreValue({
                    isPublic: nextPublic,
                    ...(nextPublic ? {} : { isFeatured: false }),
                }) as any,
                { merge: true }
            );
            flow.step('done');
        } catch (error) {
            if (previousRow) {
                dreamsStore.setRow('myStories', storyId, previousRow);
            }
            CrashlyticsService.logError(error instanceof Error ? error : new Error(String(error)), `SetStoryPublic: ${storyId}`);
            flow.error('error', error instanceof Error ? { message: error.message } : String(error));
            errorContext?.showToast({
                type: 'error',
                message: 'Could not update story visibility. Please try again.',
            });
            throw error;
        } finally {
            flow.end();
        }
    }, [errorContext, user]);

    const deleteStory = useCallback(async (storyId: string) => {
        if (!user) throw new Error('User must be authenticated to delete a story');

        const requestId = createRequestId('delete_story');
        const flow = createFlowLogger('Delete Story', {
            requestId,
            meta: { storyId },
        });

        const isMine = dreamsStore.hasRow('myStories', storyId);
        if (!isMine) {
            flow.warn('blocked:not-my-story');
            flow.end();
            return;
        }

        const previousRow = dreamsStore.getRow('myStories', storyId);
        dreamsStore.delRow('myStories', storyId);

        try {
            const storiesRef = collection(db, 'stories');
            const docRef = doc(storiesRef, storyId);
            flow.step('firestore:deleteDoc:begin');
            await deleteDoc(docRef);
            flow.step('firestore:deleteDoc:done');
        } catch (error) {
            if (previousRow) {
                dreamsStore.setRow('myStories', storyId, previousRow);
            }
            CrashlyticsService.logError(error instanceof Error ? error : new Error(String(error)), `DeleteStory: ${storyId}`);
            flow.error('error', error instanceof Error ? { message: error.message } : String(error));
            throw error;
        } finally {
            flow.end();
        }
    }, [user]);

    return {
        saveStory,
        updateStoryCoverImage,
        deleteStory,
        toggleFavorite,
        setStoryPublic,
    };
}
