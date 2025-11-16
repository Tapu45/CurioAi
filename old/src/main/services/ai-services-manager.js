import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { app } from 'electron';
import logger from '../utils/logger.js';
import { checkServiceHealth } from './ai-service-client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let aiServiceProcess = null;
const MAX_RETRIES = 5;
const RETRY_DELAY = 2000; // 2 seconds

// Get Python executable path
function getPythonExecutable() {
    const servicePath = path.join(__dirname, '../../local-ai-service');

    // Try venv locations in order of preference
    const venvPaths = [
        path.join(servicePath, '.venv', 'bin', 'python'),
        path.join(servicePath, 'venv', 'bin', 'python'),
        path.join(servicePath, '.venv', 'bin', 'python3'),
        path.join(servicePath, 'venv', 'bin', 'python3'),
    ];

    // Check if venv exists and is executable
    for (const venvPath of venvPaths) {
        if (fs.existsSync(venvPath)) {
            try {
                // Verify it's actually executable
                fs.accessSync(venvPath, fs.constants.F_OK | fs.constants.X_OK);
                logger.info(`Found venv Python at: ${venvPath}`);
                return venvPath;
            } catch {
                continue;
            }
        }
    }

    // Fallback to system Python
    logger.warn('No venv found, using system Python. Make sure uvicorn is installed.');
    return 'python3';
}

// Start the AI service
async function startAIService() {
    if (aiServiceProcess) {
        logger.warn('AI service already running');
        return true;
    }

    try {
        const servicePath = path.join(__dirname, '../../local-ai-service');
        const pythonExe = getPythonExecutable();

        logger.info(`Starting AI service with Python: ${pythonExe}`);
        logger.info(`Service path: ${servicePath}`);

        // Spawn Python process
        aiServiceProcess = spawn(pythonExe, ['-m', 'uvicorn', 'src.main:app', '--host', '127.0.0.1', '--port', '8000'], {
            cwd: servicePath,
            env: {
                ...process.env,
                PYTHONUNBUFFERED: '1',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        // Log service output
        aiServiceProcess.stdout?.on('data', (data) => {
            logger.debug(`[AI Service] ${data.toString().trim()}`);
        });

        aiServiceProcess.stderr?.on('data', (data) => {
            const output = data.toString().trim();
            // Log errors more prominently
            if (output.includes('error') || output.includes('Error') || output.includes('ERROR')) {
                logger.error(`[AI Service Error] ${output}`);
            } else {
                logger.debug(`[AI Service] ${output}`);
            }
        });

        aiServiceProcess.on('error', (error) => {
            logger.error('Failed to start AI service:', error);
            aiServiceProcess = null;
        });

        aiServiceProcess.on('exit', (code, signal) => {
            logger.warn(`AI service exited with code ${code}, signal ${signal}`);
            aiServiceProcess = null;
        });

        // Wait for service to be ready
        let retries = 0;
        while (retries < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            const isHealthy = await checkServiceHealth();
            if (isHealthy) {
                logger.info('AI service started and healthy');
                return true;
            }
            retries++;
            logger.debug(`Waiting for AI service... (${retries}/${MAX_RETRIES})`);
        }

        logger.error('AI service failed to become healthy after retries');
        stopAIService();
        return false;
    } catch (error) {
        logger.error('Error starting AI service:', error);
        aiServiceProcess = null;
        return false;
    }
}

// Stop the AI service
function stopAIService() {
    if (!aiServiceProcess) {
        return;
    }

    try {
        logger.info('Stopping AI service...');
        aiServiceProcess.kill('SIGTERM');

        // Force kill after 5 seconds if still running
        setTimeout(() => {
            if (aiServiceProcess && !aiServiceProcess.killed) {
                logger.warn('Force killing AI service');
                aiServiceProcess.kill('SIGKILL');
            }
        }, 5000);

        aiServiceProcess = null;
        logger.info('AI service stopped');
    } catch (error) {
        logger.error('Error stopping AI service:', error);
    }
}

// Check if service is running
function isAIServiceRunning() {
    return aiServiceProcess !== null && !aiServiceProcess.killed;
}

export {
    startAIService,
    stopAIService,
    isAIServiceRunning,
};