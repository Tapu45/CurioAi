import { getDatabaseClient } from './sqlite-db.js';
import logger from '../utils/logger.js';

// Ensure chat_history table exists
async function ensureChatHistoryTable() {
    try {
        const client = getDatabaseClient();

        await client.execute(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        await client.execute(`
      CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at);
    `);

        logger.info('Chat history table ensured');
    } catch (error) {
        logger.error('Error ensuring chat history table:', error instanceof Error ? error : new Error(String(error)));
        throw error;
    }
}

// Insert chat message
async function insertChatMessage(messageData) {
    try {
        await ensureChatHistoryTable();
        const client = getDatabaseClient();

        const { role, content, metadata = null } = messageData;

        const result = await client.execute({
            sql: `
        INSERT INTO chat_history (role, content, metadata)
        VALUES (?, ?, ?)
      `,
            args: [role, content, metadata ? JSON.stringify(metadata) : null],
        });

        logger.debug(`Chat message stored: ${role} (ID: ${result.lastInsertRowid})`);
        return result.lastInsertRowid;
    } catch (error) {
        logger.error('Error inserting chat message:', error);
        throw error;
    }
}

// Get chat history
async function getChatHistory(limit = 50) {
    try {
        await ensureChatHistoryTable();
        const client = getDatabaseClient();

        const result = await client.execute({
            sql: `
        SELECT id, role, content, metadata, created_at
        FROM chat_history
        ORDER BY created_at DESC
        LIMIT ?
      `,
            args: [limit],
        });

        // Format results
        const messages = result.rows.map((row) => {
            let metadata = null;
            try {
                if (row.metadata) {
                    metadata = JSON.parse(row.metadata);
                }
            } catch (error) {
                logger.debug('Failed to parse chat message metadata:', error);
            }

            return {
                id: row.id,
                role: row.role,
                content: row.content,
                metadata,
                timestamp: row.created_at,
            };
        });

        // Reverse to get chronological order (oldest first)
        return messages.reverse();
    } catch (error) {
        logger.error('Error getting chat history:', error);
        throw error;
    }
}

// Clear chat history
async function clearChatHistory() {
    try {
        await ensureChatHistoryTable();
        const client = getDatabaseClient();

        await client.execute('DELETE FROM chat_history');
        logger.info('Chat history cleared');
        return true;
    } catch (error) {
        logger.error('Error clearing chat history:', error);
        throw error;
    }
}

export {
    ensureChatHistoryTable,
    insertChatMessage,
    getChatHistory,
    clearChatHistory,
};