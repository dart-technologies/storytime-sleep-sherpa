export const Colors = {
    background: '#050505',
    backgroundAccent: '#1A1A2E',
    surface: '#121212',
    primary: '#BB86FC',
    secondary: '#03DAC6',
    error: '#CF6679',
    warning: '#FFB74D',
    success: '#81C784',
    text: '#E0E0E0',
    textMuted: '#9E9E9E',
    glassUltraSubtle: 'rgba(255, 255, 255, 0.02)',
    glassSubtle: 'rgba(255, 255, 255, 0.06)',
    glass: 'rgba(255, 255, 255, 0.08)',
    glassStrong: 'rgba(255, 255, 255, 0.10)',
    glassBorder: 'rgba(255, 255, 255, 0.12)',
    glassBorderStrong: 'rgba(255, 255, 255, 0.15)',
    scrim: 'rgba(0, 0, 0, 0.6)',
    atmosphereOverlay: 'rgba(0, 0, 0, 0.3)',
    primarySoft: 'rgba(187, 134, 252, 0.15)',
    primaryWash: 'rgba(187, 134, 252, 0.2)',
    errorWash: 'rgba(255, 55, 95, 0.12)',
    warningWash: 'rgba(255, 183, 77, 0.12)',
    successWash: 'rgba(129, 199, 132, 0.12)',
    errorBanner: 'rgba(50, 10, 10, 0.8)',
    errorScrim: 'rgba(50, 10, 10, 0.9)',
    errorBorderSoft: 'rgba(255, 100, 100, 0.3)',
    atmosphereLuna: '#1A1A3A',
    atmosphereKai: '#0A3A3A',
    atmosphereRiver: '#3A1A3A',
    breathingLuna: 'rgba(26, 26, 58, 0.4)',
    breathingKai: 'rgba(5, 58, 58, 0.4)',
    white: '#FFFFFF',
    black: '#000000',
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

export const Blur = {
    subtle: 10,
    soft: 20,
    medium: 30,
    controls: 40,
    strong: 60,
    tabBar: 80,
};

export const Motion = {
    duration: {
        fast: 150,
        medium: 300,
        slow: 500,
        toast: 500,
        toastHold: 3000,
        skeletonPulse: 1000,
        coverMove: 450,
        coverFade: 150,
    },
    delay: {
        stagger: 200,
        coverFadeOut: 325,
    },
    spring: {
        gentle: { damping: 15, stiffness: 150 },
        pop: { damping: 10, stiffness: 100 },
    },
    imageTransition: {
        fast: 250,
        slow: 500,
    },
};

export const Gradients = {
    authBackground: [Colors.background, Colors.backgroundAccent, Colors.background] as const,
    personaCardSelected: ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)'] as const,
    personaCardDefault: ['rgba(255, 255, 255, 0.08)', 'rgba(0, 0, 0, 0)'] as const,
};

export const Typography = {
    sizes: {
        xs: 10,
        sm: 12,
        md: 14,
        base: 16,
        lg: 18,
        xl: 20,
        xxl: 24,
        display: 34,
        displayLg: 48,
        displayXl: 64,
    },
    weights: {
        primary: '500',
        secondary: '300',
        regular: '400',
        semibold: '600',
        bold: '700',
        extraBold: '800',
        black: '900',
    },
} as const;

export const Theme = {
    colors: Colors,
    spacing: Spacing,
    blur: Blur,
    motion: Motion,
    gradients: Gradients,
    typography: Typography,
    glass: {
        backgroundColor: Colors.glass,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: Colors.glassBorder,
        backdropFilter: 'blur(16px)', // Note: This is a hint for web; RN uses BlurView
    },
    shadow: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.44,
        shadowRadius: 10.32,
        elevation: 16,
    }
};
