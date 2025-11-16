import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import logger from './logger.js';

const CONFIG_DIR = path.join(app.getPath('userData'), 'config');
const WHITELIST_FILE = path.join(CONFIG_DIR, 'whitelist.json');
const APP_CONFIG_FILE = path.join(CONFIG_DIR, 'app-config.json');
const PRIVACY_CONFIG_FILE = path.join(CONFIG_DIR, 'privacy-config.json');

// Default configurations
const DEFAULT_WHITELIST = {
    domains: [
        'youtube.com',
        'medium.com',
        'dev.to',
        'wikipedia.org',
        'arxiv.org',
        'github.com',
        'stackoverflow.com',
        'coursera.org',
        'udemy.com',
        'khanacademy.org',
    ],
    apps: [
        'Code',
        'Visual Studio Code',
        'IntelliJ IDEA',
        'PyCharm',
        'Notion',
        'Obsidian',
    ],
};

const DEFAULT_APP_CONFIG = {
    trackingInterval: 60000, // 60 seconds
    storageLimit: 1073741824, // 1GB
    aiModel: 'mistral',
    graphUpdateInterval: 1800000, // 30 minutes
    enableSync: false,
};

const DEFAULT_PRIVACY_CONFIG = {
    enableTracking: true,
    removePII: true,
    anonymizeData: false,
    allowCloudSync: false,
    dataRetentionDays: 365,
};

// Ensure config directory exists
function ensureConfigDirectory() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
        logger.info('Created config directory:', CONFIG_DIR);
    }
}

// Load configuration file
function loadConfigFile(filePath, defaultValue) {
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        } else {
            // Create default config file
            fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
            logger.info('Created default config file:', filePath);
            return defaultValue;
        }
    } catch (error) {
        logger.error('Error loading config file:', filePath, error);
        return defaultValue;
    }
}

// Save configuration file
function saveConfigFile(filePath, config) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
        logger.info('Saved config file:', filePath);
        return true;
    } catch (error) {
        logger.error('Error saving config file:', filePath, error);
        return false;
    }
}

// Load all configurations
function loadConfig() {
    ensureConfigDirectory();

    const whitelist = loadConfigFile(WHITELIST_FILE, DEFAULT_WHITELIST);
    const appConfig = loadConfigFile(APP_CONFIG_FILE, DEFAULT_APP_CONFIG);
    const privacyConfig = loadConfigFile(PRIVACY_CONFIG_FILE, DEFAULT_PRIVACY_CONFIG);

    return {
        whitelist,
        appConfig,
        privacyConfig,
    };
}

// Get whitelist
function getWhitelist() {
    return loadConfigFile(WHITELIST_FILE, DEFAULT_WHITELIST);
}

// Update whitelist
function updateWhitelist(whitelist) {
    return saveConfigFile(WHITELIST_FILE, whitelist);
}

// Get app config
function getAppConfig() {
    return loadConfigFile(APP_CONFIG_FILE, DEFAULT_APP_CONFIG);
}

// Update app config
function updateAppConfig(config) {
    return saveConfigFile(APP_CONFIG_FILE, config);
}

// Get privacy config
function getPrivacyConfig() {
    return loadConfigFile(PRIVACY_CONFIG_FILE, DEFAULT_PRIVACY_CONFIG);
}

// Update privacy config
function updatePrivacyConfig(config) {
    return saveConfigFile(PRIVACY_CONFIG_FILE, config);
}

export {
    loadConfig,
    getWhitelist,
    updateWhitelist,
    getAppConfig,
    updateAppConfig,
    getPrivacyConfig,
    updatePrivacyConfig,
};