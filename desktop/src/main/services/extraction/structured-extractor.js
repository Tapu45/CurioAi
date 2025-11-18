import { getClient } from '../../storage/sqlite-db.js';
import { getAIServiceURL } from '../ai-service-client.js';
import axios from 'axios';
import logger from '../../utils/logger.js';

/**
 * Extract structured data from documents (forms, key-value pairs, percentages, etc.)
 */
export async function extractStructuredData(fileId, filePath, fileType) {
    try {
        const url = getAIServiceURL();

        // Call Python service for structured extraction
        const response = await axios.post(
            `${url}/api/v1/extract-structured`,
            {
                file_path: filePath,
                file_type: fileType,
            },
            { timeout: 60000 } // 60 second timeout
        );

        const structuredData = response.data;

        // Store in database
        if (structuredData && structuredData.data) {
            for (const item of structuredData.data) {
                await storeStructuredData(fileId, item);
            }
        }

        return structuredData;
    } catch (error) {
        logger.error('Error extracting structured data:', error);
        throw error;
    }
}

/**
 * Store structured data in database
 */
async function storeStructuredData(fileId, data) {
    try {
        const client = getClient();
        await client.execute(
            `INSERT INTO file_structured_data (file_id, data_type, extracted_data, confidence, extraction_method)
             VALUES (?, ?, ?, ?, ?)`,
            [
                fileId,
                data.type || 'key_value',
                JSON.stringify(data.data),
                data.confidence || 0.8,
                data.method || 'llm-extraction',
            ]
        );
    } catch (error) {
        logger.error('Error storing structured data:', error);
        throw error;
    }
}

/**
 * Get structured data for a file
 */
export async function getStructuredData(fileId) {
    try {
        const client = getClient();
        const result = await client.execute(
            'SELECT * FROM file_structured_data WHERE file_id = ? ORDER BY created_at DESC',
            [fileId]
        );

        return result.rows.map(row => ({
            id: row.id,
            dataType: row.data_type,
            extractedData: JSON.parse(row.extracted_data),
            confidence: row.confidence,
            extractionMethod: row.extraction_method,
            createdAt: row.created_at,
        }));
    } catch (error) {
        logger.error('Error getting structured data:', error);
        throw error;
    }
}