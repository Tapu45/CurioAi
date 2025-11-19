import Graph from 'graphology';
import { sql } from 'drizzle-orm';
import { getDatabase } from './sqlite-db.js';
import { graphNodes, graphEdges } from './schema.js';
import logger from '../utils/logger.js';

let graph = null;
let isInitialized = false;

// Initialize graph from SQLite
async function initializeGraph() {
    try {
        graph = new Graph();
        const db = getDatabase();

        // Load nodes from SQLite
        const nodes = await db.select().from(graphNodes);
        for (const node of nodes) {
            const properties = node.properties ? JSON.parse(node.properties) : {};
            graph.addNode(node.id, {
                label: node.label,
                name: node.name,
                title: node.title,
                ...properties,
            });
        }

        // Load edges from SQLite
        const edges = await db.select().from(graphEdges);
        for (const edge of edges) {
            const properties = edge.properties ? JSON.parse(edge.properties) : {};
            if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
                graph.addEdge(edge.source, edge.target, {
                    type: edge.type,
                    ...properties,
                });
            }
        }

        isInitialized = true;
        logger.info(`Graph initialized with ${graph.order} nodes and ${graph.size} edges`);
        return graph;
    } catch (error) {
        logger.error('Failed to initialize graph:', error);
        throw error;
    }
}

// Get graph instance
function getGraph() {
    if (!graph) {
        throw new Error('Graph not initialized. Call initializeGraph() first.');
    }
    return graph;
}

// Check if graph is initialized
function checkConnection() {
    return Promise.resolve(isInitialized && graph !== null);
}

// Save node to SQLite
async function saveNodeToDB(nodeId, label, properties) {
    const db = getDatabase();
    const { name, title, ...rest } = properties;

    await db
        .insert(graphNodes)
        .values({
            id: nodeId,
            label,
            name: name || null,
            title: title || null,
            properties: JSON.stringify(rest),
            updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
            target: graphNodes.id,
            set: {
                label,
                name: name || null,
                title: title || null,
                properties: JSON.stringify(rest),
                updatedAt: new Date().toISOString(),
            },
        });
}

// Save edge to SQLite
async function saveEdgeToDB(source, target, type, properties = {}) {
    const db = getDatabase();

    // Check if edge already exists
    const existing = await db
        .select()
        .from(graphEdges)
        .where(
            sql`${graphEdges.source} = ${source} AND ${graphEdges.target} = ${target} AND ${graphEdges.type} = ${type}`
        )
        .limit(1);

    if (existing.length === 0) {
        await db.insert(graphEdges).values({
            source,
            target,
            type,
            properties: JSON.stringify(properties),
        });
    }
}

// Create node
async function createNode(nodeData) {
    try {
        const { label, properties } = nodeData;
        const nodeId = properties.id;

        if (!nodeId) {
            throw new Error('Node must have an id property');
        }

        const graph = getGraph();

        // Check if node already exists
        if (graph.hasNode(nodeId)) {
            logger.debug(`Node already exists: ${nodeId}, skipping creation`);
            // Return existing node
            const existingNode = graph.getNodeAttributes(nodeId);
            return { properties: { id: nodeId, label, ...existingNode } };
        }

        // Add to in-memory graph
        graph.addNode(nodeId, {
            label,
            ...properties,
        });

        // Save to SQLite
        await saveNodeToDB(nodeId, label, properties);

        logger.info(`Node created: ${label} - ${properties.name || properties.id}`);
        return { properties: { id: nodeId, label, ...properties } };
    } catch (error) {
        // If it's a "node already exists" error from graphology, handle gracefully
        if (error.message && error.message.includes('already exist')) {
            logger.debug(`Node already exists in graph: ${nodeData.properties.id}`);
            const graph = getGraph();
            const existingNode = graph.getNodeAttributes(nodeData.properties.id);
            return { properties: { id: nodeData.properties.id, label: nodeData.label, ...existingNode } };
        }
        logger.error('Error creating node:', error);
        throw error;
    }
}

// Create relationship
async function createRelationship(relData) {
    try {
        const { fromId, toId, relationshipType, properties = {} } = relData;

        const graph = getGraph();

        if (!graph.hasNode(fromId) || !graph.hasNode(toId)) {
            throw new Error(`Nodes ${fromId} or ${toId} do not exist`);
        }

        // Add to in-memory graph
        graph.addEdge(fromId, toId, {
            type: relationshipType,
            ...properties,
        });

        // Save to SQLite
        await saveEdgeToDB(fromId, toId, relationshipType, properties);

        logger.info(`Relationship created: ${fromId} -[${relationshipType}]-> ${toId}`);
        return { properties: { type: relationshipType, ...properties } };
    } catch (error) {
        logger.error('Error creating relationship:', error);
        throw error;
    }
}

// Get node by ID
async function getNodeById(id, label) {
    try {
        const graph = getGraph();

        if (!graph.hasNode(id)) {
            return null;
        }

        const nodeData = graph.getNodeAttributes(id);
        if (label && nodeData.label !== label) {
            return null;
        }

        return { properties: { id, ...nodeData } };
    } catch (error) {
        logger.error('Error getting node:', error);
        return null;
    }
}

// Get related nodes
async function getRelatedNodes(nodeId, label, relationshipType = null, limit = 10) {
    try {
        const graph = getGraph();

        if (!graph.hasNode(nodeId)) {
            return [];
        }

        const neighbors = graph.neighbors(nodeId);
        const results = [];

        for (const neighborId of neighbors) {
            if (results.length >= limit) break;

            const edge = graph.getEdgeAttributes(
                graph.edge(nodeId, neighborId) || graph.edge(neighborId, nodeId)
            );

            if (relationshipType && edge.type !== relationshipType) {
                continue;
            }

            const neighborData = graph.getNodeAttributes(neighborId);
            if (label && neighborData.label !== label) {
                continue;
            }

            results.push({
                node: { properties: { id: neighborId, ...neighborData } },
                relationship: { properties: edge },
                relationshipType: edge.type,
            });
        }

        return results;
    } catch (error) {
        logger.error('Error getting related nodes:', error);
        return [];
    }
}

// Update node
async function updateNode(id, label, properties) {
    try {
        const graph = getGraph();

        if (!graph.hasNode(id)) {
            throw new Error(`Node ${id} does not exist`);
        }

        // Update in-memory graph
        graph.mergeNodeAttributes(id, properties);

        // Update in SQLite
        await saveNodeToDB(id, label, { ...graph.getNodeAttributes(id), ...properties });

        logger.info(`Node updated: ${label} - ${id}`);
        return { properties: { id, ...graph.getNodeAttributes(id) } };
    } catch (error) {
        logger.error('Error updating node:', error);
        throw error;
    }
}

// Delete node
async function deleteNode(id, label) {
    try {
        const graph = getGraph();

        if (!graph.hasNode(id)) {
            return false;
        }

        // Delete from in-memory graph (cascades edges)
        graph.dropNode(id);

        // Delete from SQLite (cascade handled by foreign key)
        const db = getDatabase();
        await db.delete(graphNodes).where(sql`${graphNodes.id} = ${id}`);

        logger.info(`Node deleted: ${label} - ${id}`);
        return true;
    } catch (error) {
        logger.error('Error deleting node:', error);
        return false;
    }
}

// Query graph (simplified - replaces Cypher queries)
async function queryGraph(queryType, parameters = {}) {
    try {
        const graph = getGraph();

        // Handle different query patterns
        if (queryType === 'MATCH_ACTIVITY_CONCEPTS') {
            const { activityId } = parameters;
            const results = [];

            if (graph.hasNode(activityId)) {
                const neighbors = graph.neighbors(activityId);
                for (const neighborId of neighbors) {
                    const edge = graph.getEdgeAttributes(
                        graph.edge(activityId, neighborId) || graph.edge(neighborId, activityId)
                    );
                    if (edge.type === 'LEARNED_FROM') {
                        const neighborData = graph.getNodeAttributes(neighborId);
                        results.push({
                            a: { properties: { id: activityId, ...graph.getNodeAttributes(activityId) } },
                            r: { properties: edge },
                            c: { properties: { id: neighborId, ...neighborData } },
                        });
                    }
                }
            }

            return results;
        }

        if (queryType === 'MATCH_ALL_RELATIONSHIPS') {
            const { limit = 200 } = parameters;
            const results = [];
            let count = 0;

            graph.forEachEdge((edge, attrs, source, target) => {
                if (count >= limit) return;
                results.push({
                    a: { properties: { id: source, ...graph.getNodeAttributes(source) } },
                    r: { properties: attrs },
                    b: { properties: { id: target, ...graph.getNodeAttributes(target) } },
                    labelA: graph.getNodeAttribute(source, 'label'),
                    labelB: graph.getNodeAttribute(target, 'label'),
                    relType: attrs.type,
                });
                count++;
            });

            return results;
        }

        if (queryType === 'MATCH_CONCEPTS') {
            const results = [];
            graph.forEachNode((nodeId, attrs) => {
                if (attrs.label === 'Concept') {
                    results.push({
                        id: nodeId,
                        name: attrs.name,
                    });
                }
            });
            return results;
        }

        if (queryType === 'MATCH_ACTIVITIES_FOR_CONCEPT') {
            const { conceptId } = parameters;
            const results = [];

            if (graph.hasNode(conceptId)) {
                const neighbors = graph.neighbors(conceptId);
                for (const neighborId of neighbors) {
                    const edge = graph.getEdgeAttributes(
                        graph.edge(conceptId, neighborId) || graph.edge(neighborId, conceptId)
                    );
                    if (edge.type === 'LEARNED_FROM') {
                        const neighborData = graph.getNodeAttributes(neighborId);
                        if (neighborData.label === 'Activity') {
                            results.push({ activityId: neighborId });
                        }
                    }
                }
            }

            return results;
        }

        if (queryType === 'MATCH_TOPIC_CONCEPTS') {
            const { topicId } = parameters;
            const results = [];

            if (graph.hasNode(topicId)) {
                const neighbors = graph.neighbors(topicId);
                for (const neighborId of neighbors) {
                    const edge = graph.getEdgeAttributes(
                        graph.edge(topicId, neighborId) || graph.edge(neighborId, topicId)
                    );
                    if (edge.type === 'CONTAINS') {
                        const neighborData = graph.getNodeAttributes(neighborId);
                        results.push({ concepts: [neighborData.name] });
                    }
                }
            }

            return results;
        }

        if (queryType === 'MATCH_ACTIVITY_CONCEPT') {
            const { activityId } = parameters;
            const results = [];

            if (graph.hasNode(activityId)) {
                const neighbors = graph.neighbors(activityId);
                for (const neighborId of neighbors) {
                    const edge = graph.getEdgeAttributes(
                        graph.edge(activityId, neighborId) || graph.edge(neighborId, activityId)
                    );
                    if (edge.type === 'LEARNED_FROM') {
                        results.push({ conceptId: neighborId });
                    }
                }
            }

            return results;
        }

        if (queryType === 'MATCH_ALL_NODES') {
            const results = [];
            graph.forEachNode((nodeId, attrs) => {
                results.push({
                    label: attrs.label,
                    count: 1, // Will be aggregated
                });
            });
            return results;
        }

        if (queryType === 'MATCH_ALL_EDGES') {
            const results = [];
            graph.forEachEdge((edge, attrs) => {
                results.push({
                    label: attrs.type,
                    count: 1, // Will be aggregated
                });
            });
            return results;
        }

        if (queryType === 'MATCH_TOPICS_WITH_CONCEPTS') {
            const results = [];
            graph.forEachNode((nodeId, attrs) => {
                if (attrs.label === 'Topic') {
                    const neighbors = graph.neighbors(nodeId);
                    const concepts = [];
                    for (const neighborId of neighbors) {
                        const edge = graph.getEdgeAttributes(
                            graph.edge(nodeId, neighborId) || graph.edge(neighborId, nodeId)
                        );
                        if (edge.type === 'CONTAINS') {
                            const neighborData = graph.getNodeAttributes(neighborId);
                            if (neighborData.name) {
                                concepts.push(neighborData.name);
                            }
                        }
                    }
                    results.push({
                        topicId: nodeId,
                        topicName: attrs.name || `Topic ${nodeId}`,
                        concepts,
                    });
                }
            });
            return results;
        }

        if (queryType === 'MATCH_ACTIVITIES_FOR_CONCEPT') {
            const { conceptId } = parameters;
            const results = [];

            if (graph.hasNode(conceptId)) {
                const neighbors = graph.neighbors(conceptId);
                for (const neighborId of neighbors) {
                    const edge = graph.getEdgeAttributes(
                        graph.edge(conceptId, neighborId) || graph.edge(neighborId, conceptId)
                    );
                    if (edge.type === 'LEARNED_FROM') {
                        const neighborData = graph.getNodeAttributes(neighborId);
                        if (neighborData.label === 'Activity') {
                            results.push({
                                a: {
                                    properties: {
                                        id: neighborId,
                                        title: neighborData.title || neighborData.name,
                                        source_type: neighborData.source_type,
                                        timestamp: neighborData.timestamp,
                                        ...neighborData,
                                    },
                                },
                            });
                        }
                    }
                }
            }

            return results;
        }

        if (queryType === 'MATCH_LEARNED_FROM') {
            const { conceptId, activityType } = parameters;
            const results = [];

            if (graph.hasNode(conceptId)) {
                const neighbors = graph.neighbors(conceptId);
                for (const neighborId of neighbors) {
                    const edge = graph.getEdgeAttributes(
                        graph.edge(conceptId, neighborId) || graph.edge(neighborId, conceptId)
                    );
                    if (edge.type === 'WATCHED' || edge.type === 'READ') {
                        const neighborData = graph.getNodeAttributes(neighborId);
                        if (neighborData.label === 'Activity') {
                            if (!activityType || activityType.includes(neighborData.activity_type)) {
                                results.push({
                                    activityId: neighborId,
                                    relationshipType: edge.type,
                                });
                            }
                        }
                    }
                }
            }

            return results;
        }

        if (queryType === 'MATCH_APPLIED') {
            const { conceptId } = parameters;
            const results = [];

            if (graph.hasNode(conceptId)) {
                const neighbors = graph.neighbors(conceptId);
                for (const neighborId of neighbors) {
                    const edge = graph.getEdgeAttributes(
                        graph.edge(conceptId, neighborId) || graph.edge(neighborId, conceptId)
                    );
                    if (edge.type === 'APPLIED') {
                        const neighborData = graph.getNodeAttributes(neighborId);
                        if (neighborData.label === 'Activity') {
                            results.push({
                                activityId: neighborId,
                                timestamp: neighborData.timestamp,
                            });
                        }
                    }
                }
            }

            return results;
        }

        if (queryType === 'MATCH_PROJECT_ACTIVITIES') {
            const { projectId } = parameters;
            const results = [];

            if (graph.hasNode(projectId)) {
                const neighbors = graph.neighbors(projectId);
                for (const neighborId of neighbors) {
                    const edge = graph.getEdgeAttributes(
                        graph.edge(projectId, neighborId) || graph.edge(neighborId, projectId)
                    );
                    if (edge.type === 'WORKED_ON') {
                        const neighborData = graph.getNodeAttributes(neighborId);
                        if (neighborData.label === 'Activity') {
                            results.push({
                                activityId: neighborId,
                                timestamp: neighborData.timestamp,
                            });
                        }
                    }
                }
            }

            return results;
        }

        return [];
    } catch (error) {
        logger.error('Error querying graph:', error);
        return [];
    }
}

// Get graph statistics
async function getGraphStats() {
    try {
        const graph = getGraph();
        const stats = {
            nodes: {},
            relationships: {},
        };

        graph.forEachNode((nodeId, attrs) => {
            const label = attrs.label || 'Unknown';
            stats.nodes[label] = (stats.nodes[label] || 0) + 1;
        });

        graph.forEachEdge((edge, attrs) => {
            const type = attrs.type || 'Unknown';
            stats.relationships[type] = (stats.relationships[type] || 0) + 1;
        });

        return stats;
    } catch (error) {
        logger.error('Error getting graph stats:', error);
        return { nodes: {}, relationships: {} };
    }
}

// Clear all graph data
async function clearGraph() {
    try {
        if (!graph) {
            await initializeGraph();
        }
        // Clear all nodes and edges
        graph.clear();
        // Also clear from SQLite if you're persisting there
        const client = getDatabase().client;
        await client.execute(`DELETE FROM graph_edges`);
        await client.execute(`DELETE FROM graph_nodes`);
        logger.info('Graph cleared');
        return { success: true };
    } catch (error) {
        logger.error('Error clearing graph:', error);
        throw error;
    }
}

// Close graph (save any pending changes)
async function closeGraph() {
    try {
        // Graph is in-memory, no cleanup needed
        graph = null;
        isInitialized = false;
        logger.info('Graph closed');
    } catch (error) {
        logger.error('Error closing graph:', error);
    }
}

export {
    initializeGraph,
    checkConnection,
    createNode,
    createRelationship,
    getNodeById,
    getRelatedNodes,
    updateNode,
    deleteNode,
    queryGraph,
    getGraphStats,
    closeGraph,
    clearGraph,
};