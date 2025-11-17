import mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';

/**
 * Extract content from DOCX file
 * @param {Object} fileData - File data with path
 * @returns {Promise<Object>} Extracted content
 */
async function extractDOCXContent(fileData) {
    try {
        const filePath = fileData.path || fileData.filePath;

        if (!filePath) {
            throw new Error('File path is required');
        }

        // Read file buffer
        const buffer = await fs.readFile(filePath);

        // Extract text using mammoth
        const result = await mammoth.extractRawText({ buffer });
        const text = result.value;

        // Extract metadata
        const metadata = await mammoth.extractRawText({ buffer });

        logger.info(`DOCX content extracted: ${text.length} characters from ${path.basename(filePath)}`);

        return {
            title: path.basename(filePath, '.docx'),
            content: text,
            url: `file://${filePath}`,
            metadata: {
                filePath,
                fileSize: buffer.length,
                extractionMethod: 'mammoth',
                wordCount: text.split(/\s+/).length,
            },
        };
    } catch (error) {
        logger.error('Error extracting DOCX content:', error instanceof Error ? error : new Error(String(error)));
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

export { extractDOCXContent };