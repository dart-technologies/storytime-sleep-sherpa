const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withLiveKitFix = (config) => {
    return withDangerousMod(config, [
        'ios',
        async (config) => {
            const podfilePath = path.join(config.modRequest.projectRoot, 'ios', 'Podfile');
            if (!fs.existsSync(podfilePath)) {
                return config;
            }
            let podfileContent = fs.readFileSync(podfilePath, 'utf8');

            // This code will be injected into the post_install block
            const marker = 'storytime: livekit/webrtc non-modular header fix';
            const fixCode = `
    installer.pods_project.targets.each do |target|
      # ${marker}
      target_name = target.name.to_s.downcase
      next unless target_name.include?('webrtc')

      target.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
        build_config.build_settings['CLANG_WARN_NON_MODULAR_INCLUDE_IN_FRAMEWORK_MODULE'] = 'NO'
      end
    end`;

            // Find the post_install block and inject our fix
            if (podfileContent.includes(marker)) {
                return config;
            }
            if (podfileContent.includes('post_install do |installer|')) {
                podfileContent = podfileContent.replace(
                    'post_install do |installer|',
                    'post_install do |installer|' + fixCode
                );
            } else {
                // If no post_install block, add one at the end
                podfileContent += `
post_install do |installer|
${fixCode}
end
`;
            }

            fs.writeFileSync(podfilePath, podfileContent);
            return config;
        },
    ]);
};

module.exports = withLiveKitFix;
