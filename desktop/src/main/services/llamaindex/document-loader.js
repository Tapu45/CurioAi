import { getAIServiceURL } from '../ai-service-client.js';
import axios from 'axios';
import logger from '../../utils/logger.js';
import { Document } from '@langchain/core/documents';

/**
 * Load documents using LlamaIndex (via Python service)
 */
export async function loadDocuments(filePaths, options = {}) {
    try {
        const url = getAIServiceURL();
        const {
            fileType = 'auto',
            chunkSize = 1000,
            chunkOverlap = 200,
        } = options;

        // Call Python LlamaIndex service
        const response = await axios.post(
            `${url}/api/v1/llamaindex/load-documents`,
            {
                file_paths: filePaths,
                file_type: fileType,
                chunk_size: chunkSize,
                chunk_overlap: chunkOverlap,
            },
            { timeout: 120000 } // 2 minute timeout
        );

        const documents = response.data.documents || [];

        // Convert to LangChain Document format
        return documents.map(doc => new Document({
            pageContent: doc.text || doc.content || '',
            metadata: {
                ...doc.metadata,
                id: doc.id,
                filePath: doc.file_path,
            },
        }));
    } catch (error) {
        logger.error('Error loading documents with LlamaIndex:', error);
        throw error;
    }
}

/**
 * Load a single document
 */
export async function loadDocument(filePath, options = {}) {
    const documents = await loadDocuments([filePath], options);
    return documents[0] || null;
}

/**
 * Load documents from directory
 */
export async function loadDocumentsFromDirectory(directoryPath, options = {}) {
    try {
        const url = getAIServiceURL();
        const {
            recursive = true,
            patterns = ['**/*'],
        } = options;

        const response = await axios.post(
            `${url}/api/v1/llamaindex/load-directory`,
            {
                directory_path: directoryPath,
                recursive,
                patterns,
            },
            { timeout: 180000 } // 3 minute timeout
        );

        const documents = response.data.documents || [];

        return documents.map(doc => new Document({
            pageContent: doc.text || doc.content || '',
            metadata: {
                ...doc.metadata,
                id: doc.id,
                filePath: doc.file_path,
            },
        }));
    } catch (error) {
        logger.error('Error loading documents from directory:', error);
        throw error;
    }
}