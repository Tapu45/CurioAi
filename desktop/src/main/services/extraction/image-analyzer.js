import { getClient } from '../../storage/sqlite-db.js';
import { getAIServiceURL } from '../ai-service-client.js';
import axios from 'axios';
import logger from '../../utils/logger.js';

/**
 * Analyze image - OCR + vision model analysis
 */
export async function analyzeImage(fileId, filePath) {
    try {
        const url = getAIServiceURL();

        // Call Python service for image analysis
        const response = await axios.post(
            `${url}/api/v1/analyze-image`,
            {
                file_path: filePath,
            },
            { timeout: 90000 } // 90 second timeout for vision models
        );

        const analysis = response.data;

        // Store in database
        if (analysis) {
            await storeImageAnalysis(fileId, analysis);
        }

        return analysis;
    } catch (error) {
        logger.error('Error analyzing image:', error);
        throw error;
    }
}

/**
 * Store image analysis in database
 */
async function storeImageAnalysis(fileId, analysis) {
    try {
        const client = getClient();
        await client.execute(
            `INSERT INTO image_analysis (file_id, ocr_text, scene_description, objects_detected, confidence, analysis_method)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                fileId,
                analysis.ocr_text || null,
                analysis.scene_description || null,
                JSON.stringify(analysis.objects_detected || []),
                analysis.confidence || 0.8,
                analysis.method || 'vision-model',
            ]
        );
    } catch (error) {
        logger.error('Error storing image analysis:', error);
        throw error;
    }
}

/**
 * Get image analysis for a file
 */
export async function getImageAnalysis(fileId) {
    try {
        const client = getClient();
        const result = await client.execute(
            'SELECT * FROM image_analysis WHERE file_id = ? ORDER BY created_at DESC LIMIT 1',
            [fileId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            id: row.id,
            ocrText: row.ocr_text,
            sceneDescription: row.scene_description,
            objectsDetected: row.objects_detected ? JSON.parse(row.objects_detected) : [],
            confidence: row.confidence,
            analysisMethod: row.analysis_method,
            createdAt: row.created_at,
        };
    } catch (error) {
        logger.error('Error getting image analysis:', error);
        throw error;
    }
}