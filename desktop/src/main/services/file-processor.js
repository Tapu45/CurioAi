import { extractPDFContent } from '../extractors/pdf-extractor.js';
import { extractDOCXContent } from '../extractors/docx-extractor.js';
import { extractXLSXContent } from '../extractors/xlsx-extractor.js';
import { extractPPTXContent } from '../extractors/pptx-extractor.js';
import { extractImageContent } from '../extractors/image-extractor.js';
import { extractCodeContent } from '../extractors/code-extractor.js';
import mimeTypes from 'mime-types';
import { fileTypeFromFile } from 'file-type';
import path from 'path';
import logger from '../utils/logger.js';

/**
 * Detect file type from path and MIME type
 */
async function detectFileType(filePath) {
    try {
        // Try file-type first (more accurate for binary files)
        const fileTypeResult = await fileTypeFromFile(filePath);
        if (fileTypeResult) {
            return {
                type: fileTypeResult.mime,
                extension: fileTypeResult.ext,
            };
        }
    } catch (error) {
        // Fallback to mime-types
        logger.debug('file-type detection failed, using mime-types:', error.message);
    }

    // Fallback to extension-based detection
    const ext = path.extname(filePath).toLowerCase();
    const mime = mimeTypes.lookup(filePath) || 'application/octet-stream';

    return {
        type: mime,
        extension: ext.replace('.', ''),
    };
}

/**
 * Route file to appropriate extractor based on type
 */
async function processFile(fileData) {
    try {
        const filePath = fileData.path || fileData.filePath;
        if (!filePath) {
            throw new Error('File path is required');
        }

        // Detect file type
        const { type: mimeType, extension } = await detectFileType(filePath);

        logger.info(`Processing file: ${path.basename(filePath)} (${mimeType})`);

        let extractedContent = null;

        // Route to appropriate extractor
        if (mimeType === 'application/pdf' || extension === 'pdf') {
            extractedContent = await extractPDFContent({ path: filePath, window_title: path.basename(filePath) });
        } else if (
            mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            extension === 'docx'
        ) {
            extractedContent = await extractDOCXContent({ path: filePath, name: path.basename(filePath) });
        } else if (
            mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            extension === 'xlsx'
        ) {
            extractedContent = await extractXLSXContent({ path: filePath, name: path.basename(filePath) });
        } else if (
            mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
            extension === 'pptx'
        ) {
            extractedContent = await extractPPTXContent({ path: filePath, name: path.basename(filePath) });
        } else if (mimeType.startsWith('image/')) {
            extractedContent = await extractImageContent({ path: filePath, name: path.basename(filePath) });
        } else if (
            // Code files
            ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'rb', 'php', 'swift', 'kt'].includes(extension)
        ) {
            extractedContent = await extractCodeContent({
                window_title: path.basename(filePath),
                app_name: 'File System',
            });
        } else if (mimeType === 'text/plain' || extension === 'txt') {
            // Plain text files
            const fs = await import('fs/promises');
            const content = await fs.readFile(filePath, 'utf-8');
            extractedContent = {
                title: path.basename(filePath),
                content,
                url: `file://${filePath}`,
                metadata: {
                    filePath,
                    extractionMethod: 'plain-text',
                },
            };
        } else if (mimeType === 'text/markdown' || extension === 'md') {
            // Markdown files
            const fs = await import('fs/promises');
            const content = await fs.readFile(filePath, 'utf-8');
            extractedContent = {
                title: path.basename(filePath),
                content,
                url: `file://${filePath}`,
                metadata: {
                    filePath,
                    extractionMethod: 'markdown',
                },
            };
        } else {
            logger.debug(`No extractor available for file type: ${mimeType} (${extension})`);
            extractedContent = {
                title: path.basename(filePath),
                content: '',
                url: `file://${filePath}`,
                metadata: {
                    filePath,
                    mimeType,
                    extension,
                    extractionMethod: 'unsupported',
                },
            };
        }

        return {
            ...extractedContent,
            fileType: mimeType,
            extension,
            filePath,
        };
    } catch (error) {
        logger.error('Error processing file:', error instanceof Error ? error : new Error(String(error)));
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

export { processFile, detectFileType };