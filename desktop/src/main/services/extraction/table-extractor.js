import { getClient } from '../../storage/sqlite-db.js';
import { getAIServiceURL } from '../ai-service-client.js';
import axios from 'axios';
import logger from '../../utils/logger.js';

/**
 * Extract tables from documents
 */
export async function extractTables(fileId, filePath, fileType) {
    try {
        const url = getAIServiceURL();

        // Call Python service for table extraction
        const response = await axios.post(
            `${url}/api/v1/extract-tables`,
            {
                file_path: filePath,
                file_type: fileType,
            },
            { timeout: 60000 }
        );

        const tables = response.data;

        // Store in database as structured data
        if (tables && tables.tables) {
            for (const table of tables.tables) {
                await storeTableData(fileId, table);
            }
        }

        return tables;
    } catch (error) {
        logger.error('Error extracting tables:', error);
        throw error;
    }
}

/**
 * Store table data in database
 */
async function storeTableData(fileId, table) {
    try {
        const client = getClient();
        await client.execute(
            `INSERT INTO file_structured_data (file_id, data_type, extracted_data, confidence, extraction_method)
             VALUES (?, ?, ?, ?, ?)`,
            [
                fileId,
                'table',
                JSON.stringify({
                    headers: table.headers || [],
                    rows: table.rows || [],
                    caption: table.caption || null,
                }),
                table.confidence || 0.9,
                table.method || 'table-extraction',
            ]
        );
    } catch (error) {
        logger.error('Error storing table data:', error);
        throw error;
    }
}