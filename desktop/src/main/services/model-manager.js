import os from 'os';
import { getModelConfig, getRecommendedTier, MODEL_TIERS } from '../utils/model-config.js';
import { getAppConfig, updateAppConfig } from '../utils/config-manager.js';
import { checkServiceHealth } from './ai-service-client.js';
import logger from '../utils/logger.js';
import axios from 'axios';

/**
 * Model Manager - Handles model selection, detection, and management
 */
class ModelManager {
    constructor() {
        this.systemInfo = null;
        this.currentTier = null;
        this.currentModels = null;
    }

    /**
     * Detect system resources
     */
    async detectSystemResources() {
        try {
            const totalRAM = os.totalmem() / (1024 * 1024 * 1024); // GB
            const freeRAM = os.freemem() / (1024 * 1024 * 1024); // GB
            const cpuCores = os.cpus().length;
            const platform = os.platform();
            const arch = os.arch();

            // Get CPU model if available
            const cpuModel = os.cpus()[0]?.model || 'Unknown';

            this.systemInfo = {
                totalRAM: Math.round(totalRAM * 10) / 10,
                freeRAM: Math.round(freeRAM * 10) / 10,
                cpuCores,
                platform,
                arch,
                cpuModel,
            };

            logger.info('System resources detected:', this.systemInfo);
            return this.systemInfo;
        } catch (error) {
            logger.error('Error detecting system resources:', error);
            // Return conservative defaults
            return {
                totalRAM: 4,
                freeRAM: 2,
                cpuCores: 2,
                platform: 'unknown',
                arch: 'unknown',
                cpuModel: 'Unknown',
            };
        }
    }

    /**
     * Get recommended model tier based on system
     */
    async getRecommendedTier() {
        if (!this.systemInfo) {
            await this.detectSystemResources();
        }

        const recommendedTier = getRecommendedTier(this.systemInfo);
        logger.info(`Recommended model tier: ${recommendedTier}`);
        return recommendedTier;
    }

    /**
     * Get current model configuration
     */
    getCurrentModels() {
        if (!this.currentModels) {
            const config = getAppConfig();
            const tier = config.modelTier || 'MID_RANGE';
            this.currentTier = tier;
            this.currentModels = getModelConfig(tier);
        }
        return this.currentModels;
    }

    /**
     * Set model tier
     */
    async setModelTier(tier, options = {}) {
        try {
            const { force = false, updateService = true } = options;

            // Validate tier
            if (!MODEL_TIERS[tier]) {
                throw new Error(`Invalid model tier: ${tier}`);
            }

            // Check if system can handle this tier
            if (!force) {
                if (!this.systemInfo) {
                    await this.detectSystemResources();
                }
                const tierConfig = MODEL_TIERS[tier];
                if (this.systemInfo.totalRAM < tierConfig.minRAM) {
                    throw new Error(
                        `Insufficient RAM: ${this.systemInfo.totalRAM}GB < ${tierConfig.minRAM}GB required for ${tier}`
                    );
                }
                if (this.systemInfo.cpuCores < tierConfig.minCPU) {
                    logger.warn(
                        `Low CPU cores: ${this.systemInfo.cpuCores} < ${tierConfig.minCPU} recommended for ${tier}`
                    );
                }
            }

            // Update config
            const config = getAppConfig();
            config.modelTier = tier;
            config.llmModel = MODEL_TIERS[tier].llm.model;
            config.embeddingModel = MODEL_TIERS[tier].embedding.model;
            config.nlpModel = MODEL_TIERS[tier].nlp.model;
            updateAppConfig(config);

            this.currentTier = tier;
            this.currentModels = getModelConfig(tier);

            // Update AI service if enabled
            if (updateService) {
                await this.updateAIServiceModels();
            }

            logger.info(`Model tier set to: ${tier}`);
            return {
                success: true,
                tier,
                models: this.currentModels,
            };
        } catch (error) {
            logger.error('Error setting model tier:', error);
            throw error;
        }
    }

    /**
     * Update AI service with new models
     */
    async updateAIServiceModels() {
        try {
            const { checkServiceHealth, getAIServiceURL } = await import('./ai-service-client.js');

            // Check if service is available
            const isHealthy = await checkServiceHealth();
            if (!isHealthy) {
                logger.warn('AI service not available, skipping model update');
                return { success: false, reason: 'service_unavailable' };
            }

            const url = getAIServiceURL();
            const models = this.getCurrentModels();

            // Update models via API
            try {
                const response = await axios.post(
                    `${url}/api/v1/models/update`,
                    {
                        llm_model: models.llm.model,
                        embedding_model: models.embedding.model,
                        nlp_model: models.nlp.model,
                    },
                    { timeout: 10000 }
                );

                logger.info('AI service models updated:', response.data);
                return { success: true, data: response.data };
            } catch (error) {
                // Endpoint might not exist yet, that's OK
                logger.debug('Model update endpoint not available:', error.message);
                return { success: false, reason: 'endpoint_not_available' };
            }
        } catch (error) {
            logger.error('Error updating AI service models:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Auto-select best model tier
     */
    async autoSelectTier() {
        try {
            const recommendedTier = await this.getRecommendedTier();
            await this.setModelTier(recommendedTier, { force: false });
            return {
                tier: recommendedTier,
                models: this.currentModels,
            };
        } catch (error) {
            logger.error('Error auto-selecting tier:', error);
            // Fallback to MID_RANGE
            await this.setModelTier('MID_RANGE', { force: true });
            return {
                tier: 'MID_RANGE',
                models: this.currentModels,
            };
        }
    }

    /**
     * Get model information
     */
    getModelInfo() {
        const models = this.getCurrentModels();
        return {
            tier: this.currentTier,
            llm: {
                model: models.llm.model,
                size: models.llm.size,
                params: models.llm.params,
                description: models.llm.description,
            },
            embedding: {
                model: models.embedding.model,
                dimension: models.embedding.dimension,
                size: models.embedding.size,
                description: models.embedding.description,
            },
            nlp: {
                model: models.nlp.model,
                size: models.nlp.size,
                description: models.nlp.description,
            },
        };
    }

    /**
     * Check if model is available (for Ollama models)
     */
    async checkModelAvailability(modelName) {
        try {
            const { getAIServiceURL } = await import('./ai-service-client.js');
            const url = getAIServiceURL();

            // Check via AI service
            const response = await axios.get(`${url}/api/v1/models/check`, {
                params: { model: modelName },
                timeout: 5000,
            });

            return response.data.available || false;
        } catch (error) {
            logger.debug('Error checking model availability:', error.message);
            return false;
        }
    }

    /**
     * Get system resource usage
     */
    async getResourceUsage() {
        if (!this.systemInfo) {
            await this.detectSystemResources();
        }

        const totalRAM = this.systemInfo.totalRAM;
        const freeRAM = this.systemInfo.freeRAM;
        const usedRAM = totalRAM - freeRAM;
        const ramUsagePercent = (usedRAM / totalRAM) * 100;

        const loadAvg = os.loadavg();
        const cpuUsage = (loadAvg[0] / this.systemInfo.cpuCores) * 100;

        return {
            ram: {
                total: totalRAM,
                used: Math.round(usedRAM * 10) / 10,
                free: freeRAM,
                usagePercent: Math.round(ramUsagePercent * 10) / 10,
            },
            cpu: {
                cores: this.systemInfo.cpuCores,
                usagePercent: Math.min(Math.round(cpuUsage * 10) / 10, 100),
                loadAverage: loadAvg.map(v => Math.round(v * 100) / 100),
            },
            system: {
                platform: this.systemInfo.platform,
                arch: this.systemInfo.arch,
                cpuModel: this.systemInfo.cpuModel,
            },
        };
    }
}

// Singleton instance
let modelManagerInstance = null;

/**
 * Get model manager instance
 */
async function getModelManager() {
    if (!modelManagerInstance) {
        modelManagerInstance = new ModelManager();
        await modelManagerInstance.detectSystemResources();

        // Auto-select tier if not set
        const config = getAppConfig();
        if (!config.modelTier) {
            await modelManagerInstance.autoSelectTier();
        } else {
            modelManagerInstance.currentTier = config.modelTier;
            modelManagerInstance.currentModels = getModelConfig(config.modelTier);
        }

        logger.info('Model manager initialized');
    }
    return modelManagerInstance;
}

export { getModelManager, ModelManager };