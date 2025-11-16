import pdfParse from 'pdf-parse';
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import logger from '../utils/logger.js';

// Extract content from PDF file
async function extractPDFContent(activity) {
    try {
        // Try to find PDF file from window title or metadata
        let pdfPath = null;

        // Extract file path from window title (common pattern: "filename.pdf - Reader")
        const title = activity.window_title || '';
        const pdfMatch = title.match(/([^\s]+\.pdf)/i);

        if (pdfMatch) {
            const filename = pdfMatch[1];

            // Search common PDF locations
            const searchPaths = [
                path.join(app.getPath('documents'), filename),
                path.join(app.getPath('downloads'), filename),
                path.join(app.getPath('home'), 'Documents', filename),
                path.join(app.getPath('home'), 'Downloads', filename),
            ];

            for (const searchPath of searchPaths) {
                try {
                    await fs.access(searchPath);
                    pdfPath = searchPath;
                    break;
                } catch (e) {
                    // Continue searching
                }
            }
        }

        // If no PDF found, return empty content
        if (!pdfPath) {
            logger.debug('PDF file not found for extraction');
            return {
                title: title.replace(/\s*-\s*.*$/, '') || activity.window_title || '',
                content: '',
                url: null,
                metadata: {
                    app: activity.app_name,
                    error: 'PDF file not found',
                },
            };
        }

        // Read and parse PDF
        const dataBuffer = await fs.readFile(pdfPath);
        const pdfData = await pdfParse(dataBuffer);

        logger.info(`PDF content extracted: ${pdfData.text.length} characters from ${pdfPath}`);

        return {
            title: pdfData.info?.Title || title.replace(/\s*-\s*.*$/, '') || path.basename(pdfPath),
            content: pdfData.text,
            url: `file://${pdfPath}`,
            metadata: {
                app: activity.app_name,
                pdfPath,
                numPages: pdfData.numpages,
                author: pdfData.info?.Author,
                subject: pdfData.info?.Subject,
                extractionMethod: 'pdf-parse',
            },
        };
    } catch (error) {
        logger.error('Error extracting PDF content:', error);
        return {
            title: activity.window_title || '',
            content: '',
            url: null,
            metadata: {
                app: activity.app_name,
                error: error.message,
            },
        };
    }
}

export { extractPDFContent };