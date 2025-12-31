const fs = require('fs');
const path = require('path');

const EAS_PROJECT_ID = '4dcff419-7b07-4af0-9283-719f2e4d49d0';

/**
 * EAS CLI DETECTION
 * We hide the path from EAS CLI locally to silence the "not checked in" warning.
 */
const IS_EAS_CLI =
    process.argv.some(arg => arg.includes('eas') || arg.includes('eas-cli')) ||
    process.argv.some(arg => ['config', 'bundle', 'export'].includes(arg)) ||
    (process.env._ && (process.env._.includes('eas') || process.env._.includes('eas-cli')));

function resolveExistingFilePath(targetPath) {
    if (!targetPath) return undefined;
    const resolved = path.isAbsolute(targetPath) ? targetPath : path.resolve(__dirname, targetPath);
    return fs.existsSync(resolved) ? resolved : undefined;
}

const getFile = (envVar, localPath) => {
    // 1. If we are running EAS CLI locally, return undefined to hide it from validation.
    // On the EAS build server we still need googleServicesFile paths for native config.
    if (IS_EAS_CLI && !process.env.EAS_BUILD) return undefined;

    // 2. On the EAS Build server, prefer file secrets (envVar), but fall back to repo files if present.
    if (process.env.EAS_BUILD && envVar) return resolveExistingFilePath(envVar);

    // 3. Fallback for local development (npx expo run:ios) and EAS builds without secrets.
    // Resolve any path to an absolute path, because Expo requires it for googleServicesFile.
    const targetPath = envVar || localPath;
    return resolveExistingFilePath(targetPath);
};

const withLiveKitFix = require('./plugins/withLiveKitFix');

function normalizeAppVariant(value) {
    const variant = String(value || '').trim().toLowerCase();
    if (!variant) return undefined;
    if (variant === 'production' || variant === 'preview' || variant === 'development') return variant;
    if (variant.startsWith('development')) return 'development';
    return undefined;
}

function assertExpectedOverride(name, actual, expected, appVariant) {
    const trimmed = String(actual || '').trim();
    if (!trimmed) return;
    if (trimmed !== expected) {
        throw new Error(
            `[APP_VARIANT=${appVariant}] ${name} is ${trimmed} but expected ${expected}. Check eas.json and EAS project env vars.`
        );
    }
}

function getGoogleIosUrlScheme(iosClientId) {
    const trimmed = (iosClientId || '').trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('com.googleusercontent.apps.')) return trimmed;
    const suffix = '.apps.googleusercontent.com';
    const clientIdBase = trimmed.endsWith(suffix) ? trimmed.slice(0, -suffix.length) : trimmed;
    return `com.googleusercontent.apps.${clientIdBase}`;
}

function normalizeSchemes(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean);
    return [String(value).trim()].filter(Boolean);
}

function appendUrlSchemes(infoPlist, schemes) {
    const types = Array.isArray(infoPlist.CFBundleURLTypes) ? [...infoPlist.CFBundleURLTypes] : [];
    const shouldAdd = schemes.map(s => String(s || '').trim()).filter(Boolean);
    if (!shouldAdd.length) return infoPlist;

    const hasScheme = (scheme) =>
        types.some((t) => Array.isArray(t?.CFBundleURLSchemes) && t.CFBundleURLSchemes.includes(scheme));

    shouldAdd.forEach((scheme) => {
        if (hasScheme(scheme)) return;
        if (!types.length) {
            types.push({ CFBundleURLSchemes: [scheme] });
            return;
        }
        const first = { ...(types[0] || {}) };
        const existing = Array.isArray(first.CFBundleURLSchemes) ? first.CFBundleURLSchemes : [];
        first.CFBundleURLSchemes = [...existing, scheme];
        types[0] = first;
    });

    return { ...infoPlist, CFBundleURLTypes: types };
}

function readFileText(absolutePath) {
    try {
        return fs.readFileSync(absolutePath, 'utf8');
    } catch {
        return '';
    }
}

function extractPlistStringValue(plistText, key) {
    const safeKey = String(key || '').replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    if (!safeKey) return undefined;
    const pattern = new RegExp(`<key>${safeKey}<\\/key>\\s*<string>([^<]+)<\\/string>`, 'i');
    const match = plistText.match(pattern);
    return match ? String(match[1] || '').trim() : undefined;
}

function validateGoogleServiceInfoPlist(absolutePath, expectedBundleIdentifier, label) {
    if (!absolutePath) {
        throw new Error(
            `[${label}] Missing iOS GoogleService-Info.plist. Set an EAS file secret GOOGLE_SERVICES_INFO_PLIST pointing to the correct Firebase iOS config for bundle ${expectedBundleIdentifier}.`
        );
    }

    const plistText = readFileText(absolutePath);
    const googleAppId = extractPlistStringValue(plistText, 'GOOGLE_APP_ID');
    if (!googleAppId) {
        throw new Error(
            `[${label}] GoogleService-Info.plist is missing GOOGLE_APP_ID. Re-download the full GoogleService-Info.plist from Firebase and re-upload it as the GOOGLE_SERVICES_INFO_PLIST file secret.`
        );
    }

    const bundleId = extractPlistStringValue(plistText, 'BUNDLE_ID');
    if (bundleId && expectedBundleIdentifier && bundleId !== expectedBundleIdentifier) {
        throw new Error(
            `[${label}] GoogleService-Info.plist BUNDLE_ID (${bundleId}) does not match expected bundle identifier (${expectedBundleIdentifier}).`
        );
    }
}

module.exports = ({ config }) => {
    const appVariant =
        normalizeAppVariant(process.env.APP_VARIANT) ||
        normalizeAppVariant(process.env.EAS_BUILD_PROFILE) ||
        'development';
    const defaultBundleIdentifier =
        appVariant === 'production'
            ? 'art.dart.storytime'
            : appVariant === 'preview'
                ? 'art.dart.storytime.preview'
                : 'art.dart.storytime.dev';
    const defaultAndroidPackage =
        appVariant === 'production'
            ? 'art.dart.storytime'
            : appVariant === 'preview'
                ? 'art.dart.storytime.preview'
                : 'art.dart.storytime.dev';

    const iosFile = getFile(
        process.env.GOOGLE_SERVICES_INFO_PLIST,
        appVariant === 'production'
            ? './GoogleService-Info.plist'
            : appVariant === 'preview'
                ? './GoogleService-Info.preview.plist'
                : './GoogleService-Info.dev.plist'
    );

    const androidFile = getFile(
        process.env.GOOGLE_SERVICES_JSON,
        appVariant === 'production'
            ? './google-services.json'
            : appVariant === 'preview'
                ? './google-services-preview.json'
                : './google-services-dev.json'
    );

    const bundleIdentifier = process.env.EXPO_BUNDLE_IDENTIFIER || defaultBundleIdentifier;
    const androidPackage = process.env.EXPO_ANDROID_PACKAGE || defaultAndroidPackage;
    const easBuildPlatform = String(process.env.EAS_BUILD_PLATFORM || '').trim().toLowerCase();

    if (process.env.EAS_BUILD) {
        assertExpectedOverride('EXPO_BUNDLE_IDENTIFIER', process.env.EXPO_BUNDLE_IDENTIFIER, defaultBundleIdentifier, appVariant);
        assertExpectedOverride('EXPO_ANDROID_PACKAGE', process.env.EXPO_ANDROID_PACKAGE, defaultAndroidPackage, appVariant);
    }

    if (process.env.EAS_BUILD && (!easBuildPlatform || easBuildPlatform === 'ios')) {
        validateGoogleServiceInfoPlist(iosFile, bundleIdentifier, `APP_VARIANT=${appVariant}`);
    }

    const googleIosUrlScheme = getGoogleIosUrlScheme(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);
    const schemeList = normalizeSchemes(config.scheme || 'storytime');
    const baseInfoPlist = { ...(config.ios?.infoPlist || {}) };

    return {
        ...config,
        "name": "Storytime",
        "slug": "storytime",
        "owner": "dart-technologies",
        "scheme": "storytime",
        "version": "1.1.0",
        "orientation": "portrait",
        "icon": "./assets/images/icon.png",
        "userInterfaceStyle": "automatic",
        "newArchEnabled": true,
        "ios": {
            "supportsTablet": true,
            "usesAppleSignIn": true,
            "bundleIdentifier": bundleIdentifier,
            ...(iosFile ? { "googleServicesFile": iosFile } : {}),
            "infoPlist": appendUrlSchemes({
                ...baseInfoPlist,
                "UIBackgroundModes": ["audio"],
                "ITSAppUsesNonExemptEncryption": false,
                "NSMicrophoneUsageDescription": "Storytime needs access to your microphone to let you talk to the sleep sherpa.",
                "NSPhotoLibraryUsageDescription": "Storytime needs access to your photos so you can pick an inspiration image for your sleep story.",
            }, [...schemeList, googleIosUrlScheme]),
        },
        "android": {
            "adaptiveIcon": {
                "foregroundImage": "./assets/images/icon.png",
                "backgroundColor": "#ffffff"
            },
            "package": androidPackage,
            ...(androidFile ? { "googleServicesFile": androidFile } : {})
        },
        "web": {
            "favicon": "./assets/images/icon.png",
            "output": "static"
        },
        "plugins": [
            withLiveKitFix,
            "@livekit/react-native-expo-plugin",
            "@config-plugins/react-native-webrtc",
            "expo-apple-authentication",
            "expo-router",
            "expo-font",
            "expo-audio",
            "expo-asset",
            "expo-image-picker",
            "@react-native-firebase/app",
            "@react-native-firebase/crashlytics",
            "@react-native-google-signin/google-signin",
            [
                "expo-build-properties",
                {
                    "ios": {
                        "useFrameworks": "static",
                        "buildReactNativeFromSource": true
                    }
                }
            ]
        ],
        "experiments": {
            "typedRoutes": true
        },
        "updates": {
            "url": `https://u.expo.dev/${EAS_PROJECT_ID}`
        },
        "runtimeVersion": {
            "policy": "appVersion"
        },
        "extra": {
            "eas": {
                "projectId": EAS_PROJECT_ID
            }
        }
    };
};
