const { withPodfile } = require('expo/config-plugins');

const MARKER = '# Stop FRA iOS deployment target compatibility';
const MINIMUM_IOS = '15.1';

module.exports = function withIosPodDeploymentTargets(config) {
  return withPodfile(config, (config) => {
    const contents = config.modResults.contents;

    if (contents.includes(MARKER)) {
      return config;
    }

    const anchor = /(^[ \t]*)react_native_post_install\([\s\S]*?^[ \t]*\)/m;
    const match = contents.match(anchor);

    if (!match) {
      throw new Error(
        'Cannot find react_native_post_install in Podfile; refusing to modify it.'
      );
    }

    const indentation = match[1];

    const addition = [
      '',
      indentation + MARKER,
      indentation + 'installer.pods_project.targets.each do |target|',
      indentation + '  target.build_configurations.each do |build_config|',
      indentation + "    current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']",
      indentation + "    if current && Gem::Version.new(current) < Gem::Version.new('" + MINIMUM_IOS + "')",
      indentation + "      build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '" + MINIMUM_IOS + "'",
      indentation + '    end',
      indentation + '  end',
      indentation + 'end',
      ''
    ].join('\n');

    const position = match.index + match[0].length;

    config.modResults.contents =
      contents.slice(0, position) +
      addition +
      contents.slice(position);

    return config;
  });
};
