// src/main/storage/schema.js
import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';

// Activities table
export const activities = sqliteTable('activities', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    url: text('url'),
    title: text('title'),
    content: text('content'),
    timestamp: text('timestamp').default('CURRENT_TIMESTAMP'),
    sourceType: text('source_type').notNull(),
    appName: text('app_name'),
    windowTitle: text('window_title'),
    createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// Summaries table
export const summaries = sqliteTable('summaries', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    activityId: integer('activity_id').notNull().references(() => activities.id, {
        onDelete: 'cascade',
    }),
    summaryText: text('summary_text').notNull(),
    keyConcepts: text('key_concepts'),
    complexity: text('complexity'),
    sentiment: real('sentiment'),
    createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// Embeddings table
export const embeddings = sqliteTable('embeddings', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    summaryId: integer('summary_id').notNull().references(() => summaries.id, {
        onDelete: 'cascade',
    }),
    vector: text('vector'), // store JSON string instead of BLOB for simplicity
    modelVersion: text('model_version'),
    createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// Graph nodes table
export const graphNodes = sqliteTable('graph_nodes', {
    id: text('id').primaryKey(),
    label: text('label').notNull(), // 'Activity', 'Concept', 'Topic'
    name: text('name'),
    title: text('title'),
    properties: text('properties'), // JSON string
    createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// Graph edges table
export const graphEdges = sqliteTable('graph_edges', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source: text('source').notNull().references(() => graphNodes.id, { onDelete: 'cascade' }),
    target: text('target').notNull().references(() => graphNodes.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // 'LEARNED_FROM', 'RELATED_TO', 'CONNECTS', 'CONTAINS'
    properties: text('properties'), // JSON string
    createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const files = sqliteTable('files', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    path: text('path').notNull().unique(),
    name: text('name').notNull(),
    type: text('type').notNull(), // 'pdf', 'docx', 'image', 'code', etc.
    mimeType: text('mime_type'),
    size: integer('size'),
    hash: text('hash'), // SHA-256 for deduplication
    extractedText: text('extracted_text'),
    metadata: text('metadata'), // JSON string
    processedAt: text('processed_at'),
    createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
    updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// File chunks table
export const fileChunks = sqliteTable('file_chunks', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fileId: integer('file_id').notNull().references(() => files.id, {
        onDelete: 'cascade',
    }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    embedding: text('embedding'), // JSON string array
    metadata: text('metadata'), // JSON string
    createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

