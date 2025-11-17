import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';

/**
 * Extract content from XLSX file
 * @param {Object} fileData - File data with path
 * @returns {Promise<Object>} Extracted content
 */
async function extractXLSXContent(fileData) {
    try {
        const filePath = fileData.path || fileData.filePath;

        if (!filePath) {
            throw new Error('File path is required');
        }

        // Read file buffer
        const buffer = await fs.readFile(filePath);

        // Parse workbook
        const workbook = XLSX.read(buffer, { type: 'buffer' });

        // Extract text from all sheets
        const sheets = [];
        let allText = '';

        workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const sheetText = XLSX.utils.sheet_to_txt(worksheet);
            sheets.push({
                name: sheetName,
                content: sheetText,
            });
            allText += `\n\n=== Sheet: ${sheetName} ===\n\n${sheetText}`;
        });

        logger.info(`XLSX content extracted: ${allText.length} characters from ${path.basename(filePath)}`);

        return {
            title: path.basename(filePath, '.xlsx'),
            content: allText.trim(),
            url: `file://${filePath}`,
            metadata: {
                filePath,
                fileSize: buffer.length,
                extractionMethod: 'xlsx',
                sheetCount: workbook.SheetNames.length,
                sheetNames: workbook.SheetNames,
            },
        };
    } catch (error) {
        logger.error('Error extracting XLSX content:', error instanceof Error ? error : new Error(String(error)));
        return {
            title: fileData.name || 'Untitled',
            content: '',
            url: null,
            metadata: {
                error: error instanceof Error ? error.message : String(error),
            },
        };
    }
}

export { extractXLSXContent };