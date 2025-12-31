import { PersonaId } from './personas';

/**
 * Interface for the asset mapping structure
 */
interface PersonaAssets {
    avatar: any;
    masks: {
        welcome: any;
        hook: any;
        mask: any;
    };
}

/**
 * Central registry of all persona assets.
 * We use require() here because Expo/React Native static assets must be known at bundle time.
 */
export const ASSET_MAP: Record<PersonaId, PersonaAssets> = {
    luna: {
        avatar: require('../public/avatars/luna.png'),
        masks: {
            welcome: require('../assets/audio/luna_welcome.mp3'),
            hook: require('../assets/audio/luna_hook.mp3'),
            mask: require('../assets/audio/luna_mask.mp3'),
        },
    },
    kai: {
        avatar: require('../public/avatars/kai.png'),
        masks: {
            welcome: require('../assets/audio/kai_welcome.mp3'),
            hook: require('../assets/audio/kai_hook.mp3'),
            mask: require('../assets/audio/kai_mask.mp3'),
        },
    },
    river: {
        avatar: require('../public/avatars/river.png'),
        masks: {
            welcome: require('../assets/audio/river_welcome.mp3'),
            hook: require('../assets/audio/river_hook.mp3'),
            mask: require('../assets/audio/river_mask.mp3'),
        },
    },
    echo: {
        avatar: require('../public/avatars/echo.png'),
        masks: {
            welcome: require('../assets/audio/echo_welcome.mp3'),
            hook: require('../assets/audio/echo_hook.mp3'),
            mask: require('../assets/audio/echo_mask.mp3'),
        },
    },
    sage: {
        avatar: require('../public/avatars/sage.png'),
        masks: {
            welcome: require('../assets/audio/sage_welcome.mp3'),
            hook: require('../assets/audio/sage_hook.mp3'),
            mask: require('../assets/audio/sage_mask.mp3'),
        },
    },
};

export type SoundscapeId =
    | 'lapping-waves'
    | 'gentle-raindrops'
    | 'flowing-stream'
    | 'falling-snow'
    | 'crackling-fireplace';

type SoundscapeOption = {
    id: SoundscapeId;
    label: string;
    emoji: string;
    asset: any;
};

export const SOUNDSCAPE_ASSETS: Record<SoundscapeId, any> = {
    'lapping-waves': require('../assets/audio/soundscapes/lapping-waves.mp3'),
    'gentle-raindrops': require('../assets/audio/soundscapes/gentle-raindrops.mp3'),
    'flowing-stream': require('../assets/audio/soundscapes/flowing-stream.mp3'),
    'falling-snow': require('../assets/audio/soundscapes/falling-snow.mp3'),
    'crackling-fireplace': require('../assets/audio/soundscapes/crackling-fireplace.mp3'),
};

export const SOUNDSCAPE_OPTIONS: SoundscapeOption[] = [
    { id: 'lapping-waves', emoji: '🌊', label: 'Lapping Waves', asset: SOUNDSCAPE_ASSETS['lapping-waves'] },
    { id: 'gentle-raindrops', emoji: '💦', label: 'Gentle Raindrops', asset: SOUNDSCAPE_ASSETS['gentle-raindrops'] },
    { id: 'flowing-stream', emoji: '🏞️', label: 'Flowing Stream', asset: SOUNDSCAPE_ASSETS['flowing-stream'] },
    { id: 'falling-snow', emoji: '❄️', label: 'Falling Snow', asset: SOUNDSCAPE_ASSETS['falling-snow'] },
    { id: 'crackling-fireplace', emoji: '🔥', label: 'Crackling Fireplace', asset: SOUNDSCAPE_ASSETS['crackling-fireplace'] },
];

export const DEFAULT_SOUNDSCAPE_BY_PERSONA: Record<PersonaId, SoundscapeId> = {
    kai: 'lapping-waves',
    echo: 'gentle-raindrops',
    river: 'flowing-stream',
    luna: 'falling-snow',
    sage: 'crackling-fireplace',
};

export function getSoundscapeAsset(id: SoundscapeId): any {
    return SOUNDSCAPE_ASSETS[id];
}

export function getDefaultSoundscapeId(personaId: PersonaId): SoundscapeId {
    return DEFAULT_SOUNDSCAPE_BY_PERSONA[personaId];
}

export function getDefaultSoundscapeAsset(personaId: PersonaId): any {
    return getSoundscapeAsset(getDefaultSoundscapeId(personaId));
}

/**
 * Resolves the avatar image for a given persona.
 */
export function getPersonaAvatar(personaId: PersonaId): any {
    return ASSET_MAP[personaId]?.avatar;
}

/**
 * Resolves a specific latency mask audio asset for a given persona.
 */
export function getPersonaMask(personaId: PersonaId, type: 'welcome' | 'hook' | 'mask'): any {
    return ASSET_MAP[personaId]?.masks[type];
}

/**
 * Returns all required assets for pre-loading.
 */
export function getAllPersonaAssets(): any[] {
    const assets: any[] = [];
    Object.values(ASSET_MAP).forEach((mapping) => {
        assets.push(mapping.avatar);
        assets.push(mapping.masks.welcome);
        assets.push(mapping.masks.hook);
        assets.push(mapping.masks.mask);
    });
    return assets;
}
