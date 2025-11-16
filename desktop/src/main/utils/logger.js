import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const LOG_DIR = path.join(app.getPath('userData'), 'logs');
const LOG_FILE = path.join(LOG_DIR, `curioai-${new Date().toISOString().split('T')[0]}.log`);

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Log levels
const LEVELS = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG',
};

// Format log message
function formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? ' ' + args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : '';
    return `[${timestamp}] [${level}] ${message}${argsStr}\n`;
}

// Write to file
function writeToFile(level, message, ...args) {
    const logMessage = formatMessage(level, message, ...args);
    fs.appendFileSync(LOG_FILE, logMessage, 'utf8');
}

// Write to console
function writeToConsole(level, message, ...args) {
    const logMessage = formatMessage(level, message, ...args);
    console.log(logMessage.trim());
}

// Logger object
const logger = {
    error: (message, ...args) => {
        writeToFile(LEVELS.ERROR, message, ...args);
        writeToConsole(LEVELS.ERROR, message, ...args);
    },

    warn: (message, ...args) => {
        writeToFile(LEVELS.WARN, message, ...args);
        writeToConsole(LEVELS.WARN, message, ...args);
    },

    info: (message, ...args) => {
        writeToFile(LEVELS.INFO, message, ...args);
        writeToConsole(LEVELS.INFO, message, ...args);
    },

    debug: (message, ...args) => {
        writeToFile(LEVELS.DEBUG, message, ...args);
        writeToConsole(LEVELS.DEBUG, message, ...args);
    },
};

export default logger;