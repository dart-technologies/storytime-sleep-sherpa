export interface SeasonalSpecial {
    id: string;
    title: string;
    description: string;
    personaId: string;
    theme: string;
    image: string;
}

export const SEASONAL_SPECIALS: SeasonalSpecial[] = [
    {
        id: 'winter_1',
        title: 'The First Snowfall',
        description: 'A gentle journey through a forest as the first flakes begin to fall.',
        personaId: 'luna',
        theme: 'Snowy Forest',
        image: 'https://images.unsplash.com/photo-1500413702358-48b1daad8ddc?auto=format&fit=crop&q=80&w=300',
    },
    {
        id: 'winter_2',
        title: 'Cabin in the Pines',
        description: 'Cozy up by the fire as the wind whispers through the pine needles.',
        personaId: 'kai',
        theme: 'Cozy Cabin',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=300',
    },
    {
        id: 'winter_3',
        title: 'The Polar Express Path',
        description: 'A slow train ride across the frozen tundra under the northern lights.',
        personaId: 'river',
        theme: 'Arctic Train',
        image: 'https://images.unsplash.com/photo-1584265884013-a33050accc3b?auto=format&fit=crop&q=80&w=300',
    },
];

