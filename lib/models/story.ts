import type { SoundscapeId } from '../assetMapper';

export type StoryConvoTurn = {
    role: string;
    content: string;
};

export type StoryIntakeSummary = {
    title?: string;
    summary?: string;
};

export type StoryGenerationSource = 'create' | 'remix';

export interface StoryGenerationV1 {
    version: 1;
    source: StoryGenerationSource;
    durationSec: number;
    convoHistory: StoryConvoTurn[];
    intakeSummary?: StoryIntakeSummary | null;
    imageAnalysis?: string | null;
    vertexTextModel?: string | null;
    vertexImageModel?: string | null;
}

export type StoryGeneration = StoryGenerationV1;

export interface Story {
    id: string;
    userId: string;
    userName?: string;
    userFirstName?: string;
    userPhotoUrl?: string;
    personaId: string;
    personaName: string;
    title: string;
    summary: string;
    narrative?: string;
    audioUrl?: string; // Optional: path to audio in Cloud Storage
    coverImageUrl?: string;
    generation?: StoryGeneration;
    remixOfStoryId?: string;
    soundscapeId?: SoundscapeId;
    isFavorite?: boolean;
    isPublic: boolean;
    isFeatured?: boolean;
    createdAt: number;
    tags?: string[];
    playCount?: number;
    favoritedCount?: number;
    remixCount?: number;
    duration?: number;
    genre?: string;
}

export type StoryUpdate = Partial<Omit<Story, 'id' | 'userId' | 'createdAt'>>;
