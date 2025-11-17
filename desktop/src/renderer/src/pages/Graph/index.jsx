import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useElectron from '../../hooks/useElectron.js';
import GraphCanvas from '../../components/features/Graph/GraphCanvas.jsx';
import ConceptDetailPanel from '../../components/features/Graph/ConceptDetailPanel.jsx';
import Button from '../../components/common/Button/index.jsx';
import './Graph.css';

export default function GraphPage() {
    const electron = useElectron();
    const [graphData, setGraphData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedNode, setSelectedNode] = useState(null);
    const [filters, setFilters] = useState({
        showActivities: true,
        showConcepts: true,
        showTopics: true,
        minDegree: 1,
        limit: 200,
    });

    const loadGraphData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await electron.getVisualizationData?.(filters);
            setGraphData(data);
        } catch (error) {
            console.error('Failed to load graph data:', error);
            setGraphData({ nodes: [], edges: [], topics: [], stats: { nodeCount: 0, edgeCount: 0, topicCount: 0 } });
        } finally {
            setLoading(false);
        }
    }, [electron, filters]);

    useEffect(() => {
        loadGraphData();
    }, [loadGraphData]);

    const filteredNodes = useMemo(() => {
        if (!graphData?.nodes) return [];

        return graphData.nodes.filter((node) => {
            if (!filters.showActivities && node.type === 'Activity') return false;
            if (!filters.showConcepts && node.type === 'Concept') return false;
            if (!filters.showTopics && node.type === 'Topic') return false;
            return node.degree >= filters.minDegree;
        });
    }, [graphData?.nodes, filters]);

    const filteredEdges = useMemo(() => {
        if (!graphData?.edges) return [];
        const nodeIds = new Set(filteredNodes.map((n) => n.id));
        return graphData.edges.filter(
            (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
        );
    }, [graphData?.edges, filteredNodes]);

    const handleNodeClick = useCallback((node) => {
        if (node && (node.type === 'Concept' || node.type === 'Topic')) {
            setSelectedNode(node);
        } else {
            setSelectedNode(null);
        }
    }, []);

    const handleResetView = useCallback(() => {
        // Reset zoom/pan would be handled by GraphCanvas
        setSelectedNode(null);
    }, []);

    if (loading) {
        return (
            <div className="graph-page">
                <div className="card">
                    <div className="graph-loading">Loading graph...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="graph-page">
            <div className="graph-header">
                <div>
                    <h1 className="graph-title">Knowledge Graph</h1>
                    <p className="graph-subtitle">
                        Explore how your learning concepts connect
                    </p>
                </div>
                <div className="graph-stats">
                    <div className="stat-item">
                        <span className="stat-value">{graphData?.stats?.nodeCount || 0}</span>
                        <span className="stat-label">Nodes</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">{graphData?.stats?.edgeCount || 0}</span>
                        <span className="stat-label">Edges</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">{graphData?.stats?.topicCount || 0}</span>
                        <span className="stat-label">Topics</span>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="card graph-controls">
                <div className="controls-grid">
                    <div className="control-group">
                        <label className="control-label">Node Types</label>
                        <div className="control-checkboxes">
                            <label className="control-checkbox">
                                <input
                                    type="checkbox"
                                    checked={filters.showConcepts}
                                    onChange={(e) =>
                                        setFilters((f) => ({ ...f, showConcepts: e.target.checked }))
                                    }
                                />
                                <span>Concepts</span>
                            </label>
                            <label className="control-checkbox">
                                <input
                                    type="checkbox"
                                    checked={filters.showActivities}
                                    onChange={(e) =>
                                        setFilters((f) => ({ ...f, showActivities: e.target.checked }))
                                    }
                                />
                                <span>Activities</span>
                            </label>
                            <label className="control-checkbox">
                                <input
                                    type="checkbox"
                                    checked={filters.showTopics}
                                    onChange={(e) =>
                                        setFilters((f) => ({ ...f, showTopics: e.target.checked }))
                                    }
                                />
                                <span>Topics</span>
                            </label>
                        </div>
                    </div>

                    <div className="control-group">
                        <label className="control-label">Min Connections</label>
                        <input
                            type="number"
                            className="control-input"
                            min="0"
                            max="10"
                            value={filters.minDegree}
                            onChange={(e) =>
                                setFilters((f) => ({ ...f, minDegree: parseInt(e.target.value) || 0 }))
                            }
                        />
                    </div>

                    <div className="control-group">
                        <label className="control-label">Max Nodes</label>
                        <input
                            type="number"
                            className="control-input"
                            min="50"
                            max="500"
                            step="50"
                            value={filters.limit}
                            onChange={(e) =>
                                setFilters((f) => ({ ...f, limit: parseInt(e.target.value) || 200 }))
                            }
                        />
                    </div>

                    <div className="control-group">
                        <Button variant="secondary" size="sm" onClick={handleResetView}>
                            Reset View
                        </Button>
                        <Button variant="secondary" size="sm" onClick={loadGraphData}>
                            Refresh
                        </Button>
                    </div>
                </div>
            </div>

            {/* Graph Visualization */}
            <div className="graph-visualization-container">
                {filteredNodes.length === 0 ? (
                    <div className="graph-empty">
                        <div className="empty-icon">🧠</div>
                        <h3 className="empty-title">No graph data available</h3>
                        <p className="empty-description">
                            Start tracking activities to build your knowledge graph. Concepts will
                            appear as you learn and they get connected.
                        </p>
                    </div>
                ) : (
                    <div className="graph-canvas-wrapper">
                        <GraphCanvas
                            nodes={filteredNodes}
                            edges={filteredEdges}
                            onNodeClick={handleNodeClick}
                            selectedNode={selectedNode}
                        />
                        {selectedNode && (
                            <ConceptDetailPanel
                                concept={selectedNode}
                                onClose={() => setSelectedNode(null)}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="card graph-legend">
                <div className="legend-title">Legend</div>
                <div className="legend-items">
                    <div className="legend-item">
                        <div className="legend-color concept-color"></div>
                        <span>Concept</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-color activity-color"></div>
                        <span>Activity</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-color topic-color"></div>
                        <span>Topic</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-line learned-from"></div>
                        <span>Learned From</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-line related-to"></div>
                        <span>Related To</span>
                    </div>
                </div>
            </div>
        </div>
    );
}