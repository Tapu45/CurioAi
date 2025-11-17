import mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';

/**
 * Extract content from PPTX file
 * Note: PPTX extraction is limited - we'll extract text from embedded documents if possible
 * For better extraction, consider using a dedicated PPTX parser in the future
 * @param {Object} fileData - File data with path
 * @returns {Promise<Object>} Extracted content
 */
async function extractPPTXContent(fileData) {
    try {
        const filePath = fileData.path || fileData.filePath;

        if (!filePath) {
            throw new Error('File path is required');
        }

        // PPTX is a ZIP archive containing XML files
        // For now, we'll use a simple approach - extract text from XML
        // A more robust solution would use a dedicated PPTX parser

        const buffer = await fs.readFile(filePath);

        // Basic text extraction from PPTX (limited)
        // PPTX files are ZIP archives, we could unzip and parse XML
        // For MVP, we'll return minimal content and note it needs enhancement
        const text = `[PPTX file: ${path.basename(filePath)}]\n\nNote: Full text extraction from PowerPoint files requires additional parsing. This file has been indexed but content extraction is limited.`;

        logger.info(`PPTX file detected: ${path.basename(filePath)} (limited extraction)`);

        return {
            title: path.basename(filePath, '.pptx'),
            content: text,
            url: `file://${filePath}`,
            metadata: {
                filePath,
                fileSize: buffer.length,
                extractionMethod: 'pptx-basic',
                note: 'Full PPTX extraction requires enhanced parser',
            },
        };
    } catch (error) {
        logger.error('Error extracting PPTX content:', error instanceof Error ? error : new Error(String(error)));
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

export { extractPPTXContent };