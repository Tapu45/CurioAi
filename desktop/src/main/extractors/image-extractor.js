import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';

let ocrWorker = null;

/**
 * Initialize OCR worker (lazy loading)
 */
async function getOCRWorker() {
    if (!ocrWorker) {
        ocrWorker = await createWorker('eng');
        logger.debug('OCR worker initialized');
    }
    return ocrWorker;
}

/**
 * Extract text from image using OCR
 * @param {Object} fileData - File data with path
 * @returns {Promise<Object>} Extracted content
 */
async function extractImageContent(fileData) {
    try {
        const filePath = fileData.path || fileData.filePath;

        if (!filePath) {
            throw new Error('File path is required');
        }

        // Read image
        const imageBuffer = await fs.readFile(filePath);

        // Get image metadata
        const metadata = await sharp(imageBuffer).metadata();

        // Perform OCR
        const worker = await getOCRWorker();
        const { data: { text } } = await worker.recognize(imageBuffer);

        logger.info(`Image OCR completed: ${text.length} characters from ${path.basename(filePath)}`);

        return {
            title: path.basename(filePath),
            content: text || '[Image file - no text detected]',
            url: `file://${filePath}`,
            metadata: {
                filePath,
                fileSize: imageBuffer.length,
                extractionMethod: 'tesseract-ocr',
                imageWidth: metadata.width,
                imageHeight: metadata.height,
                imageFormat: metadata.format,
                hasText: text && text.trim().length > 0,
            },
        };
    } catch (error) {
        logger.error('Error extracting image content:', error instanceof Error ? error : new Error(String(error)));
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

/**
 * Cleanup OCR worker
 */
async function cleanupOCR() {
    if (ocrWorker) {
        await ocrWorker.terminate();
        ocrWorker = null;
        logger.debug('OCR worker terminated');
    }
}

export { extractImageContent, cleanupOCR };