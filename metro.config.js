// Metro configuration for Expo SDK 54.
// This repo relies on @livekit/react-native-webrtc, which currently imports
// `event-target-shim/index` even though that subpath is not exported.
// Redirect the import to the package root to avoid noisy Metro "exports" warnings.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'event-target-shim/index') {
        return context.resolveRequest(context, 'event-target-shim', platform);
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
