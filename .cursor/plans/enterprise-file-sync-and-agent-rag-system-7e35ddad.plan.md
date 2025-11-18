<!-- 7e35ddad-2b13-4cab-bcb2-105c65e216f2 77e97d69-45f9-49c3-9773-5a30cf7a7703 -->
# Enterprise File Sync and Agent-RAG Hybrid System - Implementation Plan

## Technology Stack Overview

### New Dependencies to Add

**Node.js (Main Process):**

- `llamaindex` - Document loading and query engines
- `@langchain/community` - Additional LangChain tools
- `@langchain/core` - Core LangChain (already have)
- `bullmq` or `p-queue` - Job queue for file sync
- `pdfplumber` (via Python service) - Advanced PDF extraction
- `tabula-py` (via Python service) - Table extraction
- `easyocr` (via Python service) - Better OCR

**Python (AI Service):**

- `llama-index` - LlamaIndex Python package
- `llama-index-llms-ollama` - Ollama integration
- `llama-index-embeddings-huggingface` - Embedding models
- `easyocr` - Advanced OCR
- `pdfplumber` - PDF parsing
- `tabula-py` - Table extraction
- `pillow` - Image processing
- `opencv-python` - Image analysis

## Folder Structure Changes

### New Directories to Create

```
desktop/
├── src/
│   ├── main/
│   │   ├── services/
│   │   │   ├── sync/
│   │   │   │   ├── sync-manager.js          # Main sync orchestrator
│   │   │   │   ├── sync-queue.js            # Job queue management
│   │   │   │   ├── sync-progress.js         # Progress tracking
│   │   │   │   └── sync-config.js           # Configuration management
│   │   │   ├── agents/
│   │   │   │   ├── agent-manager.js         # Agent orchestration
│   │   │   │   ├── query-router.js          # Route simple vs complex queries
│   │   │   │   ├── react-agent.js           # ReAct agent implementation
│   │   │   │   └── tools/
│   │   │   │       ├── rag-search-tool.js   # RAG search tool
│   │   │   │       ├── file-search-tool.js  # File search tool
│   │   │   │       ├── image-analysis-tool.js # Image analysis tool
│   │   │   │       ├── structured-extraction-tool.js # Data extraction
│   │   │   │       ├── file-system-tool.js   # File system operations
│   │   │   │       └── deep-extraction-tool.js # On-demand extraction
│   │   │   ├── extraction/
│   │   │   │   ├── deep-extractor.js        # Deep content extraction
│   │   │   │   ├── structured-extractor.js  # Structured data extraction
│   │   │   │   ├── image-analyzer.js         # Image analysis service
│   │   │   │   └── table-extractor.js       # Table extraction
│   │   │   └── llamaindex/
│   │   │       ├── document-loader.js        # LlamaIndex document loaders
│   │   │       ├── query-engine.js           # Query engine setup
│   │   │       └── vector-store-adapter.js   # LanceDB adapter for LlamaIndex
│   │   ├── storage/
│   │   │   └── sync-schema.js               # Sync-related database schema
│   │   └── ipc/
│   │       └── sync-handlers.js              # IPC handlers for sync
│   ├── renderer/
│   │   └── src/
│   │       ├── pages/
│   │       │   └── Files/
│   │       │       ├── components/
│   │       │       │   ├── SyncToggle.jsx   # Master sync toggle
│   │       │       │   ├── PathManager.jsx   # Path configuration UI
│   │       │       │   ├── SyncProgress.jsx # Live progress display
│   │       │       │   ├── SyncStats.jsx    # Statistics display
│   │       │       │   └── PathConfigModal.jsx # Path configuration modal
│   │       │       └── hooks/
│   │       │           ├── useSyncStatus.js  # Sync status hook
│   │       │           └── useSyncProgress.js # Progress tracking hook
│   │       └── components/
│   │           └── features/
│   │               └── Chat/
│   │                   ├── components/
│   │                   │   ├── SourceFilter.jsx # Source type filter
│   │                   │   ├── QueryInput.jsx   # Enhanced query input
│   │                   │   └── AgentStatus.jsx # Agent reasoning display
│   │                   └── hooks/
│   │                       ├── useAgentChat.js  # Agent chat hook
│   │                       └── useQueryRouter.js # Query routing hook
│   └── local-ai-service/
│       └── src/
│           ├── services/
│           │   ├── vision/
│           │   │   ├── image_analyzer.py     # Image analysis service
│           │   │   ├── ocr_service.py        # OCR service (EasyOCR)
│           │   │   └── vision_model.py       # Vision model (LLaVA/BLIP)
│           │   ├── extraction/
│           │   │   ├── structured_extractor.py # Structured data extraction
│           │   │   ├── table_extractor.py    # Table extraction
│           │   │   └── form_extractor.py    # Form field extraction
│           │   └── llamaindex_service.py    # LlamaIndex integration
│           └── api/
│               └── routes.py                 # Enhanced with new endpoints
```

## Phase 1: File Sync Foundation (Week 1-2)

### Objectives

- Background sync service that runs independently
- Database schema for sync configuration and progress
- Basic IPC communication for sync control

### Implementation

**1.1 Database Schema (`src/main/storage/sync-schema.js`)**

- Create `sync_config` table: path, enabled, patterns, excluded_patterns, priority
- Create `sync_progress` table: file_path, status, progress_percentage, error_message
- Add indexes for performance

**1.2 Sync Configuration Service (`src/main/services/sync/sync-config.js`)**

- CRUD operations for sync paths
- Pattern management (include/exclude)
- Priority assignment
- Store in SQLite

**1.3 Sync Queue Manager (`src/main/services/sync/sync-queue.js`)**

- Use `p-queue` for job queue (lightweight, no Redis needed)
- Queue file indexing jobs
- Throttle concurrent processing (3-5 files max)
- Persist queue state to SQLite

**1.4 Sync Progress Tracker (`src/main/services/sync/sync-progress.js`)**

- Track per-file progress
- Calculate overall progress
- Store status updates
- Emit progress events via IPC

**1.5 Sync Manager (`src/main/services/sync/sync-manager.js`)**

- Orchestrate sync process
- Start/stop/pause/resume sync
- Handle errors gracefully
- Integrate with file-watcher and file-indexer

**1.6 IPC Handlers (`src/main/ipc/sync-handlers.js`)**

- `file:sync:start` - Start sync
- `file:sync:stop` - Stop sync
- `file:sync:status` - Get status
- `file:sync:config:get` - Get configuration
- `file:sync:config:update` - Update paths
- Event emitter for progress updates

### Technologies

- `p-queue` for job queue
- SQLite for persistence
- EventEmitter for progress updates

---

## Phase 2: File Sync UI (Week 2-3)

### Objectives

- User interface for sync management
- Real-time progress display
- Path configuration UI

### Implementation

**2.1 Sync Toggle Component (`src/renderer/src/pages/Files/components/SyncToggle.jsx`)**

- Master switch to enable/disable sync
- Visual indicator (on/off state)
- Connect to IPC handlers

**2.2 Path Manager Component (`src/renderer/src/pages/Files/components/PathManager.jsx`)**

- List of configured paths
- Add/remove/edit paths
- Enable/disable per path
- Show sync status per path

**2.3 Path Config Modal (`src/renderer/src/pages/Files/components/PathConfigModal.jsx`)**

- Add custom path dialog
- Pattern configuration (include/exclude)
- Recursive option
- Priority setting

**2.4 Sync Progress Component (`src/renderer/src/pages/Files/components/SyncProgress.jsx`)**

- Overall progress bar
- Current file being processed
- Per-path progress
- ETA calculation
- Real-time updates via IPC events

**2.5 Sync Stats Component (`src/renderer/src/pages/Files/components/SyncStats.jsx`)**

- Total files indexed
- Success/failed/skipped counts
- Last sync time
- Storage usage

**2.6 React Hooks**

- `useSyncStatus.js` - Subscribe to sync status
- `useSyncProgress.js` - Subscribe to progress updates
- Auto-refresh every 1-2 seconds

**2.7 Files Page Integration**

- Integrate all components into Files page
- Background sync indicator in status bar
- Notification system for completion

### Technologies

- React hooks for state management
- IPC event listeners
- Zustand store for global sync state

---

## Phase 3: Enhanced Content Extraction (Week 3-4)

### Objectives

- Deep extraction pipeline
- Structured data extraction
- Image analysis integration

### Implementation

**3.1 Deep Extractor Service (`src/main/services/extraction/deep-extractor.js`)**

- Orchestrate deep extraction
- Call Python service for heavy processing
- Store results in database
- Cache extraction results

**3.2 Structured Extractor (`src/main/services/extraction/structured-extractor.js`)**

- Extract tables, forms, key-value pairs
- Use Python service (pdfplumber, tabula-py)
- Store in `file_structured_data` table
- JSON format for flexibility

**3.3 Image Analyzer Service (`src/main/services/extraction/image-analyzer.js`)**

- Coordinate image analysis
- Call Python vision service
- OCR + scene description
- Store analysis results

**3.4 Table Extractor (`src/main/services/extraction/table-extractor.js`)**

- Extract tables from PDFs/Excel
- Convert to structured format
- Store as JSON

**3.5 Python Service Enhancements**

**3.5.1 Image Analysis Service (`src/local-ai-service/src/services/vision/image_analyzer.py`)**

- Use LLaVA or BLIP-2 via Ollama
- Scene description
- Object detection
- Text extraction from images

**3.5.2 OCR Service (`src/local-ai-service/src/services/vision/ocr_service.py`)**

- EasyOCR for better accuracy
- Multi-language support
- Confidence scoring

**3.5.3 Structured Extractor (`src/local-ai-service/src/services/extraction/structured_extractor.py`)**

- PDF form field extraction
- Key-value pair extraction
- Use LLM for structured output (JSON schema)

**3.5.4 Table Extractor (`src/local-ai-service/src/services/extraction/table_extractor.py`)**

- pdfplumber for PDF tables
- pandas for Excel tables
- Convert to JSON/CSV

**3.6 Database Schema Updates**

- `file_structured_data` table
- Add `structured_extracted` and `image_analyzed` flags to `files` table
- Add `source_type` column to `files` table

**3.7 Extraction Triggers**

- During indexing: lightweight extraction (text, basic metadata)
- On-demand: deep extraction when query requires it
- Scheduled: background job for important files

### Technologies

- EasyOCR for OCR
- pdfplumber for PDF parsing
- tabula-py for table extraction
- LLaVA/BLIP-2 for vision
- LLM with JSON schema for structured extraction

---

## Phase 4: LlamaIndex Integration (Week 4-5)

### Objectives

- Integrate LlamaIndex for document loading
- Create query engines
- Adapter for LanceDB

### Implementation

**4.1 Document Loader Service (`src/main/services/llamaindex/document-loader.js`)**

- Use LlamaIndex loaders for different file types
- PDF loader, image loader, text loader
- Convert to LlamaIndex Document format
- Preserve metadata

**4.2 Vector Store Adapter (`src/main/services/llamaindex/vector-store-adapter.js`)**

- Create LanceDB adapter for LlamaIndex
- Implement VectorStore interface
- Handle embeddings storage/retrieval
- Maintain compatibility with existing LanceDB setup

**4.3 Query Engine Setup (`src/main/services/llamaindex/query-engine.js`)**

- Create LlamaIndex query engines
- Retriever query engine for semantic search
- Router query engine for multi-source queries
- Response synthesizer configuration

**4.4 Python LlamaIndex Service (`src/local-ai-service/src/services/llamaindex_service.py`)**

- LlamaIndex Python integration
- Document loaders (PDF, images, text)
- Query engines with Ollama LLM
- Embedding integration (sentence-transformers)

**4.5 Integration with Existing RAG**

- Use LlamaIndex for document loading
- Keep LanceDB for vector storage
- Hybrid approach: LlamaIndex query engines + LanceDB vectors

### Technologies

- `llama-index` (Node.js)
- `llama-index` (Python)
- `llama-index-llms-ollama`
- `llama-index-embeddings-huggingface`

---

## Phase 5: Agent Foundation (Week 5-6)

### Objectives

- Query router (simple vs complex)
- Agent manager
- ReAct agent implementation
- Basic tool definitions

### Implementation

**5.1 Query Router (`src/main/services/agents/query-router.js`)**

- Classify query complexity
- Heuristics: length, keywords ("find", "need", "where"), intent detection
- Route to RAG (simple) or Agent (complex)
- LLM-based classification (optional, for accuracy)

**5.2 Agent Manager (`src/main/services/agents/agent-manager.js`)**

- Initialize and manage agents
- Tool registration
- Memory management
- Error handling

**5.3 ReAct Agent (`src/main/services/agents/react-agent.js`)**

- LangChain ReAct agent setup
- Tool calling mechanism
- Reasoning loop
- Response generation

**5.4 Tool Base Classes**

- Standard tool interface
- Error handling
- Result formatting
- Tool descriptions for agent

**5.5 Basic Tools Implementation**

**5.5.1 RAG Search Tool (`src/main/services/agents/tools/rag-search-tool.js`)**

- Wrap existing RAG chain
- Format results for agent
- Handle empty results

**5.5.2 File Search Tool (`src/main/services/agents/tools/file-search-tool.js`)**

- Search files by name, path, metadata
- Use SQLite queries
- Return file information

### Technologies

- LangChain ReAct agent
- `@langchain/core` for tool definitions
- Existing RAG chain as tool

---

## Phase 6: Advanced Agent Tools (Week 6-7)

### Objectives

- Complete tool suite
- Image analysis tool
- Structured extraction tool
- File system tool
- Deep extraction tool

### Implementation

**6.1 Image Analysis Tool (`src/main/services/agents/tools/image-analysis-tool.js`)**

- Accept image path or query
- Call Python vision service
- Return analysis results
- Handle multiple images

**6.2 Structured Extraction Tool (`src/main/services/agents/tools/structured-extraction-tool.js`)**

- Trigger deep extraction on-demand
- Extract specific data types (tables, forms, percentages)
- Use LLM for extraction with JSON schema
- Return structured data

**6.3 File System Tool (`src/main/services/agents/tools/file-system-tool.js`)**

- List files in directory
- Check file existence
- Get file metadata
- Navigate file system

**6.4 Deep Extraction Tool (`src/main/services/agents/tools/deep-extraction-tool.js`)**

- Trigger full content extraction
- Coordinate multiple extractors
- Cache results
- Return comprehensive data

**6.5 Tool Orchestration**

- Agent can chain multiple tools
- Handle tool failures gracefully
- Parallel tool execution where possible
- Result merging

### Technologies

- Python vision services
- Structured extraction services
- File system operations
- Caching layer

---

## Phase 7: Multi-Source Chat Filtering (Week 7-8)

### Objectives

- Source type filtering in chat
- Multi-source retrieval
- Enhanced chat UI

### Implementation

**7.1 Source Type Taxonomy**

- Define source types: workspace, activities, documents, images, code, all
- Tag embeddings with source_type in metadata
- Update file indexing to set source_type

**7.2 Enhanced RAG Chain**

- Accept source filters
- Build LanceDB filters from source selection
- Multi-source retrieval
- Merge results intelligently

**7.3 Chat Service Updates**

- Accept source filter parameter
- Pass to RAG chain or agent
- Handle "all" source type

**7.4 Frontend Components**

**7.4.1 Source Filter Component (`src/renderer/src/components/features/Chat/components/SourceFilter.jsx`)**

- Dropdown/multi-select for source types
- Default: "all"
- Visual indicators
- Persist user preference

**7.4.2 Enhanced Query Input (`src/renderer/src/components/features/Chat/components/QueryInput.jsx`)**

- Image upload support
- Source filter integration
- Query type detection

**7.5 Agent Tool Updates**

- Tools respect source filters
- Filter results by source_type
- Multi-source tool coordination

### Technologies

- Metadata filtering in LanceDB
- React multi-select components
- IPC parameter passing

---

## Phase 8: Advanced Query Handling & Polish (Week 8-9)

### Objectives

- Complex query examples working
- Performance optimization
- Error handling
- User experience polish

### Implementation

**8.1 Query Examples Implementation**

**8.1.1 "Where is my 10th class result image?"**

- Agent uses: File Search Tool → Image Analysis Tool
- Semantic search for "10th class result"
- Filter by image type
- Return file path + thumbnail

**8.1.2 "What is the % in my 10th according to document?"**

- Agent uses: RAG Search → Structured Extraction Tool
- Search for "10th percentage"
- If not found, trigger deep extraction
- Extract percentage from documents
- Return value + source

**8.2 Performance Optimizations**

- Tool result caching
- Parallel tool execution
- Lazy loading of heavy tools
- Timeout management
- Batch processing

**8.3 Error Handling**

- Graceful tool failures
- Fallback mechanisms
- User-friendly error messages
- Retry logic

**8.4 Agent Status Display (`src/renderer/src/components/features/Chat/components/AgentStatus.jsx`)**

- Show agent reasoning steps
- Tool usage visualization
- Progress indicators
- Confidence scores

**8.5 Memory Integration**

- Agent uses conversation memory
- Context from previous queries
- Entity tracking
- Long-term memory

**8.6 Testing & Validation**

- Test complex queries
- Performance benchmarking
- Accuracy validation
- User acceptance testing

### Technologies

- Caching (Redis-like or in-memory)
- Performance monitoring
- Error tracking
- User analytics

---

## Database Schema Additions

### New Tables

```sql
-- Sync configuration
CREATE TABLE sync_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,
  recursive BOOLEAN DEFAULT 1,
  patterns TEXT, -- JSON array
  excluded_patterns TEXT, -- JSON array
  priority INTEGER DEFAULT 0,
  last_sync DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sync progress
CREATE TABLE sync_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  status TEXT, -- 'pending', 'processing', 'completed', 'failed'
  progress_percentage INTEGER DEFAULT 0,
  error_message TEXT,
  started_at DATETIME,
  completed_at DATETIME,
  sync_config_id INTEGER,
  FOREIGN KEY (sync_config_id) REFERENCES sync_config(id)
);

-- Structured data
CREATE TABLE file_structured_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  data_type TEXT, -- 'table', 'form', 'key_value', 'list', 'percentage'
  extracted_data TEXT, -- JSON
  confidence REAL,
  extraction_method TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id)
);

-- Image analysis results
CREATE TABLE image_analysis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL,
  ocr_text TEXT,
  scene_description TEXT,
  objects_detected TEXT, -- JSON array
  confidence REAL,
  analysis_method TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (file_id) REFERENCES files(id)
);
```

### Schema Updates

```sql
-- Add columns to files table
ALTER TABLE files ADD COLUMN source_type TEXT DEFAULT 'workspace';
ALTER TABLE files ADD COLUMN structured_extracted BOOLEAN DEFAULT 0;
ALTER TABLE files ADD COLUMN image_analyzed BOOLEAN DEFAULT 0;

-- Add indexes
CREATE INDEX idx_files_source_type ON files(source_type);
CREATE INDEX idx_sync_progress_status ON sync_progress(status);
CREATE INDEX idx_file_structured_data_file_id ON file_structured_data(file_id);
```

---

## IPC Channels to Add

```javascript
// Sync channels
FILE: {
  SYNC_START: 'file:sync:start',
  SYNC_STOP: 'file:sync:stop',
  SYNC_PAUSE: 'file:sync:pause',
  SYNC_RESUME: 'file:sync:resume',
  SYNC_STATUS: 'file:sync:status',
  SYNC_PROGRESS: 'file:sync:progress', // Event
  SYNC_CONFIG_GET: 'file:sync:config:get',
  SYNC_CONFIG_UPDATE: 'file:sync:config:update',
  SYNC_CONFIG_ADD_PATH: 'file:sync:config:add-path',
  SYNC_CONFIG_REMOVE_PATH: 'file:sync:config:remove-path',
}

// Agent channels
AGENT: {
  CHAT: 'agent:chat',
  TOOL_EXECUTE: 'agent:tool:execute',
  STATUS: 'agent:status',
}
```

---

## Key Implementation Patterns

### 1. Hybrid Query Routing

```javascript
// Pseudo-code structure
if (isSimpleQuery(query)) {
  return await ragChain.invoke(query, { filters });
} else {
  return await agent.processQuery(query, { filters });
}
```

### 2. Agent Tool Pattern

```javascript
// Tool structure
{
  name: "tool_name",
  description: "What the tool does",
  parameters: { /* schema */ },
  execute: async (params) => { /* implementation */ }
}
```

### 3. Progress Tracking

```javascript
// Event-based progress
syncManager.on('progress', (progress) => {
  mainWindow.webContents.send('file:sync:progress', progress);
});
```

### 4. Extraction Pipeline

```javascript
// Lightweight during indexing
await indexFile(filePath, { deepExtraction: false });

// Deep extraction on-demand
if (needsDeepExtraction) {
  await deepExtractor.extract(fileId);
}
```

---

## Success Metrics

- **Performance**: Query response < 2s, sync < 1min per 100 files
- **Accuracy**: > 90% for fact extraction, > 85% query success rate
- **User Experience**: Non-blocking sync, real-time progress, intuitive UI
- **Reliability**: < 5% error rate, graceful error handling

---

## Risk Mitigation

- **Large Files**: Streaming, chunking, timeouts
- **Memory**: Batch processing, cleanup, resource limits
- **Performance**: Caching, parallel processing, lazy loading
- **Errors**: Retry logic, fallbacks, user notifications

### To-dos

- [ ] Phase 1: Implement file sync foundation - database schema, sync manager, queue system, IPC handlers
- [ ] Phase 2: Build file sync UI components - toggle, path manager, progress display, stats
- [ ] Phase 3: Enhanced content extraction - deep extractor, structured data, image analysis, Python services
- [ ] Phase 4: LlamaIndex integration - document loaders, query engines, vector store adapter
- [ ] Phase 5: Agent foundation - query router, agent manager, ReAct agent, basic tools
- [ ] Phase 6: Advanced agent tools - image analysis, structured extraction, file system, deep extraction tools
- [ ] Phase 7: Multi-source chat filtering - source type taxonomy, enhanced RAG, UI components
- [ ] Phase 8: Advanced query handling & polish - complex queries, performance optimization, error handling, UX polish