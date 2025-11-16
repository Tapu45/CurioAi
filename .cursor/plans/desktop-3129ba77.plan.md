<!-- 3129ba77-9dc3-4847-ba57-c0de00a679e9 7a4bd499-fcca-45ae-a871-08aae9dbc8ae -->
# Desktop Application Phase 1 – Extended Local-Only UI Plan

## Overview

This extends the original desktop plan so that **all core interactions happen directly in the Electron app, fully local**, without any web backend or cloud sync required. The desktop app will provide:

- A rich **tray + main window UI** for status, history, search/chat, and graph exploration.
- **Local-only AI** for summarization, semantic search, and “Ask my data” chat via the Python FastAPI service.
- A **local knowledge graph viewer** powered by Neo4j, visualized in the React renderer.
- Full **privacy controls, export/delete flows, and performance polish** on the desktop.

Cloud sync and web UI remain optional **future phases** that only activate if the user explicitly enables sync.

---

## Existing Phases (Context)

These phases are already defined/implemented in the prior plan and remain the foundation:

### Phase 1.1: Core Infrastructure (Week 1–2)

- Electron main process with lifecycle management and preload script.
- IPC channels and handlers (`src/main/ipc/*`).
- SQLite setup (`activities`, `summaries`, `embeddings` tables) with `better-sqlite3`.
- Configuration management and logging utilities.

### Phase 1.2: Activity Tracking (Week 3–4)

- `active-win`-based window detection in the background.
- Activity classifier (learning vs entertainment) and whitelist manager.
- Periodic monitoring loop (e.g. every 60s) to capture learning-related activity.
- Raw activities stored in SQLite.

### Phase 1.3: Content Extraction (Week 5–6)

- Browser content extraction using Puppeteer (`browser-extractor`).
- PDF text extraction (`pdf-parse`) and optional file watcher for PDFs.
- YouTube transcript extraction and basic code/IDE activity extraction.
- Text cleaning and normalization utilities.

### Phase 1.4: Local AI Service (Week 7–8)

- Python FastAPI service (`local-ai-service`) with:
- Summarization via Ollama.
- Embedding generation via sentence-transformers.
- Concept extraction via spaCy NER.
- Electron AI client (`ai-service-client.js`) to call FastAPI.

### Phase 1.5: Storage Layer (Week 9–10)

- ChromaDB integration for local vector storage.
- Neo4j driver integration for local knowledge graph nodes/edges.
- Database service layer in Electron to orchestrate SQLite + ChromaDB + Neo4j.

### Phase 1.6: Knowledge Graph Builder (Week 11–12)

- Graph-building algorithms that:
- Compute cosine similarity between embeddings.
- Create `RELATED_TO`, `LEARNED_FROM`, `CONNECTS`, `CONTAINS` edges in Neo4j.
- Periodic graph updates (e.g. every 30 minutes) via a scheduler.
- Graph data preparation for visualization.

### Phase 1.7: Tray UI & Basic Controls (Week 13–14)

- System tray with status, pause/resume, and quick access to the main window.
- Minimal React UI for status (active/paused), today’s capture count, and privacy/settings entry point.

### Phase 1.8: Polish & Testing (Week 15–16)

- Error handling and recovery.
- Performance optimization (targeting <5% CPU, <200MB RAM).
- Unit and integration tests for core flows.
- User documentation and initial beta release.

---

## New Phases: Full Local Desktop UI (No Cloud/Web Required)

### Phase 1.9: Desktop Local Knowledge UI (Week 17–18)

Deliver a **rich main window** so users can understand and control CurioAI without ever leaving the desktop app.

- **Today Dashboard**
- Design and implement a "Today" view that surfaces:
- Current tracking status (Active/Paused/Idle).
- Last captured activity (title, app, source type, timestamp).
- Today’s capture count and quick stats.
- Implement this in the renderer using existing IPC (`activity:get-status`, `activity:get-today-count`).

- **Activity History List**
- Build a history page listing recent activities from SQLite via `db:get-activities`.
- Add filters (date range, source_type, app_name) and basic search by title/URL.
- Paginate or virtualize the list to stay performant with many rows.

- **Activity Detail View**
- On selecting a history item, show a detail panel including:
- Extracted content preview.
- AI-generated summary and key concepts (from `summaries` table).
- Links to related activities (using `findSimilarActivities`).
- Wire this to `db:get-summary` and any helper endpoints in the database service.

- **Local-Only Guarantee**
- All data for this UI must come from local SQLite/Chroma/Neo4j.
- If sync is disabled, no HTTP calls to any external host are made; only localhost FastAPI is used.

### Phase 1.10: Local Search & “Ask My Data” Chat UI (Week 19–20)

Give users a powerful way to **search and converse** with their knowledge, entirely on-device.

- **Semantic Search UI**
- Add a global search bar (from the main window and/or a dedicated "Search" tab).
- Implement semantic search against ChromaDB via the local AI service:
- IPC handler to call FastAPI `/api/v1/embedding` or `/process` and then query Chroma.
- Results list showing matching summaries/topics with similarity scores.
- Add filters (time range, source type, concept tags) to refine results.

- **Local “Ask CurioAI” Chat Panel**
- Implement a chat-style UI in the renderer (simple message list + input).
- On user query:
- Call a local RAG endpoint (`/api/v1/process` or a dedicated chat route) on the FastAPI service.
- Retrieve relevant documents from local Chroma, then generate answer using Ollama.
- Display:
- Answer text.
- Cited activities/summaries (with links into the Activity Detail UI).
- Ensure all calls go to `http://127.0.0.1:8000` (local FastAPI) only; no cloud LLMs.

- **No-Cloud Behaviour**
- When sync is OFF, the chat/search UI should still work fully using only local stores.
- If the AI service is not running, display a clear “Local AI service offline” state with instructions.

### Phase 1.11: Local Graph Viewer & Concept Explorer (Week 21–22)

Create a **visual local knowledge graph** directly inside the Electron renderer, backed by Neo4j and Chroma.

- **Graph Visualization Page**
- Add a dedicated "Graph" page/tab in the main window.
- Implement a graph visualization (using a lightweight JS library or custom Canvas/SVG) that:
- Renders nodes for `Activity`, `Concept`, and `Topic`.
- Renders edges for `LEARNED_FROM`, `RELATED_TO`, `CONNECTS`, `CONTAINS`.
- Fetch data via IPC (`graph:get-visualization`) that wraps Neo4j queries.

- **Node & Edge Interactions**
- Clicking a **Concept** node opens a side panel:
- Concept name, label, confidence.
- Related concepts and their relationships (via `graph:get-concept-details`).
- Activities that contributed to this concept (with links into Activity Detail view).
- Clicking an **Activity** node highlights its connected concepts and offers a quick preview.

- **Controls & UX**
- Basic graph controls:
- Zoom, pan, focus on node.
- Toggle visibility of activity vs concept vs topic nodes.
- Limit nodes/edges for performance (e.g. top N by degree or recency).
- Visual cues aligning with SRS (clusters, color-coded types, edge strength by similarity).

- **Local-First Enforcement**
- All graph data is queried from the local Neo4j instance; no remote graph service.
- Fail gracefully (empty state + hints) if Neo4j is not running.

### Phase 1.12: Desktop UX Polish, Accessibility, and Power-User Features (Week 23–24)

Finalize the desktop experience as a **polished, standalone local product**, ready for a local-only beta.

- **Visual & UX Polish**
- Unify styling across:
- Today dashboard, History, Search/Chat, Graph, Settings.
- Add micro-interactions (hover states, subtle animations) that don’t hurt performance.
- Improve layout for small windows (tray-like) and larger desktop windows.

- **Keyboard Shortcuts & Power-User Flows**
- Implement global shortcuts (hooked to the existing `shortcuts.js`):
- Toggle tracking (Pause/Resume).
- Open main window.
- Open search / chat.
- Add quick actions from tray menu (e.g. "Open Graph", "Ask CurioAI").

- **Accessibility & Internationalization Basics**
- Ensure keyboard navigation works across key views.
- Add ARIA labels and alt text for major interactive elements.
- Make text sizes and contrast accessible per WCAG guidelines.

- **Data Export & Local Management**
- Implement export flows in Settings:
- Export activities/summaries/graph as JSON/CSV.
- Show approximate storage usage (SQLite + Chroma + Neo4j data directories).
- Implement local data deletion options (e.g. “Delete all data” with confirmation) that operate only on local stores.

- **Local-Only Beta Readiness**
- Run a full **desktop-only beta** focusing on:
- Stability of background tracking.
- Responsiveness of UI (especially graph and chat) under load.
- User understanding of privacy controls and "local-only" guarantees.
- Collect feedback for future **sync + web UI** phases, but do not enable cloud by default.

---

## Future Phases (Beyond This Plan)

Once the local desktop experience is solid, future phases can:

- Add **optional sync service** to push anonymized graph slices to a backend.
- Build a **web app** that reads from the synced graph for cross-device visualization and chat.
- Introduce **Pro/Enterprise features** (multi-device, team graphs) gated behind explicit sync and cloud usage.

These will be planned separately to preserve the strong **local-first, opt-in sync** model described in `curioai_srs.md`.

### To-dos

- [ ] Design and implement the local-only desktop dashboard (Today, History, Activity Detail) wired to SQLite via IPC
- [ ] Add semantic search and local RAG chat UI backed by the FastAPI AI service and ChromaDB
- [ ] Build the local graph viewer and concept explorer UI backed by Neo4j and graph IPC handlers
- [ ] Polish desktop UX (shortcuts, accessibility, export/delete flows) and prepare for a local-only beta