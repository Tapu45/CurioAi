/**
 * Source Type Taxonomy
 * Defines the different types of sources in the knowledge base
 */
export const SOURCE_TYPES = {
    WORKSPACE: 'workspace',      // Files from file system
    ACTIVITIES: 'activities',    // Browser/activity tracking
    DOCUMENTS: 'documents',      // PDFs, DOCX, etc.
    IMAGES: 'images',            // Image files
    CODE: 'code',                // Code files
    VIDEO: 'video',              // Video content (YouTube, etc.)
    ALL: 'all',                  // All sources (no filter)
};

/**
 * Source type labels for UI
 */
export const SOURCE_TYPE_LABELS = {
    [SOURCE_TYPES.WORKSPACE]: 'Workspace Files',
    [SOURCE_TYPES.ACTIVITIES]: 'Activities',
    [SOURCE_TYPES.DOCUMENTS]: 'Documents',
    [SOURCE_TYPES.IMAGES]: 'Images',
    [SOURCE_TYPES.CODE]: 'Code',
    [SOURCE_TYPES.VIDEO]: 'Videos',
    [SOURCE_TYPES.ALL]: 'All Sources',
};

/**
 * Source type icons (for UI)
 */
export const SOURCE_TYPE_ICONS = {
    [SOURCE_TYPES.WORKSPACE]: 'folder',
    [SOURCE_TYPES.ACTIVITIES]: 'activity',
    [SOURCE_TYPES.DOCUMENTS]: 'file-text',
    [SOURCE_TYPES.IMAGES]: 'image',
    [SOURCE_TYPES.CODE]: 'code',
    [SOURCE_TYPES.VIDEO]: 'video',
    [SOURCE_TYPES.ALL]: 'layers',
};

/**
 * Get all source types (excluding ALL)
 */
export function getSourceTypes() {
    return Object.values(SOURCE_TYPES).filter(type => type !== SOURCE_TYPES.ALL);
}

/**
 * Check if source type is valid
 */
export function isValidSourceType(type) {
    return Object.values(SOURCE_TYPES).includes(type);
}

/**
 * Map file type to source type
 */
export function mapFileTypeToSourceType(fileType, mimeType) {
    if (!fileType && !mimeType) {
        return SOURCE_TYPES.WORKSPACE;
    }

    const type = (fileType || mimeType || '').toLowerCase();

    // Images
    if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].some(ext => type.includes(ext))) {
        return SOURCE_TYPES.IMAGES;
    }

    // Documents
    if (type.includes('pdf') || type.includes('docx') || type.includes('doc') ||
        type.includes('xlsx') || type.includes('pptx') || type.includes('txt') ||
        type.includes('md') || type.includes('rtf')) {
        return SOURCE_TYPES.DOCUMENTS;
    }

    // Code
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'rb', 'php', 'swift', 'kt'].some(ext => type.includes(ext))) {
        return SOURCE_TYPES.CODE;
    }

    // Default to workspace
    return SOURCE_TYPES.WORKSPACE;
}

/**
 * Map activity source type to source type
 */
export function mapActivitySourceType(activitySourceType) {
    const mapping = {
        'browser': SOURCE_TYPES.ACTIVITIES,
        'video': SOURCE_TYPES.VIDEO,
        'pdf': SOURCE_TYPES.DOCUMENTS,
        'code': SOURCE_TYPES.CODE,
        'document': SOURCE_TYPES.DOCUMENTS,
        'other': SOURCE_TYPES.ACTIVITIES,
    };

    return mapping[activitySourceType] || SOURCE_TYPES.ACTIVITIES;
}

/**
 * Build LanceDB filter from source type
 */
export function buildSourceFilter(sourceType) {
    if (!sourceType || sourceType === SOURCE_TYPES.ALL) {
        return {}; // No filter
    }

    return {
        source_type: sourceType,
    };
}

/**
 * Build LanceDB filter from multiple source types
 */
export function buildMultiSourceFilter(sourceTypes) {
    if (!sourceTypes || sourceTypes.length === 0 || sourceTypes.includes(SOURCE_TYPES.ALL)) {
        return {}; // No filter
    }

    // LanceDB doesn't support OR directly, so we'll filter in application layer
    // For now, return empty and filter in RAG chain
    return {
        source_types: sourceTypes, // Special key for multi-source filtering
    };
}