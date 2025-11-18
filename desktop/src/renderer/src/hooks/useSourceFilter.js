import { useState, useCallback } from 'react';

const DEFAULT_SOURCE_TYPE = 'all';

export function useSourceFilter(initialSourceType = DEFAULT_SOURCE_TYPE) {
    const [sourceType, setSourceType] = useState(initialSourceType);

    const setSourceFilter = useCallback((type) => {
        setSourceType(type);
    }, []);

    const clearSourceFilter = useCallback(() => {
        setSourceType(DEFAULT_SOURCE_TYPE);
    }, []);

    return {
        sourceType,
        setSourceFilter,
        clearSourceFilter,
    };
}