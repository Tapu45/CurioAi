import React, { useState } from 'react';
import { Filter, X } from 'lucide-react';
import './SourceFilter.css';

const SOURCE_TYPES = {
    ALL: 'all',
    WORKSPACE: 'workspace',
    ACTIVITIES: 'activities',
    DOCUMENTS: 'documents',
    IMAGES: 'images',
    CODE: 'code',
    VIDEO: 'video',
};

const SOURCE_LABELS = {
    [SOURCE_TYPES.ALL]: 'All Sources',
    [SOURCE_TYPES.WORKSPACE]: 'Workspace',
    [SOURCE_TYPES.ACTIVITIES]: 'Activities',
    [SOURCE_TYPES.DOCUMENTS]: 'Documents',
    [SOURCE_TYPES.IMAGES]: 'Images',
    [SOURCE_TYPES.CODE]: 'Code',
    [SOURCE_TYPES.VIDEO]: 'Videos',
};

export default function SourceFilter({ value = SOURCE_TYPES.ALL, onChange, className = '' }) {
    const [isOpen, setIsOpen] = useState(false);

    const handleSelect = (sourceType) => {
        onChange(sourceType);
        setIsOpen(false);
    };

    return (
        <div className={`source-filter ${className}`}>
            <button
                className="source-filter-button"
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Filter by source type"
                title="Filter by source type"
            >
                <Filter size={16} />
                <span className="source-filter-label">
                    {SOURCE_LABELS[value] || SOURCE_LABELS[SOURCE_TYPES.ALL]}
                </span>
                {value !== SOURCE_TYPES.ALL && (
                    <button
                        className="source-filter-clear"
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange(SOURCE_TYPES.ALL);
                        }}
                        aria-label="Clear filter"
                    >
                        <X size={12} />
                    </button>
                )}
            </button>

            {isOpen && (
                <>
                    <div
                        className="source-filter-overlay"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="source-filter-dropdown">
                        {Object.entries(SOURCE_LABELS).map(([type, label]) => (
                            <button
                                key={type}
                                className={`source-filter-option ${value === type ? 'active' : ''
                                    }`}
                                onClick={() => handleSelect(type)}
                            >
                                <span>{label}</span>
                                {value === type && (
                                    <span className="source-filter-check">✓</span>
                                )}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}