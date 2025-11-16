import {
    getWhitelist,
    updateWhitelist,
    getAppConfig,
    updateAppConfig,
    getPrivacyConfig,
    updatePrivacyConfig,
} from '../utils/config-manager.js';

async function getSettings() {
    return {
        whitelist: getWhitelist(),
        appConfig: getAppConfig(),
        privacyConfig: getPrivacyConfig(),
    };
}

async function updateSettings(settings) {
    if (settings.whitelist) {
        updateWhitelist(settings.whitelist);
    }
    if (settings.appConfig) {
        updateAppConfig(settings.appConfig);
    }
    if (settings.privacyConfig) {
        updatePrivacyConfig(settings.privacyConfig);
    }
    return { success: true };
}

export {
    getSettings,
    updateSettings,
    getWhitelist,
    updateWhitelist,
};