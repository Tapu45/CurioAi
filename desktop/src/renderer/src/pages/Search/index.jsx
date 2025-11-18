import React, { useState, useCallback, useMemo } from 'react';
import useElectron from '../../hooks/useElectron.js';
import useAppStore from '../../store/store.js';
import ActivityDetail from '../../components/features/History/ActivityDetail.jsx';
import './Search.css';

export default function SearchPage() {
    const electron = useElectron();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedResult, setSelectedResult] = useState(null);
    const [aiServiceOnline, setAiServiceOnline] = useState(null); // null = checking, true/false = status

    // Check AI service on mount
    React.useEffect(() => {
        const checkService = async () => {
            try {
                const isOnline = await electron.checkAIService?.();
                setAiServiceOnline(isOnline);
            } catch (error) {
                setAiServiceOnline(false);
            }
        };
        checkService();
    }, [electron]);

    const handleSearch = useCallback(async () => {
        if (!query.trim() || !aiServiceOnline) return;

        setLoading(true);
        try {
            const searchResults = await electron.semanticSearch?.(query, {
                limit: 20,
                minSimilarity: 0.5,
            });
            setResults(searchResults || []);
        } catch (error) {
            console.error('Search failed:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, [query, electron, aiServiceOnline]);

    const handleKeyPress = useCallback(
        (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSearch();
            }
        },
        [handleSearch]
    );

    const handleResultClick = useCallback(async (result) => {
        if (result.activityId) {
            try {
                const activity = await electron.getActivities?.({ limit: 1 });
                const found = activity?.find((a) => a.id === result.activityId);
                if (found) {
                    setSelectedResult(found);
                }
            } catch (error) {
                console.error('Failed to load activity:', error);
            }
        }
    }, [electron]);

    return (
        <div className="search-page">
            <div className="search-header">
                <h1 className="search-title">Semantic Search</h1>
                <p className="search-subtitle">
                    Search your knowledge base using natural language
                </p>
            </div>

            {/* AI Service Status */}
            {aiServiceOnline === false && (
                <div className="search-warning">
                    <div className="warning-icon">⚠️</div>
                    <div>
                        <div className="warning-title">Local AI Service Offline</div>
                        <div className="warning-description">
                            The AI service is not running. Please start the local AI service to enable semantic search.
                        </div>
                    </div>
                </div>
            )}

            {/* Search Bar */}
            <div className="search-bar-container">
                <div className="search-bar-wrapper">
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search your knowledge base... (e.g., 'What did I learn about React?')"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyPress={handleKeyPress}
                        disabled={!aiServiceOnline || loading}
                    />
                    <button
                        className="search-button"
                        onClick={handleSearch}
                        disabled={!aiServiceOnline || loading || !query.trim()}
                    >
                        {loading ? '⏳' : '🔍'}
                    </button>
                </div>
            </div>

            {/* Results */}
            {loading && (
                <div className="search-loading">
                    <div className="loading-spinner"></div>
                    <span>Searching your knowledge base...</span>
                </div>
            )}

            {!loading && results.length > 0 && (
                <div className="search-results">
                    <div className="results-header">
                        <span className="results-count">
                            Found {results.length} {results.length === 1 ? 'result' : 'results'}
                        </span>
                    </div>
                    <div className="results-list">
                        {results.map((result) => (
                            <SearchResultItem
                                key={result.id}
                                result={result}
                                onClick={() => handleResultClick(result)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {!loading && query && results.length === 0 && (
                <div className="search-empty">
                    <div className="empty-icon">🔍</div>
                    <h3 className="empty-title">No results found</h3>
                    <p className="empty-description">
                        Try rephrasing your query or check if you have any activities captured.
                    </p>
                </div>
            )}

            {/* Activity Detail Modal */}
            {selectedResult && (
                <ActivityDetail
                    activity={selectedResult}
                    onClose={() => setSelectedResult(null)}
                />
            )}
        </div>
    );
}

function SearchResultItem({ result, onClick }) {
    const similarityPercent = Math.round(result.similarity * 100);

    // Safely convert summary to string
    const summaryText = typeof result.summary === 'string'
        ? result.summary
        : typeof result.summary === 'object' && result.summary !== null
            ? result.summary.text || result.summary.summary || JSON.stringify(result.summary)
            : String(result.summary || '');

    return (
        <div className="search-result-item" onClick={onClick}>
            <div className="result-main">
                <div className="result-header">
                    <h3 className="result-title">{result.title}</h3>
                    <div className="result-similarity">{similarityPercent}% match</div>
                </div>
                <div className="result-summary">{summaryText}</div>
                <div className="result-meta">
                    {result.sourceType && (
                        <span className="result-badge">{result.sourceType}</span>
                    )}
                    {result.activity?.app_name && (
                        <span className="result-app">{result.activity.app_name}</span>
                    )}
                    {result.timestamp && (
                        <span className="result-time">
                            {new Date(result.timestamp).toLocaleDateString()}
                        </span>
                    )}
                </div>
            </div>
            <div className="result-arrow">→</div>
        </div>
    );
}