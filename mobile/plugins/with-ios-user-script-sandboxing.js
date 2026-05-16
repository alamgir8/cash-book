const { withXcodeProject } = require("@expo/config-plugins");

function withIosUserScriptSandboxing(config) {
  return withXcodeProject(config, (config) => {
    const buildConfigurations =
      config.modResults.pbxXCBuildConfigurationSection();

    for (const buildConfiguration of Object.values(buildConfigurations)) {
      if (!buildConfiguration || !buildConfiguration.buildSettings) {
        continue;
      }

      buildConfiguration.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = "NO";
    }

    return config;
  });
}

module.exports = withIosUserScriptSandboxing;
