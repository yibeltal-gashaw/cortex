# Antigravity Conversation Tracker & Inspector

A local developer tool and visual dashboard for inspecting, searching, analyzing, and managing historical Google Antigravity IDE agent conversations, transcripts, and artifacts.

![Antigravity Tracker](client/public/favicon.svg)

---

## 🚀 Overview & Architecture

Antigravity Conversation Tracker connects directly to your local Antigravity IDE App Data directory (`~/.gemini/antigravity-ide` on Linux/macOS or `%USERPROFILE%\.gemini\antigravity-ide` on Windows) to parse:
1. **Transcripts & Logs (`brain/<conversation-id>/.system_generated/logs/`):**
   - `transcript.jsonl`: Step-by-step stream of user prompts, agent reasoning, tool calls, and outputs.
   - `transcript_full.jsonl`: Untruncated full payload log.
2. **Artifacts (`brain/<conversation-id>/`):**
   - `implementation_plan.md`: Planning mode design documents.
   - `walkthrough.md`: Verification walkthrough summaries.
   - `scratch/`: Scratch scripts and temporary files created by the agent.
   - `.user_uploaded/`: Images, screenshots, and assets attached by the user.
   - `.system_generated/tasks/`: Logs for background tasks (`task-*.log`).
3. **Database State (`conversations/<conversation-id>.db`):**
   - Built-in SQLite database inspector using Node 24 native `node:sqlite` (`DatabaseSync`).

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Start Application
```bash
npm run dev
```
- **Backend API:** `http://127.0.0.1:3050`
- **Frontend Dashboard:** `http://127.0.0.1:5201`

---

## ✨ Features

- **Conversation Explorer (Sidebar):**
  - Instant full-text search across user prompts, project names, and session UUIDs.
  - Workspace / Project dropdown filter (auto-detected from prompt metadata and paths).
  - Quick badges for total steps, implementation plan, walkthrough, database cache, and relative timestamps.
- **Session Header & Environment Snapshot:**
  - One-click copy for full Conversation UUID.
  - Metrics: Model version (e.g. Gemini 3.7 Flash), execution duration, start time, total steps.
  - Expandable Environment Snapshot showing active document, cursor line, open editor tabs, and running terminal commands with runtimes.
- **Chronological Timeline & Tool Flow:**
  - Filter by All Steps, User Requests, Thinking, Tool Calls, or Responses.
  - Collapsible **Model Reasoning** accordion with markdown rendering and word count.
  - **Terminal Commands (`run_command`):** Monospace shell card with CWD, exit code badges, stdout/stderr copy button.
  - **File Edits (`replace_file_content` / `write_to_file`):** Unified and side-by-side split diff viewer with green additions and red deletions.
  - **File Views (`view_file`):** Line numbers and syntax viewer.
  - **Web Searches (`search_web` / `read_url_content`):** Query strings and retrieved markdown snippets.
- **Artifacts & Files Viewer:**
  - Interactive file tree for `brain/<id>/`.
  - Rendered GitHub-flavored markdown viewer for `implementation_plan.md` and `walkthrough.md`.
  - Image gallery with lightbox zoom for `.user_uploaded/` images.
  - Output log viewer for background tasks (`task-*.log`).
- **Database Inspector:**
  - Connects to `conversations/<id>.db` using native `node:sqlite`.
  - Table schema viewer (columns, data types, primary keys).
  - Paginated data grid with BLOB inspector (hex dump and ASCII preview).
- **Security & Privacy:**
  - **Credential Scanner:** Scans user inputs and terminal outputs for API keys, tokens, and passwords with alert tags.
  - **Permanent Deletion:** Safe two-step confirmation modal requiring typing `DELETE` to permanently erase `brain/<id>/` and `conversations/<id>.db`.
- **Custom Configuration:**
  - Settings dialog to view or switch custom Antigravity data directory (`ANTIGRAVITY_DATA_DIR`).

---

## 🛠 Tech Stack

- **Backend:** Node.js v24 (Express, `node:sqlite`, native filesystem streaming)
- **Frontend:** React 18, TypeScript, Vite, Vanilla CSS / CSS Modules
- **Design:** Modern developer dark theme (`#080c14`, `#0f172a`, `#1e293b`), glassmorphism, Inter & JetBrains Mono typography.
- **Diff & Markdown:** `diff` (jsdiff), `marked` (GitHub Flavored Markdown), `lucide-react` icons.
