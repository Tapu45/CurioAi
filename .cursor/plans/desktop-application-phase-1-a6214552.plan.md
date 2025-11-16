<!-- a6214552-9bec-4d25-8e6a-06601c0d36ed 9b9684f5-de09-4156-ada9-382200c4e3ba -->
# Desktop Application Phase 1 - Complete Implementation Plan

## Overview

Build the full desktop application with all core features: activity tracking, content extraction, local AI summarization, embedding generation, knowledge graph building, and user control panel.

## Folder Structure

### Desktop Application Root (`desktop/`)

```
desktop/
├── package.json                    # Updated with all dependencies
├── electron-builder.json          # Build configuration
├── .env.example                    # Environment variables template
├── README.md                       # Desktop app documentation
│
├── src/
│   ├── main/                       # Electron main process
│   │   ├── main.js                 # Main entry point, app lifecycle
│   │   ├── preload.js              # Preload script for security
│   │   │
│   │   ├── services/               # Background services
│   │   │   ├── activity-tracker.js      # Window monitoring with active-win
│   │   │   ├── content-extractor.js     # Browser/PDF content extraction
│   │   │   ├── file-watcher.js          # PDF watcher with chokidar
│   │   │   ├── ai-service-client.js      # FastAPI client for local AI
│   │   │   ├── database-service.js      # SQLite operations
│   │   │   ├── graph-builder.js         # Knowledge graph construction
│   │   │   └── sync-service.js          # Optional cloud sync
│   │   │
│   │   ├── storage/                 # Local storage layer
│   │   │   ├── sqlite-db.js             # SQLite connection & queries
│   │   │   ├── chromadb-client.js       # ChromaDB vector store
│   │   │   └── neo4j-client.js          # Neo4j graph database
│   │   │
│   │   ├── extractors/              # Content extraction modules
│   │   │   ├── browser-extractor.js     # Puppeteer for web content
│   │   │   ├── pdf-extractor.js         # pdf-parse for PDFs
│   │   │   ├── youtube-extractor.js     # YouTube transcript extraction
│   │   │   ├── code-extractor.js        # IDE/code activity detection
│   │   │   └── text-processor.js        # Text cleaning & normalization
│   │   │
│   │   ├── filters/                 # Activity filtering
│   │   │   ├── whitelist-manager.js     # Learning domain whitelist
│   │   │   ├── activity-classifier.js   # Classify learning vs entertainment
│   │   │   └── privacy-filters.js        # PII removal, anonymization
│   │   │
│   │   ├── ipc/                     # IPC handlers
│   │   │   ├── channels.js              # IPC channel definitions
│   │   │   ├── handlers.js              # Request handlers
│   │   │   └── activity-handlers.js      # Activity-related IPC
│   │   │
│   │   ├── windows/                 # Window management
│   │   │   ├── main-window.js           # Main app window
│   │   │   ├── splash-window.js         # Splash screen
│   │   │   └── tray-manager.js          # System tray setup
│   │   │
│   │   ├── menu/                    # Menu system
│   │   │   ├── application-menu.js     # App menu
│   │   │   └── tray-menu.js             # Tray context menu
│   │   │
│   │   ├── updater/                 # Auto-update
│   │   │   └── auto-updater.js          # Update logic
│   │   │
│   │   └── utils/                   # Utilities
│   │       ├── notifications.js         # System notifications
│   │       ├── shortcuts.js             # Keyboard shortcuts
│   │       ├── logger.js                # Logging utility
│   │       └── config-manager.js        # Configuration management
│   │
│   ├── renderer/                    # React UI (Tray & Settings)
│   │   ├── index.js                 # React entry point
│   │   ├── App.js                   # Main React component
│   │   │
│   │   ├── components/
│   │   │   ├── tray/                     # Tray UI components
│   │   │   │   ├── TrayWindow.js          # Main tray window
│   │   │   │   ├── StatusIndicator.js     # Active/paused status
│   │   │   │   ├── ActivityCounter.js     # Today's capture count
│   │   │   │   └── QuickActions.js        # Pause/resume buttons
│   │   │   │
│   │   │   ├── settings/                  # Settings UI
│   │   │   │   ├── SettingsWindow.js      # Settings main window
│   │   │   │   ├── PrivacySettings.js     # Privacy controls
│   │   │   │   ├── TrackingSettings.js    # App/domain whitelist
│   │   │   │   ├── SyncSettings.js        # Cloud sync toggle
│   │   │   │   └── StorageSettings.js     # Storage management
│   │   │   │
│   │   │   ├── graph/                     # Graph visualization
│   │   │   │   ├── GraphViewer.js         # Basic graph display
│   │   │   │   └── NodeDetails.js         # Concept details panel
│   │   │   │
│   │   │   └── common/                    # Shared components
│   │   │       ├── Button/
│   │   │       ├── Input/
│   │   │       ├── Modal/
│   │   │       └── Loader/
│   │   │
│   │   ├── hooks/                   # React hooks
│   │   │   ├── useElectron.js            # Electron IPC hook
│   │   │   ├── useActivity.js            # Activity data hook
│   │   │   ├── useSettings.js            # Settings hook
│   │   │   └── useLocalStorage.js        # Local storage hook
│   │   │
│   │   ├── services/                # Frontend services
│   │   │   ├── electron-ipc.js           # IPC communication
│   │   │   ├── activity-service.js       # Activity API
│   │   │   └── settings-service.js       # Settings API
│   │   │
│   │   ├── store/                   # State management
│   │   │   ├── store.js                  # Zustand store
│   │   │   └── slices/
│   │   │       ├── activitySlice.js      # Activity state
│   │   │       ├── settingsSlice.js      # Settings state
│   │   │       └── graphSlice.js         # Graph state
│   │   │
│   │   ├── styles/                  # Stylesheets
│   │   │   ├── globals.css
│   │   │   ├── variables.css
│   │   │   └── tray.css
│   │   │
│   │   └── utils/                   # Frontend utilities
│   │       ├── constants.js
│   │       ├── formatters.js
│   │       └── validators.js
│   │
│   └── shared/                     # Shared code
│       ├── constants.js                 # Shared constants
│       ├── types.ts                     # TypeScript types
│       └── schemas.js                   # Data schemas
│
├── local-ai-service/               # Python FastAPI service
│   ├── requirements.txt            # Python dependencies
│   ├── Dockerfile                  # Container config
│   ├── .env.example                # Environment template
│   │
│   ├── src/
│   │   ├── main.py                 # FastAPI app entry
│   │   ├── config.py               # Configuration
│   │   │
│   │   ├── api/                    # API routes
│   │   │   ├── routes.py                # Main routes
│   │   │   ├── schemas.py               # Pydantic models
│   │   │   └── dependencies.py          # Route dependencies
│   │   │
│   │   ├── services/               # Business logic
│   │   │   ├── summarizer.py            # LLM summarization
│   │   │   ├── embedding.py             # Embedding generation
│   │   │   ├── concept_extractor.py     # NER & concept extraction
│   │   │   └── ollama_client.py         # Ollama integration
│   │   │
│   │   ├── models/                 # AI models
│   │   │   ├── llm_handler.py           # LLM abstraction
│   │   │   ├── embeddings.py            # sentence-transformers
│   │   │   └── nlp.py                   # spaCy NER
│   │   │
│   │   ├── prompts/                # Prompt templates
│   │   │   ├── summarization.py         # Summary prompts
│   │   │   ├── concept_extraction.py    # Concept prompts
│   │   │   └── graph_relationships.py    # Relationship prompts
│   │   │
│   │   └── utils/                  # Utilities
│   │       ├── logger.py
│   │       └── helpers.py
│   │
│   └── tests/                      # Python tests
│       ├── test_summarizer.py
│       └── test_embeddings.py
│
├── data/                           # Local data storage
│   ├── sqlite/                     # SQLite database files
│   │   └── curioai.db
│   ├── chromadb/                   # ChromaDB data
│   └── neo4j/                      # Neo4j data
│
├── config/                         # Configuration files
│   ├── whitelist.json              # Learning domain whitelist
│   ├── app-config.json             # App configuration
│   └── privacy-config.json         # Privacy settings
│
├── build/                          # Build artifacts
│   ├── entitlements.mac.plist      # macOS entitlements
│   └── notarize.js                 # macOS notarization
│
└── tests/                          # Desktop app tests
    ├── unit/
    ├── integration/
    └── e2e/
```

## Implementation Phases

### Phase 1.1: Core Infrastructure (Week 1-2)

- Set up Electron main process with proper lifecycle
- Configure IPC channels and handlers
- Set up SQLite database with schema
- Create configuration management system
- Implement basic logging and error handling

### Phase 1.2: Activity Tracking (Week 3-4)

- Implement active-win window detection
- Create activity classifier (learning vs entertainment)
- Build whitelist manager for domains/apps
- Set up activity monitoring loop (60s interval)
- Store raw activities in SQLite

### Phase 1.3: Content Extraction (Week 5-6)

- Browser content extraction with Puppeteer
- PDF extraction with pdf-parse
- YouTube transcript extraction
- Code/IDE activity detection
- Text cleaning and normalization

### Phase 1.4: Local AI Service (Week 7-8)

- Set up Python FastAPI service
- Integrate Ollama for local LLM
- Implement summarization service
- Add embedding generation (sentence-transformers)
- Concept extraction with spaCy NER
- Connect Electron to FastAPI service

### Phase 1.5: Storage Layer (Week 9-10)

- ChromaDB integration for vector storage
- Neo4j Lite setup for knowledge graph
- Database service layer in Electron
- Embedding storage and retrieval
- Graph node/edge storage

### Phase 1.6: Knowledge Graph Builder (Week 11-12)

- Implement graph building algorithm
- Cosine similarity for node relationships
- NetworkX for graph operations
- Periodic graph updates (30 min)
- Graph visualization preparation

### Phase 1.7: Tray UI & Controls (Week 13-14)

- React tray window implementation
- Status indicators (active/paused)
- Activity counter display
- Settings window (privacy, tracking, sync)
- Pause/resume functionality
- Data export features

### Phase 1.8: Polish & Testing (Week 15-16)

- Error handling and recovery
- Performance optimization
- Unit and integration tests
- User documentation
- Beta release preparation

## Key Dependencies

### Electron Main Process

- `electron`: ^39.1.1
- `active-win`: Window detection
- `chokidar`: File watching
- `puppeteer-core`: Browser automation
- `pdf-parse`: PDF extraction
- `better-sqlite3`: SQLite database
- `axios`: HTTP client for AI service
- `node-cron`: Scheduled tasks

### Python AI Service

- `fastapi`: Web framework
- `uvicorn`: ASGI server
- `ollama`: Local LLM client
- `sentence-transformers`: Embeddings
- `spacy`: NLP and NER
- `pydantic`: Data validation
- `python-dotenv`: Environment variables

### React Renderer

- `react`: ^19.2.0
- `react-dom`: ^19.2.0
- `zustand`: State management
- `tailwindcss`: Styling
- `lucide-react`: Icons

## Database Schemas

### SQLite (activities, summaries, embeddings)

- activities: id, url, title, content, timestamp, source_type, app_name
- summaries: id, activity_id, summary_text, key_concepts, complexity, sentiment
- embeddings: id, summary_id, vector, model_version

### ChromaDB Collections

- knowledge_base: documents, metadatas, embeddings

### Neo4j Graph

- Nodes: Topic, Concept, Activity
- Relationships: RELATED_TO, LEARNED_FROM, CONNECTS

## Configuration Files

### whitelist.json

Learning domains and apps to track (YouTube, Medium, dev.to, Wikipedia, arXiv, etc.)

### app-config.json

Tracking intervals, storage limits, AI model preferences

### privacy-config.json

Privacy settings, PII filters, sync preferences

## Critical Implementation Notes

1. **Activity Tracker**: Runs in background, checks every 60s, filters by whitelist
2. **Content Extractor**: Handles different sources (browser, PDF, YouTube, code)
3. **AI Service**: Local FastAPI on port 8000, communicates via HTTP
4. **Storage**: All data local-first, optional encrypted sync
5. **Tray UI**: Minimal React app, shows status and quick controls
6. **Privacy**: User can pause anytime, blacklist domains, export/delete data

## Success Criteria

- Activity tracking captures learning content automatically
- Content extraction works for browsers, PDFs, YouTube
- Local AI service generates summaries and embeddings
- Knowledge graph builds relationships between concepts
- Tray UI provides full user control
- All data stored locally with optional sync
- Performance: <5% CPU, <200MB memory

### To-dos

- [ ] Set up Electron main process with lifecycle management, IPC channels, and window management
- [ ] Create SQLite schema and database service layer for activities, summaries, and embeddings
- [ ] Implement activity tracking with active-win, activity classifier, and whitelist manager
- [ ] Build content extractors for browsers (Puppeteer), PDFs (pdf-parse), YouTube transcripts, and code activity
- [ ] Create Python FastAPI service with Ollama integration, summarization, embeddings, and concept extraction
- [ ] Integrate ChromaDB for vectors and Neo4j Lite for knowledge graph storage
- [ ] Implement knowledge graph builder with cosine similarity, NetworkX, and periodic updates
- [ ] Build React tray UI with status indicators, activity counter, settings window, and pause/resume controls
- [ ] Connect all components: activity tracker → content extraction → AI service → storage → graph builder
- [ ] Add error handling, performance optimization, unit tests, and prepare for beta release