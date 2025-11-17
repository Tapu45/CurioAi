<!-- b58b503d-c13f-45e7-9dc7-6a4c7caac6a8 1a1a08e8-bd5f-4c93-afac-71de8db010b3 -->
# CurioAI Desktop - Complete Production Plan

## Current Status Assessment

**Completed (Phases 1.1-1.8):**

- Basic Electron infrastructure
- Activity tracking (window monitoring)
- Content extraction (browser, PDF, YouTube)
- Local AI service (Python FastAPI)
- SQLite storage
- Basic UI components (Main, Chat, Graph, History pages)
- System tray and shortcuts

**Needs Implementation:**

- LanceDB migration (from ChromaDB)
- Comprehensive file system monitoring
- Multi-format document processing
- Full RAG pipeline with LangChain
- Memory/context management
- Performance optimization
- SaaS-ready features

---

## Phase 2.1: Vector Store Migration to LanceDB (Week 1-2)

### Technology Stack

- **LanceDB**: `lancedb@^0.4.0` - Embedded vector database
- **Migration Script**: Custom migration utility

### Implementation Steps

1. **Install Dependencies**
   ```bash
   npm install lancedb
   npm remove chromadb  # After migration
   ```

2. **Create LanceDB Client** (`src/main/storage/lancedb-client.js`)

   - Initialize LanceDB with local path: `{userData}/data/lancedb`
   - Create/connect to table: `knowledge_base`
   - Implement embedding storage with metadata
   - Add similarity search with filters

3. **Migration Script** (`src/main/storage/migrate-chroma-to-lance.js`)

   - Export all embeddings from ChromaDB
   - Transform to LanceDB format
   - Import with metadata preservation
   - Verify data integrity

4. **Update Services**

   - Replace ChromaDB calls in `database-service.js`
   - Update `search-service.js` to use LanceDB
   - Update `graph-builder.js` for vector queries

5. **Testing**

   - Unit tests for LanceDB operations
   - Migration verification
   - Performance benchmarks

### Folder Structure

```
src/main/storage/
  ├── lancedb-client.js          # NEW: LanceDB client
  ├── migrate-chroma-to-lance.js # NEW: Migration script
  └── chromadb-client.js         # DEPRECATED (remove after migration)
```

---

## Phase 2.2: Comprehensive File System Monitoring (Week 3-4)

### Technology Stack

- **chokidar**: `^4.0.3` (keep) - File watching
- **fast-glob**: `^3.3.1` - Efficient file scanning
- **mime-types**: `^2.1.35` - File type detection
- **file-type**: `^19.0.0` - Binary file detection
- **sharp**: `^0.32.6` - Image processing
- **tesseract.js**: `^5.0.4` - OCR

### Implementation Steps

1. **Enhanced File Watcher** (`src/main/services/file-watcher.js` - enhance existing)

   - Monitor: Documents, Downloads, Desktop, custom paths
   - Watch for: create, update, delete events
   - Batch processing (avoid overwhelming system)
   - Configurable exclusions (node_modules, .git, etc.)

2. **File Type Router** (`src/main/services/file-processor.js` - NEW)

   - Route files by MIME type
   - Support formats:
     - Documents: PDF, DOCX, XLSX, PPTX, TXT, MD
     - Images: JPG, PNG, GIF, WEBP (with OCR)
     - Code: All common languages
     - Audio/Video: MP3, MP4 (optional, Phase 3)

3. **Document Extractors** (enhance `src/main/extractors/`)

   - `docx-extractor.js` - Using `mammoth@^1.6.0`
   - `xlsx-extractor.js` - Using `xlsx@^0.18.5`
   - `pptx-extractor.js` - Using `officegen` or `mammoth`
   - `image-extractor.js` - Using `sharp` + `tesseract.js`
   - `code-extractor.js` - Enhance existing with `tree-sitter` (optional)

4. **File Indexing Service** (`src/main/services/file-indexer.js` - NEW)

   - Hash-based deduplication
   - Incremental indexing
   - Metadata extraction
   - Chunking for large files

5. **Database Schema Updates** (`src/main/storage/schema.js`)
   ```javascript
   // Add files table
   export const files = sqliteTable('files', {
     id: integer('id').primaryKey({ autoIncrement: true }),
     path: text('path').notNull().unique(),
     name: text('name').notNull(),
     type: text('type').notNull(), // 'pdf', 'docx', 'image', etc.
     mimeType: text('mime_type'),
     size: integer('size'),
     hash: text('hash'), // SHA-256 for deduplication
     extractedText: text('extracted_text'),
     metadata: text('metadata'), // JSON
     processedAt: text('processed_at'),
     createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
   });
   
   // Add file_chunks table
   export const fileChunks = sqliteTable('file_chunks', {
     id: integer('id').primaryKey({ autoIncrement: true }),
     fileId: integer('file_id').references(() => files.id),
     chunkIndex: integer('chunk_index'),
     content: text('content').notNull(),
     embedding: text('embedding'), // JSON array
     metadata: text('metadata'), // JSON
     createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
   });
   ```


### Folder Structure

```
src/main/
  ├── extractors/
  │   ├── docx-extractor.js      # NEW
  │   ├── xlsx-extractor.js       # NEW
  │   ├── pptx-extractor.js       # NEW
  │   ├── image-extractor.js      # NEW
  │   └── [existing extractors]
  ├── services/
  │   ├── file-processor.js       # NEW: File type router
  │   ├── file-indexer.js         # NEW: Indexing service
  │   └── file-watcher.js          # ENHANCE: Existing
```

---

## Phase 2.3: RAG Pipeline with LangChain (Week 5-6)

### Technology Stack

- **LangChain.js**: `@langchain/core@^0.1.0`, `langchain@^0.1.0`
- **LangChain Community**: `@langchain/community@^0.0.20`
- **Memory Management**: Built-in LangChain memory classes

### Implementation Steps

1. **Install LangChain Dependencies**
   ```bash
   npm install @langchain/core @langchain/openai @langchain/community langchain
   ```

2. **LanceDB Integration with LangChain** (`src/main/services/rag-service.js` - NEW)

   - Create `LanceDBVectorStore` wrapper
   - Implement document loader
   - Add retriever with metadata filtering
   - Configure similarity search parameters

3. **Memory Management** (`src/main/services/memory-manager.js` - NEW)

   - `ConversationBufferMemory` - Short-term (last 10 messages)
   - `ConversationSummaryMemory` - Long-term (compressed)
   - `VectorStoreRetrieverMemory` - Semantic memory retrieval
   - `EntityMemory` - Track user preferences/entities

4. **RAG Chain Implementation** (`src/main/services/rag-chain.js` - NEW)
   ```javascript
   // RAG Pipeline Flow:
   // 1. User Query → Embedding
   // 2. Vector Search (LanceDB) → Top K chunks
   // 3. Context Assembly → Include metadata
   // 4. LLM Generation (Ollama/GPT) → Response with citations
   // 5. Memory Update → Store conversation
   ```

5. **Chat Service Enhancement** (`src/main/services/chat-service.js` - enhance)

   - Integrate RAG chain
   - Add streaming responses
   - Implement citation tracking
   - Add confidence scores

6. **Python AI Service Updates** (`src/local-ai-service/`)

   - Add RAG endpoint: `/api/v1/rag/query`
   - Support streaming responses
   - Add context window management

### Folder Structure

```
src/main/services/
  ├── rag-service.js              # NEW: RAG pipeline
  ├── rag-chain.js                # NEW: LangChain chain
  ├── memory-manager.js            # NEW: Memory management
  └── chat-service.js              # ENHANCE: Existing
```

---

## Phase 2.4: Lightweight AI Model Selection (Week 7)

### Model Recommendations (Low-End System Friendly)

**Embedding Models:**

- **Primary**: `all-MiniLM-L6-v2` (22MB, 384-dim) - Current, keep
- **Alternative**: `all-mpnet-base-v2` (420MB, 768-dim) - Better quality, optional

**LLM Models (Ollama):**

- **Tier 1 (Low-end)**: `phi3:mini` (2.3GB) - Fast, 3.8B params
- **Tier 2 (Mid-range)**: `llama3.2:1b` (1.3GB) - Very fast, 1B params
- **Tier 3 (High-end)**: `llama3.2:3b` (2GB) - Balanced
- **Tier 4 (Premium)**: `mistral:7b` (4.1GB) - Best quality

**NLP Models:**

- **spaCy**: `en_core_web_sm` (12MB) - Current, keep
- **Alternative**: `en_core_web_md` (40MB) - Better NER, optional

### Implementation Steps

1. **Model Manager** (`src/main/services/model-manager.js` - NEW)

   - Detect system resources (RAM, CPU)
   - Auto-select appropriate model tier
   - Allow manual override in settings
   - Download models on-demand

2. **Python AI Service Updates**

   - Add model selection endpoint
   - Implement model caching
   - Add resource monitoring
   - Graceful degradation

3. **Settings UI** (`src/renderer/src/pages/Settings/`)

   - Model selection dropdown
   - System resource display
   - Performance vs Quality slider

### Configuration

```javascript
// src/main/utils/model-config.js
export const MODEL_TIERS = {
  LOW_END: {
    embedding: 'all-MiniLM-L6-v2',
    llm: 'phi3:mini',
    nlp: 'en_core_web_sm',
    minRAM: 4, // GB
  },
  MID_RANGE: {
    embedding: 'all-MiniLM-L6-v2',
    llm: 'llama3.2:1b',
    nlp: 'en_core_web_sm',
    minRAM: 8,
  },
  HIGH_END: {
    embedding: 'all-mpnet-base-v2',
    llm: 'llama3.2:3b',
    nlp: 'en_core_web_md',
    minRAM: 16,
  },
};
```

---

## Phase 2.5: Enhanced UI Components (Week 8-9)

### Implementation Steps

1. **Today Dashboard Enhancement** (`src/renderer/src/pages/Main/`)

   - Real-time activity feed
   - File indexing progress
   - Quick stats (files indexed, conversations, graph nodes)
   - Recent searches/queries

2. **File Browser** (`src/renderer/src/pages/Files/` - NEW)

   - List all indexed files
   - Filter by type, date, size
   - Preview extracted content
   - Quick search within files

3. **Enhanced Chat UI** (`src/renderer/src/pages/Chat/`)

   - Streaming response display
   - Citation links (clickable)
   - Conversation history sidebar
   - Export conversation

4. **Graph Visualization** (`src/renderer/src/pages/Graph/`)

   - Interactive force-directed layout
   - Node clustering
   - Search and filter nodes
   - Export graph as image/JSON

5. **Settings Overhaul** (`src/renderer/src/pages/Settings/`)

   - File monitoring paths
   - Model selection
   - Performance settings
   - Privacy controls
   - Export/Import data

### Technologies

- **React**: Keep existing
- **Zustand**: State management (existing)
- **Framer Motion**: Animations (existing)
- **React Virtual**: Virtual scrolling for large lists
- **D3.js** or **Cytoscape.js**: Graph visualization

---

## Phase 2.6: Performance Optimization (Week 10-11)

### Optimization Targets

| Metric | Target | Strategy |

|--------|--------|----------|

| App Size | <150MB | Code splitting, tree-shaking |

| Startup Time | <3s | Lazy loading, preload |

| Memory Usage | <500MB | Efficient chunking, cleanup |

| File Indexing | 1000 files/min | Batch processing, workers |

| Chat Response | <2s | Caching, optimized RAG |

| Vector Search | <100ms | Indexed queries, limits |

### Implementation Steps

1. **Build Optimization** (`electron.vite.config.ts`)
   ```typescript
   export default defineConfig({
     build: {
       rollupOptions: {
         output: {
           manualChunks: {
             'vendor': ['react', 'react-dom'],
             'langchain': ['@langchain/core', '@langchain/openai'],
             'vector': ['lancedb'],
           }
         }
       },
       chunkSizeWarningLimit: 1000,
       minify: 'terser',
       terserOptions: {
         compress: {
           drop_console: true,
         }
       }
     }
   })
   ```

2. **Code Splitting** (React)

   - Lazy load heavy components
   - Route-based code splitting
   - Dynamic imports for extractors

3. **Database Optimization**

   - Add indexes on frequently queried columns
   - Implement connection pooling
   - Batch insert operations

4. **Worker Threads** (`src/main/workers/` - NEW)

   - File processing workers
   - Embedding generation workers
   - Background indexing

5. **Caching Strategy**

   - Embedding cache (avoid re-computation)
   - Query result cache
   - Model response cache

### Folder Structure

```
src/main/workers/
  ├── file-processor-worker.js    # NEW: File processing
  ├── embedding-worker.js         # NEW: Embedding generation
  └── indexer-worker.js            # NEW: Background indexing
```

---

## Phase 2.7: SaaS-Ready Features (Week 12-13)

### Implementation Steps

1. **Analytics (Privacy-Respecting)** (`src/main/services/analytics.js` - NEW)

   - Local-only analytics
   - Optional opt-in cloud analytics
   - No PII collection
   - Usage metrics (features used, performance)

2. **Error Tracking** (`src/main/services/error-tracker.js` - NEW)

   - Sentry integration (optional)
   - Local error logging
   - Crash reporting
   - Performance monitoring

3. **Auto-Updates** (`src/main/updater/auto-updater.js` - enhance existing)

   - Check for updates
   - Background downloads
   - Update notifications
   - Rollback capability

4. **License Management** (`src/main/services/license-manager.js` - NEW)

   - Free/Pro/Enterprise tiers
   - Feature gating
   - License validation
   - Trial period management

5. **Telemetry** (`src/main/services/telemetry.js` - NEW)

   - Feature usage tracking
   - Performance metrics
   - Error rates
   - User feedback collection

6. **Onboarding Flow** (`src/renderer/src/pages/Onboarding/` - enhance)

   - First-time setup wizard
   - Model selection guide
   - Privacy settings
   - Feature tour

### Folder Structure

```
src/main/services/
  ├── analytics.js                 # NEW
  ├── error-tracker.js             # NEW
  ├── license-manager.js           # NEW
  └── telemetry.js                 # NEW
```

---

## Phase 2.8: Testing & Quality Assurance (Week 14)

### Testing Strategy

1. **Unit Tests** (`tests/unit/`)

   - Service layer tests
   - Utility function tests
   - Database operation tests

2. **Integration Tests** (`tests/integration/`)

   - IPC communication
   - File processing pipeline
   - RAG pipeline end-to-end

3. **E2E Tests** (`tests/e2e/`)

   - User flows (Playwright)
   - Window interactions
   - File indexing scenarios

4. **Performance Tests** (`tests/performance/`)

   - Load testing
   - Memory leak detection
   - Startup time benchmarks

### Technologies

- **Jest**: Unit testing
- **Playwright**: E2E testing
- **k6**: Performance testing

---

## Complete Folder Structure

```
desktop/
├── src/
│   ├── main/
│   │   ├── extractors/
│   │   │   ├── browser-extractor.js
│   │   │   ├── code-extractor.js
│   │   │   ├── pdf-extractor.js
│   │   │   ├── docx-extractor.js          # NEW
│   │   │   ├── xlsx-extractor.js          # NEW
│   │   │   ├── pptx-extractor.js          # NEW
│   │   │   ├── image-extractor.js         # NEW
│   │   │   ├── text-processor.js
│   │   │   └── youtube-extractor.js
│   │   ├── filters/
│   │   │   ├── activity-classifier.js
│   │   │   ├── privacy-filters.js
│   │   │   └── whitelist-manager.js
│   │   ├── ipc/
│   │   │   ├── channels.js
│   │   │   └── handlers.js                 # ENHANCE
│   │   ├── menu/
│   │   │   └── application-menu.js
│   │   ├── services/
│   │   │   ├── activity-tracker.js
│   │   │   ├── ai-service-client.js
│   │   │   ├── chat-service.js             # ENHANCE
│   │   │   ├── content-extractor.js
│   │   │   ├── database-service.js          # ENHANCE
│   │   │   ├── file-watcher.js              # ENHANCE
│   │   │   ├── file-processor.js            # NEW
│   │   │   ├── file-indexer.js              # NEW
│   │   │   ├── graph-builder.js
│   │   │   ├── graph-scheduler.js
│   │   │   ├── graph-visualization.js
│   │   │   ├── rag-service.js               # NEW
│   │   │   ├── rag-chain.js                 # NEW
│   │   │   ├── memory-manager.js            # NEW
│   │   │   ├── model-manager.js             # NEW
│   │   │   ├── search-service.js             # ENHANCE
│   │   │   ├── analytics.js                 # NEW
│   │   │   ├── error-tracker.js             # NEW
│   │   │   ├── license-manager.js           # NEW
│   │   │   └── telemetry.js                 # NEW
│   │   ├── storage/
│   │   │   ├── schema.js                    # ENHANCE
│   │   │   ├── sqlite-db.js
│   │   │   ├── lancedb-client.js            # NEW
│   │   │   ├── migrate-chroma-to-lance.js   # NEW
│   │   │   ├── graph-client.js
│   │   │   └── chat-history.js
│   │   ├── updater/
│   │   │   └── auto-updater.js               # ENHANCE
│   │   ├── utils/
│   │   │   ├── config-manager.js
│   │   │   ├── logger.js
│   │   │   ├── model-config.js               # NEW
│   │   │   ├── notifications.js
│   │   │   └── shortcuts.js
│   │   ├── workers/
│   │   │   ├── file-processor-worker.js     # NEW
│   │   │   ├── embedding-worker.js          # NEW
│   │   │   └── indexer-worker.js            # NEW
│   │   ├── windows/
│   │   │   ├── main-window.js
│   │   │   ├── splash-window.js
│   │   │   └── tray-manager.js
│   │   └── index.ts
│   ├── renderer/
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── Main/
│   │       │   ├── Chat/                     # ENHANCE
│   │       │   ├── Graph/                    # ENHANCE
│   │       │   ├── History/
│   │       │   ├── Search/
│   │       │   ├── Files/                    # NEW
│   │       │   ├── Settings/                 # ENHANCE
│   │       │   └── Onboarding/               # ENHANCE
│   │       └── [existing structure]
│   └── local-ai-service/
│       └── src/
│           ├── api/
│           │   ├── routes.py                 # ENHANCE
│           │   └── schemas.py               # ENHANCE
│           ├── services/
│           │   ├── rag_service.py           # NEW
│           │   ├── model_manager.py          # NEW
│           │   └── [existing services]
│           └── [existing structure]
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── performance/
└── [config files]
```

---

## Updated Dependencies

### package.json Additions

```json
{
  "dependencies": {
    // Vector Database
    "lancedb": "^0.4.0",
    
    // File Processing
    "mammoth": "^1.6.0",
    "xlsx": "^0.18.5",
    "sharp": "^0.32.6",
    "tesseract.js": "^5.0.4",
    "file-type": "^19.0.0",
    "mime-types": "^2.1.35",
    "fast-glob": "^3.3.1",
    
    // RAG & AI
    "@langchain/core": "^0.1.0",
    "@langchain/openai": "^0.0.14",
    "@langchain/community": "^0.0.20",
    "langchain": "^0.1.0",
    
    // UI
    "react-virtual": "^2.10.4",
    "d3": "^7.8.5",
    
    // Analytics & Monitoring
    "@sentry/electron": "^4.15.0",
    
    // Keep existing dependencies...
  }
}
```

### Python requirements.txt Additions

```txt
# RAG & Memory
langchain==0.1.0
langchain-community==0.0.10
langchain-ollama==0.0.1

# Document Processing
python-docx==1.1.0
openpyxl==3.1.2
PyPDF2==3.0.1
markdown==3.5.1
beautifulsoup4==4.12.2

# Image Processing
pillow==10.1.0
pytesseract==0.3.10
opencv-python==4.8.1.78

# Keep existing dependencies...
```

---

## Performance Benchmarks

### Target Metrics

- **App Size**: <150MB (compressed)
- **Startup**: <3 seconds
- **Memory**: <500MB idle, <1GB active
- **File Indexing**: 1000 files/minute
- **Vector Search**: <100ms for 10K vectors
- **Chat Response**: <2 seconds (local LLM)

---

## SaaS Features Checklist

- [ ] License management (Free/Pro/Enterprise)
- [ ] Feature gating
- [ ] Analytics (privacy-respecting)
- [ ] Error tracking (Sentry)
- [ ] Auto-updates
- [ ] Telemetry
- [ ] Onboarding flow
- [ ] Usage limits enforcement
- [ ] Trial period management
- [ ] Payment integration (future phase)

---

## Next Steps After This Plan

1. **Phase 3**: Cloud sync (optional)
2. **Phase 4**: Web dashboard
3. **Phase 5**: Mobile apps
4. **Phase 6**: Team collaboration
5. **Phase 7**: API marketplace

### To-dos

- [ ] Migrate from ChromaDB to LanceDB: create lancedb-client.js, migration script, update all services
- [ ] Implement comprehensive file system monitoring: enhance file-watcher, add file-processor router, create file-indexer service
- [ ] Add document extractors: docx-extractor, xlsx-extractor, pptx-extractor, image-extractor with OCR
- [ ] Implement RAG pipeline with LangChain: rag-service, rag-chain, memory-manager, enhance chat-service
- [ ] Add model manager with tiered selection (phi3:mini for low-end, llama3.2:1b for mid-range), auto-detection
- [ ] Enhance UI components: Today dashboard, File browser page, improved Chat with streaming, Graph visualization, Settings overhaul
- [ ] Optimize performance: build config, code splitting, worker threads, caching, database indexes
- [ ] Add SaaS-ready features: analytics, error tracking, license manager, telemetry, auto-updates enhancement
- [ ] Implement testing: unit tests, integration tests, E2E tests with Playwright, performance benchmarks