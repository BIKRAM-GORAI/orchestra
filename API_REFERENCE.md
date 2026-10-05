# 📡 OmniVerse (Agent Orchestra) API Reference

Welcome to the **OmniVerse REST and Streaming API** specification. This reference outlines all available endpoints, request/response formats, authentication, SSE streams, and error handling.

---

## 🌐 Base URL & Conventions

```
Development: http://localhost:3000
Production:  https://omni-verse-bywv.onrender.com
```

- **Content-Type**: `application/json` (except multipart file uploads)
- **Timeouts**: Long-running generation jobs stream events via Server-Sent Events (`text/event-stream`).
- **CORS Policy**: Same-origin enforcement on `/api/*` to isolate untrusted preview code from mutating studio state.

---

## 📑 Endpoint Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | [`/api/orchestrate`](#1-post-apiorchestrate) | Execute multi-agent autonomous website generation |
| `GET` | [`/api/projects`](#2-get-apiprojects) | List all persisted projects |
| `POST` | [`/api/projects`](#3-post-apiprojects) | Create a new project workspace |
| `GET` | [`/api/projects/:id`](#4-get-apiprojectsid) | Retrieve project files, agent log, and metadata |
| `PUT` | [`/api/projects/:id/files`](#5-put-apiprojectsidfiles) | Atomically update or create project files |
| `GET` | [`/api/projects/:id/events`](#6-get-apiprojectsidevents) | Connect to real-time Server-Sent Event (SSE) stream |
| `GET` | [`/p/:id`](#7-get-pid) | Access sandboxed live preview container |
| `POST` | [`/api/tasks`](#8-post-apitasks) | Upload & parse document (PDF / DOCX) for multimodal analysis |
| `GET` | [`/health`](#9-get-health) | Inspect service health and LLM provider statuses |

---

## 1. POST `/api/orchestrate`

Trigger the complete multi-agent workflow (Manager Atlas → Specialists → Lead Coder → QA Audit).

### Request Headers
```http
Content-Type: application/json
```

### Request Body
```json
{
  "prompt": "Build a responsive modern SaaS landing page with dark mode, pricing cards, and interactive FAQ",
  "projectId": "proj_abc123", // Optional: omits to create new project
  "budgetTier": "balanced",   // Optional: "free" | "balanced" | "premium" (default: "balanced")
  "stream": true              // Optional: stream SSE chunks (default: true)
}
```

### Response (200 OK — Synchronous Mode)
```json
{
  "success": true,
  "projectId": "proj_abc123",
  "previewUrl": "/p/proj_abc123",
  "spend": {
    "tier": "balanced",
    "totalCost": 0.22,
    "currency": "USD"
  },
  "qaAudit": {
    "status": "passed",
    "score": 98,
    "issues": []
  },
  "files": [
    { "path": "index.html", "size": 4210 },
    { "path": "style.css", "size": 3120 },
    { "path": "script.js", "size": 1840 }
  ]
}
```

### Example cURL
```bash
curl -X POST http://localhost:3000/api/orchestrate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a portfolio website with cyberpunk aesthetic",
    "budgetTier": "balanced"
  }'
```

---

## 2. GET `/api/projects`

List all active and stored projects.

### Response (200 OK)
```json
{
  "projects": [
    {
      "id": "proj_abc123",
      "title": "Cyberpunk Portfolio",
      "createdAt": "2026-10-06T00:15:00.000Z",
      "updatedAt": "2026-10-06T00:15:45.000Z",
      "fileCount": 3,
      "previewUrl": "/p/proj_abc123"
    }
  ]
}
```

---

## 3. POST `/api/projects`

Manually instantiate a project container without running the automated build pipeline.

### Request Body
```json
{
  "title": "Minimal Static Blog",
  "files": {
    "index.html": "<!DOCTYPE html><html><body><h1>Hello World</h1></body></html>",
    "style.css": "body { font-family: sans-serif; }"
  }
}
```

---

## 4. GET `/api/projects/:id`

Retrieve complete source files, agent audit logs, and version metadata.

### Response (200 OK)
```json
{
  "project": {
    "id": "proj_abc123",
    "title": "Cyberpunk Portfolio",
    "revision": 4,
    "files": {
      "index.html": "<!DOCTYPE html>...",
      "style.css": "body { background: #000; }...",
      "script.js": "console.log('App ready');..."
    },
    "history": [
      {
        "agent": "Atlas",
        "action": "Architecture spec approved",
        "timestamp": "2026-10-06T00:15:10.000Z"
      },
      {
        "agent": "Byte",
        "action": "Generated source files",
        "timestamp": "2026-10-06T00:15:28.000Z"
      }
    ]
  }
}
```

---

## 5. PUT `/api/projects/:id/files`

Atomically update one or more files in the project workspace. Revisions prevent concurrent overwrites.

### Request Body
```json
{
  "expectedRevision": 4,
  "files": {
    "style.css": "body { background-color: #050505; color: #fff; }"
  }
}
```

---

## 6. GET `/api/projects/:id/events`

Subscribe to real-time agent execution events via Server-Sent Events (`SSE`).

### Stream Event Types
- `agent:spawn`: New agent instantiated with role metadata.
- `agent:thought`: Intermediate agent reasoning tokens.
- `agent:stream`: Code chunk streamed from LLM gateway.
- `agent:complete`: Agent output validated and committed.
- `qa:audit`: AST validation and lint audit score.
- `pipeline:done`: Final website published to `/p/:id`.

### Example Client Consumption (JavaScript)
```javascript
const eventSource = new EventSource('/api/projects/proj_abc123/events');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(`[Agent Event] ${data.type}:`, data.payload);
};

eventSource.onerror = (err) => {
  console.error('SSE Connection failed', err);
  eventSource.close();
};
```

---

## 7. GET `/p/:id`

Access the isolated sandbox preview container.

### Security Headers Applied
```http
Content-Security-Policy: sandbox allow-scripts allow-forms allow-modals allow-same-origin; object-src 'none'; base-uri 'self'
X-Content-Type-Options: nosniff
Cache-Control: no-store
```

---

## 8. POST `/api/tasks` (Multimodal Document Parsing)

Upload and parse document attachments (`PDF`, `DOCX`, `TXT`) for analysis by agent **Scribe**.

### Request Headers
```http
Content-Type: multipart/form-data
```

### Form Fields
- `file`: Binary document file (`.pdf` or `.docx`)
- `instructions`: Plain-text prompt detailing desired analysis

---

## 9. GET `/health`

Inspect operational health and model gateway status.

### Response (200 OK)
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "timestamp": "2026-10-06T00:20:00.000Z",
  "database": "filesystem",
  "providers": {
    "nvidia": "available",
    "gemini": "available",
    "mistral": "available",
    "openrouter": "available"
  }
}
```

---

## ⚠️ Error Handling & Status Codes

OmniVerse uses standard HTTP response codes:

| Code | Meaning | Description |
| :--- | :--- | :--- |
| `200` | OK | Request succeeded |
| `400` | Bad Request | Malformed JSON or invalid schema parameters |
| `403` | Forbidden | Cross-origin request attempted against internal API |
| `404` | Not Found | Project or file does not exist |
| `409` | Conflict | Expected revision mismatch (competing concurrent writer) |
| `429` | Rate Limited | Upstream LLM provider quota reached; fallback triggered |
| `500` | Internal Error | Unexpected failure with error details logged |

---

&copy; 2026 Agent Orchestra Labs. Distributed under the MIT License.
