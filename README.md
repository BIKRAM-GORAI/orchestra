# Agent Orchestra 🎼

> **Autonomous Multi-Agent AI Orchestration Platform** with live interactive preview, multi-project workspace isolation, and human-in-the-loop minimal-change editing.

---

## 🌟 Overview

**Agent Orchestra** decomposes complex software engineering goals into specialized logical roles that collaborate under a **Manager Agent** to specify, design, architect, implement, verify, and iterate on complete single-page web applications.

```
                    ┌─────────────────────────┐
                    │       USER REQUEST      │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      MANAGER AGENT      │
                    │   (Plan & Agent Select) │
                    └────────────┬────────────┘
                                 │
                 ┌───────────────┼───────────────┐
                 ▼               ▼               ▼
          ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
          │   DESIGNER  │ │  FRONTEND   │ │   FEATURE   │
          │    AGENT    │ │  ARCHITECT  │ │  ARCHITECT  │
          │ (UI/UX, CSS)│ │(DOM, State) │ │ (Behavior)  │
          └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
                 │               │               │
                 └───────────────┼───────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    MANAGER SYNTHESIS    │
                    │ (Unified Implementation)│
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      CODING AGENT       │
                    │  (Generates index.html) │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │        QA AGENT         │
                    │   (Structured Audit)    │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │      LIVE PREVIEW       │
                    │   (Interactive iframe)  │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │     HUMAN FEEDBACK      │
                    │(Minimal Change Editing) │
                    └─────────────────────────┘
```

---

## 🏛️ Core Architectural Principles

### 1. Agents and Models Are Decoupled
- **Agents** are logical personas with specific skills, boundaries, and prompt contracts.
- **Models** are inference engines (`moonshotai/kimi-k3` via NVIDIA NIM).
- Agents never call provider endpoints directly. All inference flows through the centralized **Model Gateway**. Changing models requires zero rewrites to agents or orchestration logic.

### 2. Multi-Project Directory Isolation
- Every generated application resides in an isolated directory:
  ```text
  projects/
  ├── sports-ecommerce-1727623910-abcd/
  │   ├── index.html       <- Project website
  │   └── project.json     <- Metadata, specifications, QA audit, revision history
  └── boutique-store-1727623990-wxyz/
      ├── index.html
      └── project.json
  ```
- **Zero cross-contamination**: each project has its own revision history, specifications, and files.

### 3. Sole Implementation Ownership
- Only the **Coding Agent** generates or modifies `index.html`. No splitting of HTML/CSS/JS across different agents.

### 4. Minimal Change Preservation Rule (Human Feedback)
- Human feedback requests are routed directly to the Coding Agent with the existing `index.html` as the source of truth.
- The agent modifies **only** what was requested, strictly preserving all unrelated markup, styling, JavaScript, event handlers, IDs, and classes.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** v20+ or v24+
- **NVIDIA NIM API Key** for `moonshotai/kimi-k3`

### 2. Environment Setup
Create a `.env` file in the project root:
```env
PORT=3000
HOST=localhost
NVIDIA_API_KEY=your_nvidia_nim_api_key_here
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Automated Tests
```bash
npm test
```
*(Runs the complete test suite across Phases 0–7 in under 2 seconds).*

### 5. Launch the Platform
```bash
npm run dev
# or: npm start
```
Open **`http://localhost:3000`** in your browser.

---

## 🖥️ Dashboard Features

1. **Agent Registry & Playground (Left Panel)**: Real-time agent state indicators (`IDLE`, `WORKING`, `STREAMING`, `COMPLETED`, `RETRYING`, `ERROR`) with active pulse glow animations.
2. **Orchestration Flow & Pipeline (Center Panel)**:
   - 7-step visual execution pipeline.
   - Live streaming terminal log with timestamped progress.
   - Interactive QA Audit card displaying overall verdict and categorized findings.
3. **Live Preview & Human Feedback (Right Panel)**:
   - Sandboxed iframe with auto-reloading preview.
   - Viewport switcher: Desktop (100%), Tablet (768px), and Mobile (375px).
   - Project switcher dropdown to jump between isolated projects.
   - Direct-to-Coder Human Feedback card for targeted edits.

---

## 📡 REST & SSE API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Gateway & API key status check |
| `GET` | `/api/models` | Available model registry & retry policies |
| `GET` | `/api/agents` | All registered logical agents and assigned models |
| `POST` | `/api/agents/:id/model` | Dynamically reassign an agent's model |
| `GET` | `/api/projects` | List all isolated projects |
| `GET` | `/api/projects/:id` | Get project metadata & specifications |
| `GET` | `/api/projects/:id/preview` | Render project `index.html` |
| `POST` | `/api/orchestrate/spec` | Run Manager Plan -> Specialists -> Synthesis |
| `POST` | `/api/orchestrate/build` | Run Full End-to-End Build (Spec + Coding + QA) |
| `POST` | `/api/orchestrate/feedback` | Apply targeted human feedback edit |
| `GET` | `/api/orchestrate/events` | Real-time Server-Sent Events (SSE) stream |
