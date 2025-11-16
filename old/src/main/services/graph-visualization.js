import { queryGraph } from '../storage/graph-client.js';
import logger from '../utils/logger.js';

// Get graph data optimized for visualization
async function getVisualizationData(options = {}) {
    try {
        const {
            limit = 200,
            includeActivities = true,
            includeTopics = true,
            minNodeDegree = 1,
        } = options;

        const nodes = new Map();
        const edges = [];
        const nodeDegrees = new Map();

        // Use new query pattern
        const results = await queryGraph('MATCH_ALL_RELATIONSHIPS', { limit });

        // Process results (same logic as before)
        results.forEach(record => {
            const nodeA = record.a;
            const nodeB = record.b;
            const relationship = record.r;
            const labelA = record.labelA;
            const labelB = record.labelB;
            const relType = record.relType;

            if (!includeActivities && (labelA === 'Activity' || labelB === 'Activity')) {
                return;
            }

            if (!nodes.has(nodeA.properties.id)) {
                nodes.set(nodeA.properties.id, {
                    id: nodeA.properties.id,
                    label: nodeA.properties.name || nodeA.properties.title || nodeA.properties.id,
                    type: labelA,
                    properties: nodeA.properties,
                    degree: 0,
                });
                nodeDegrees.set(nodeA.properties.id, 0);
            }

            if (!nodes.has(nodeB.properties.id)) {
                nodes.set(nodeB.properties.id, {
                    id: nodeB.properties.id,
                    label: nodeB.properties.name || nodeB.properties.title || nodeB.properties.id,
                    type: labelB,
                    properties: nodeB.properties,
                    degree: 0,
                });
                nodeDegrees.set(nodeB.properties.id, 0);
            }

            nodeDegrees.set(nodeA.properties.id, nodeDegrees.get(nodeA.properties.id) + 1);
            nodeDegrees.set(nodeB.properties.id, nodeDegrees.get(nodeB.properties.id) + 1);

            edges.push({
                source: nodeA.properties.id,
                target: nodeB.properties.id,
                type: relType,
                properties: relationship.properties,
            });
        });

        const filteredNodes = [];
        nodes.forEach((node, id) => {
            node.degree = nodeDegrees.get(id) || 0;
            if (node.degree >= minNodeDegree) {
                filteredNodes.push(node);
            }
        });

        const nodeIds = new Set(filteredNodes.map(n => n.id));
        const filteredEdges = edges.filter(e =>
            nodeIds.has(e.source) && nodeIds.has(e.target)
        );

        let topics = [];
        if (includeTopics) {
            topics = await getTopicData();
        }

        return {
            nodes: filteredNodes,
            edges: filteredEdges,
            topics,
            stats: {
                nodeCount: filteredNodes.length,
                edgeCount: filteredEdges.length,
                topicCount: topics.length,
            },
        };
    } catch (error) {
        logger.error('Error getting visualization data:', error);
        return {
            nodes: [],
            edges: [],
            topics: [],
            stats: { nodeCount: 0, edgeCount: 0, topicCount: 0 },
        };
    }
}

// Get topic data
async function getTopicData() {
    try {
        // Get all topics and their concepts
        const results = await queryGraph('MATCH_TOPICS_WITH_CONCEPTS', {});

        return results.map(record => ({
            id: record.topicId,
            name: record.topicName,
            concepts: record.concepts,
            conceptCount: record.concepts.length,
        }));
    } catch (error) {
        logger.error('Error getting topic data:', error);
        return [];
    }
}

// Get subgraph around a specific node
async function getNodeSubgraph(nodeId, depth = 2, limit = 50) {
    try {
        const query = `
      MATCH path = (start {id: $nodeId})-[*1..${depth}]-(connected)
      RETURN path
      LIMIT $limit
    `;

        const results = await queryGraph(query, { nodeId, limit });

        const nodes = new Map();
        const edges = new Set();

        results.forEach(record => {
            const path = record.path;
            const segments = path.segments || [];

            segments.forEach(segment => {
                const start = segment.start;
                const end = segment.end;
                const relationship = segment.relationship;

                // Add nodes
                if (!nodes.has(start.properties.id)) {
                    nodes.set(start.properties.id, {
                        id: start.properties.id,
                        label: start.properties.name || start.properties.title || start.properties.id,
                        type: start.labels[0],
                        properties: start.properties,
                    });
                }

                if (!nodes.has(end.properties.id)) {
                    nodes.set(end.properties.id, {
                        id: end.properties.id,
                        label: end.properties.name || end.properties.title || end.properties.id,
                        type: end.labels[0],
                        properties: end.properties,
                    });
                }

                // Add edge
                const edgeKey = `${start.properties.id}_${end.properties.id}`;
                if (!edges.has(edgeKey)) {
                    edges.add({
                        source: start.properties.id,
                        target: end.properties.id,
                        type: relationship.type,
                        properties: relationship.properties,
                    });
                }
            });
        });

        return {
            nodes: Array.from(nodes.values()),
            edges: Array.from(edges),
        };
    } catch (error) {
        logger.error('Error getting node subgraph:', error);
        return { nodes: [], edges: [] };
    }
}

// Get concept details with related concepts
async function getConceptDetails(conceptName, limit = 10) {
    try {
        const { getNodeById, getRelatedNodes, queryGraph } = await import('../storage/graph-client.js');
        const conceptId = `concept_${conceptName.toLowerCase().replace(/\s+/g, '_')}`;

        // Get concept node
        const concept = await getNodeById(conceptId, 'Concept');
        if (!concept) {
            return null;
        }

        // Get related concepts
        const related = await getRelatedNodes(conceptId, 'Concept', 'RELATED_TO', limit);

        // Get activities that learned this concept
        const activities = await queryGraph('MATCH_ACTIVITIES_FOR_CONCEPT', { conceptId });

        return {
            concept: {
                id: concept.properties.id,
                name: concept.properties.name,
                label: concept.properties.label,
                confidence: concept.properties.confidence,
            },
            related: related.map(r => ({
                name: r.node.properties.name,
                relationshipType: r.relationshipType,
                similarity: r.relationship.properties?.similarity || 0,
            })),
            activities: activities.map(a => ({
                id: a.a.properties.id,
                title: a.a.properties.title,
                source_type: a.a.properties.source_type,
                timestamp: a.a.properties.timestamp,
            })),
        };
    } catch (error) {
        logger.error('Error getting concept details:', error);
        return null;
    }
}

export {
    getVisualizationData,
    getTopicData,
    getNodeSubgraph,
    getConceptDetails,
};