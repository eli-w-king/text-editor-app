# Document Sync API Documentation

## Overview

The Document Sync API provides cloud storage and synchronization for the Inlay note-taking app. Documents are stored in Cloudflare R2 and accessed through a Cloudflare Worker.

| Property | Value |
|---|---|
| **Base URL** | `https://document-sync.inlaynoteapp.workers.dev` |
| **Storage Backend** | Cloudflare R2 |
| **Authentication** | User identification via `X-User-ID` header (MVP -- no auth tokens yet) |
| **Conflict Resolution** | Last-write-wins with version tracking |
| **Auto-Save** | Client-side debounce at 2.5 seconds of inactivity |

---

## Data Model

### Document Schema

```json
{
  "document_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user-123",
  "title": "My Note Title",
  "content": {
    "type": "delta",
    "ops": [
      { "insert": "Hello, world!\n" }
    ],
    "plainText": "Hello, world!",
    "format": "delta-v1"
  },
  "metadata": {
    "wordCount": 2,
    "characterCount": 13,
    "colorFamily": "ocean",
    "colorDots": [],
    "tags": [],
    "isPinned": false,
    "isArchived": false
  },
  "version": 1,
  "created_at": "2024-01-15T10:30:00.000Z",
  "updated_at": "2024-01-15T10:30:00.000Z",
  "deleted_at": null
}
```

### Content Format

The `content` field uses a delta-based format designed for forward compatibility with rich text editors (e.g., Quill):

| Field | Type | Description |
|---|---|---|
| `type` | string | Always `"delta"` |
| `ops` | array | Array of delta operations. For MVP, each op is `{ "insert": "text" }` |
| `plainText` | string | Raw text content for search and display |
| `format` | string | Always `"delta-v1"` for versioning |

### Metadata Fields

| Field | Type | Description |
|---|---|---|
| `wordCount` | number | Word count of plain text |
| `characterCount` | number | Character count of plain text |
| `colorFamily` | string or null | Visual theme color family (e.g., `"ocean"`, `"burntOrange"`) |
| `colorDots` | array | Watercolor dot decoration data |
| `tags` | array | User-defined tags (future use) |
| `isPinned` | boolean | Whether the document is pinned to top |
| `isArchived` | boolean | Whether the document is archived |

### Mapping to Existing App Note Format

The app currently stores notes locally in AsyncStorage with this format:

```
App Note Format                 Cloud Document Format
--------------------------      ------------------------------------------
note.id                    -->  document.document_id
note.title                 -->  document.title
note.content (plain text)  -->  document.content.plainText
                                document.content.ops[0].insert
note.updatedAt (timestamp) -->  document.updated_at (ISO 8601 string)
note.colorFamily           -->  document.metadata.colorFamily
note.colorDots             -->  document.metadata.colorDots
```

The `DocumentSyncClient` utility (`utils/documentSync.js`) provides `noteToDocument()` and `documentToNote()` static methods for conversion.

---

## Authentication

For the MVP, users are identified by the `X-User-ID` header. If omitted, it defaults to `"anonymous"`.

**Future:** JWT-based authentication will be added. The `cloudflare-workers/auth/` directory contains prepared middleware (`auth-middleware.js`) for JWT validation.

---

## CORS

The API allows cross-origin requests from the following origins:

- `http://localhost:8081` (Expo dev server)
- `http://localhost:19006` (Expo web)
- `http://localhost:3000` (local development)
- `https://inlaynoteapp.com` (production landing page)
- `https://app.inlaynoteapp.com` (production web app)
- `https://www.inlaynoteapp.com` (production www)

All responses include appropriate `Access-Control-Allow-*` headers. Preflight `OPTIONS` requests are handled for all routes.

---

## R2 Storage Structure

Documents are organized in R2 by user:

```
documents/
  {user_id}/
    _index.json              # Array of document summaries for fast listing
    {document_id}.json       # Full document data
```

The `_index.json` file contains lightweight summaries (document_id, title, timestamps, version, wordCount, isPinned, isArchived) so that listing documents does not require reading every individual document file.

---

## Endpoints

### Health Check

```
GET /health
```

Returns service status.

**Response (200):**
```json
{
  "status": "ok",
  "service": "document-sync",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

### Create Document

```
POST /api/documents
```

Creates a new document. The server generates the `document_id` (UUID v4) and sets `version` to 1.

**Headers:**

| Header | Required | Description |
|---|---|---|
| `Content-Type` | Yes | `application/json` |
| `X-User-ID` | No | User identifier (default: `"anonymous"`) |

**Request Body:**
```json
{
  "title": "My First Note",
  "content": {
    "type": "delta",
    "ops": [{ "insert": "Hello world\n" }],
    "plainText": "Hello world",
    "format": "delta-v1"
  },
  "metadata": {
    "colorFamily": "ocean",
    "wordCount": 2,
    "characterCount": 11
  }
}
```

**Response (201 Created):**

The full document object with server-generated fields (`document_id`, `version`, `created_at`, `updated_at`).

---

### List Documents

```
GET /api/documents
```

Lists all documents for the authenticated user.

**Headers:**

| Header | Required | Description |
|---|---|---|
| `X-User-ID` | No | User identifier (default: `"anonymous"`) |

**Query Parameters:**

| Parameter | Default | Description |
|---|---|---|
| `include_deleted` | `false` | Set to `true` to include soft-deleted documents |
| `sort` | `updated_at` | Field to sort by |
| `order` | `desc` | Sort direction: `asc` or `desc` |

**Response (200):**
```json
{
  "documents": [
    {
      "document_id": "550e8400-...",
      "title": "My Note",
      "updated_at": "2024-01-15T10:30:00.000Z",
      "created_at": "2024-01-15T10:00:00.000Z",
      "deleted_at": null,
      "version": 3,
      "wordCount": 150,
      "isPinned": false,
      "isArchived": false
    }
  ],
  "total": 1
}
```

Note: The list endpoint returns document summaries from the index, not full document bodies. Use `GET /api/documents/:id` to retrieve the full document with content.

---

### Get Document

```
GET /api/documents/:id
```

Retrieves a single document by ID.

**Headers:**

| Header | Required | Description |
|---|---|---|
| `X-User-ID` | No | User identifier (default: `"anonymous"`) |

**Response (200):**

The full document object.

**Response (404):**
```json
{
  "error": "Document not found"
}
```

---

### Update Document

```
PUT /api/documents/:id
```

Updates an existing document. Supports version-based conflict detection.

**Headers:**

| Header | Required | Description |
|---|---|---|
| `Content-Type` | Yes | `application/json` |
| `X-User-ID` | No | User identifier (default: `"anonymous"`) |
| `X-Document-Version` | No | Client's known document version for conflict detection |

**Request Body:**

Include only the fields you want to update:

```json
{
  "title": "Updated Title",
  "content": {
    "type": "delta",
    "ops": [{ "insert": "Updated content\n" }],
    "plainText": "Updated content",
    "format": "delta-v1"
  },
  "metadata": {
    "wordCount": 2,
    "characterCount": 15
  }
}
```

**Response (200):**

The full updated document with incremented `version` and new `updated_at`.

**Response (409 Conflict):**

Returned when `X-Document-Version` is less than the stored version:

```json
{
  "error": "Conflict: document has been modified",
  "code": "VERSION_CONFLICT",
  "server_version": 3,
  "client_version": 1,
  "document": { ... }
}
```

The response body includes the current server document so the client can merge changes and retry.

---

### Delete Document

```
DELETE /api/documents/:id
```

Deletes a document. By default, performs a soft delete (sets `deleted_at`). Use `?permanent=true` for a hard delete.

**Headers:**

| Header | Required | Description |
|---|---|---|
| `X-User-ID` | No | User identifier (default: `"anonymous"`) |

**Query Parameters:**

| Parameter | Default | Description |
|---|---|---|
| `permanent` | `false` | Set to `true` to permanently remove the document from R2 |

**Response (200) -- Soft Delete:**

The full document with `deleted_at` set and `version` incremented.

**Response (200) -- Permanent Delete:**
```json
{
  "deleted": true,
  "document_id": "550e8400-..."
}
```

**Response (404):**
```json
{
  "error": "Document not found"
}
```

---

## Conflict Resolution

The API uses version-based conflict detection with a last-write-wins strategy for the MVP:

1. Every document has an integer `version` field, starting at 1.
2. On each successful update, `version` is incremented by 1.
3. The client can send `X-Document-Version` with its known version.
4. If the client version matches the server version, the update proceeds normally.
5. If the client version is less than the server version (meaning another client has modified the document), a **409 Conflict** response is returned.
6. The 409 response includes the current server document so the client can merge.
7. The client library (`DocumentSyncClient`) handles conflicts automatically using last-write-wins: it reads the server version, updates its local version tracking, and retries the save.

### Conflict Resolution Flow

```
Client A                     Server                    Client B
   |                            |                         |
   |-- PUT (version: 1) ------>|                         |
   |<-- 200 (version: 2) ------|                         |
   |                            |                         |
   |                            |<-- PUT (version: 1) ---|
   |                            |--- 409 Conflict ------>|
   |                            |   (server doc v2)       |
   |                            |                         |
   |                            |<-- PUT (version: 2) ---|
   |                            |--- 200 (version: 3) -->|
```

---

## Auto-Save Behavior

The client-side `DocumentSyncClient` implements debounced auto-save:

1. On each text change, `scheduleAutoSave(documentId, noteData)` is called.
2. A per-document timer is set for **2.5 seconds**.
3. If another change occurs before the timer fires, the timer is reset.
4. After 2.5 seconds of inactivity, the document is saved to the cloud.
5. If the save fails due to a network error, it is retried with exponential backoff:
   - Retry 1: after 1 second
   - Retry 2: after 3 seconds
   - Retry 3: after 10 seconds
6. If all retries fail, the `onSaveError` callback is invoked.

### Sync Status

The client tracks sync status via the `onSyncStatusChange` callback:

| Status | Description |
|---|---|
| `idle` | No pending saves, everything is synced |
| `saving` | A save is in progress |
| `error` | The last save failed after all retries |
| `conflict` | A version conflict was detected (being resolved) |

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

### HTTP Status Codes

| Status | Meaning |
|---|---|
| 200 | Success |
| 201 | Created (new document) |
| 400 | Bad Request (invalid JSON, missing fields) |
| 404 | Document not found |
| 405 | Method not allowed |
| 409 | Conflict (version mismatch) |
| 500 | Internal server error |

---

## Testing with curl

### Health Check

```bash
curl -s https://document-sync.inlaynoteapp.workers.dev/health | jq .
```

### Create a Document

```bash
curl -s -X POST https://document-sync.inlaynoteapp.workers.dev/api/documents \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test-user" \
  -d '{
    "title": "My First Note",
    "content": {
      "type": "delta",
      "ops": [{"insert": "Hello world\n"}],
      "plainText": "Hello world",
      "format": "delta-v1"
    },
    "metadata": {
      "colorFamily": "ocean",
      "wordCount": 2,
      "characterCount": 11
    }
  }' | jq .
```

### List Documents

```bash
curl -s https://document-sync.inlaynoteapp.workers.dev/api/documents \
  -H "X-User-ID: test-user" | jq .
```

### List with Soft-Deleted Documents

```bash
curl -s "https://document-sync.inlaynoteapp.workers.dev/api/documents?include_deleted=true" \
  -H "X-User-ID: test-user" | jq .
```

### Get a Specific Document

```bash
# Replace DOCUMENT_ID with the actual document_id from the create response
curl -s https://document-sync.inlaynoteapp.workers.dev/api/documents/DOCUMENT_ID \
  -H "X-User-ID: test-user" | jq .
```

### Update a Document

```bash
curl -s -X PUT https://document-sync.inlaynoteapp.workers.dev/api/documents/DOCUMENT_ID \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test-user" \
  -H "X-Document-Version: 1" \
  -d '{
    "title": "Updated Note Title",
    "content": {
      "type": "delta",
      "ops": [{"insert": "Updated content goes here\n"}],
      "plainText": "Updated content goes here",
      "format": "delta-v1"
    },
    "metadata": {
      "wordCount": 4,
      "characterCount": 25
    }
  }' | jq .
```

### Test Conflict Resolution

```bash
# Send an update with an outdated version (should return 409)
curl -s -X PUT https://document-sync.inlaynoteapp.workers.dev/api/documents/DOCUMENT_ID \
  -H "Content-Type: application/json" \
  -H "X-User-ID: test-user" \
  -H "X-Document-Version: 0" \
  -d '{
    "title": "This should conflict"
  }' | jq .
```

### Soft Delete a Document

```bash
curl -s -X DELETE https://document-sync.inlaynoteapp.workers.dev/api/documents/DOCUMENT_ID \
  -H "X-User-ID: test-user" | jq .
```

### Permanently Delete a Document

```bash
curl -s -X DELETE "https://document-sync.inlaynoteapp.workers.dev/api/documents/DOCUMENT_ID?permanent=true" \
  -H "X-User-ID: test-user" | jq .
```

### Full Integration Test Script

```bash
#!/bin/bash
set -e

BASE="https://document-sync.inlaynoteapp.workers.dev"
USER="test-user-$(date +%s)"

echo "=== Health Check ==="
curl -s "$BASE/health" | jq .

echo ""
echo "=== Create Document ==="
DOC=$(curl -s -X POST "$BASE/api/documents" \
  -H "Content-Type: application/json" \
  -H "X-User-ID: $USER" \
  -d '{
    "title": "Test Note",
    "content": {
      "type": "delta",
      "ops": [{"insert": "Initial content\n"}],
      "plainText": "Initial content",
      "format": "delta-v1"
    },
    "metadata": {"wordCount": 2, "characterCount": 15}
  }')
echo "$DOC" | jq .

DOC_ID=$(echo "$DOC" | jq -r '.document_id')
echo "Document ID: $DOC_ID"

echo ""
echo "=== List Documents ==="
curl -s "$BASE/api/documents" -H "X-User-ID: $USER" | jq .

echo ""
echo "=== Get Document ==="
curl -s "$BASE/api/documents/$DOC_ID" -H "X-User-ID: $USER" | jq .

echo ""
echo "=== Update Document ==="
curl -s -X PUT "$BASE/api/documents/$DOC_ID" \
  -H "Content-Type: application/json" \
  -H "X-User-ID: $USER" \
  -H "X-Document-Version: 1" \
  -d '{
    "title": "Updated Test Note",
    "content": {
      "type": "delta",
      "ops": [{"insert": "Updated content\n"}],
      "plainText": "Updated content",
      "format": "delta-v1"
    }
  }' | jq .

echo ""
echo "=== Conflict Test (should return 409) ==="
curl -s -X PUT "$BASE/api/documents/$DOC_ID" \
  -H "Content-Type: application/json" \
  -H "X-User-ID: $USER" \
  -H "X-Document-Version: 1" \
  -d '{"title": "Stale update"}' | jq .

echo ""
echo "=== Soft Delete ==="
curl -s -X DELETE "$BASE/api/documents/$DOC_ID" \
  -H "X-User-ID: $USER" | jq .

echo ""
echo "=== Verify Soft Delete (should not appear) ==="
curl -s "$BASE/api/documents" -H "X-User-ID: $USER" | jq .

echo ""
echo "=== Verify Soft Delete (include_deleted) ==="
curl -s "$BASE/api/documents?include_deleted=true" -H "X-User-ID: $USER" | jq .

echo ""
echo "=== Permanent Delete ==="
curl -s -X DELETE "$BASE/api/documents/$DOC_ID?permanent=true" \
  -H "X-User-ID: $USER" | jq .

echo ""
echo "=== Verify Permanent Delete (should be empty) ==="
curl -s "$BASE/api/documents?include_deleted=true" -H "X-User-ID: $USER" | jq .

echo ""
echo "=== Done ==="
```

---

## Client-Side Integration

### Using DocumentSyncClient

The `utils/documentSync.js` module provides a ready-to-use client:

```javascript
import DocumentSyncClient from '../utils/documentSync';

// Initialize the client
const syncClient = new DocumentSyncClient();
syncClient.setUserId('user-123');

// Set up callbacks
syncClient.onSyncStatusChange = (status) => {
  console.log('Sync status:', status); // 'idle' | 'saving' | 'error' | 'conflict'
};

syncClient.onSaveSuccess = (doc) => {
  console.log('Saved:', doc.document_id, 'v' + doc.version);
};

syncClient.onSaveError = (error, noteData) => {
  console.error('Save failed:', error.message);
};

// Auto-save on text changes (debounced 2.5s)
const handleTextChange = (text) => {
  const noteData = {
    id: currentNoteId,
    title: noteTitle,
    content: text,
    updatedAt: Date.now(),
    colorFamily: currentColorFamily,
    colorDots: currentColorDots,
  };
  syncClient.scheduleAutoSave(currentNoteId, noteData);
};

// Migrate all existing local notes to the cloud
const migrateNotes = async (localNotes) => {
  const result = await syncClient.syncAllNotes(localNotes);
  console.log(`Synced: ${result.synced}, Conflicts: ${result.conflicts}, Errors: ${result.errors}`);
};

// Clean up when the component unmounts
syncClient.destroy();
```

### Data Format Conversion

```javascript
// Local note -> Cloud document
const cloudDoc = DocumentSyncClient.noteToDocument({
  id: '12345',
  title: 'My Note',
  content: 'Hello world',
  updatedAt: Date.now(),
  colorFamily: 'ocean',
  colorDots: [],
});

// Cloud document -> Local note
const localNote = DocumentSyncClient.documentToNote(cloudDoc);
```

---

## Deployment

### Prerequisites

- Node.js 18+
- Cloudflare account with Workers and R2 enabled
- Wrangler CLI

### Steps

```bash
# Navigate to the worker directory
cd cloudflare-workers

# Install dependencies
npm install

# Create the R2 bucket (one-time setup)
npx wrangler r2 bucket create writer-app-documents

# Deploy the worker
npx wrangler deploy

# Verify deployment
curl https://document-sync.inlaynoteapp.workers.dev/health
```

### Local Development

```bash
cd cloudflare-workers

# Start local dev server with R2 emulation
npx wrangler dev

# The worker will be available at http://localhost:8787
curl http://localhost:8787/health
```

---

## Architecture Notes

### Why R2 instead of D1 (SQLite)?

R2 was chosen for document storage because:
1. Documents contain variable-length rich content (JSON deltas) that benefit from object storage
2. R2 has no row size limits
3. R2 provides built-in CDN caching for read-heavy workloads
4. The index file pattern provides sufficient query capability for the MVP
5. R2 is already provisioned in the existing infrastructure

For future scaling, a D1 database could be added for metadata indexing while keeping document content in R2.

### Why last-write-wins?

For the MVP, last-write-wins is the simplest conflict resolution strategy that still provides version tracking. The version numbers and 409 responses give the client enough information to implement more sophisticated merge strategies (e.g., operational transform, CRDTs) in future iterations.

---

## Future Enhancements

- **JWT Authentication** -- Secure endpoints with token-based auth (middleware is pre-built in `auth/`)
- **Real-time Collaboration** -- WebSocket support via Cloudflare Durable Objects
- **Full-text Search** -- Search index backed by D1 or Workers KV
- **Document Sharing** -- Permission-based sharing between users
- **Operational Transform** -- Collaborative editing with conflict-free merging
- **Attachment Storage** -- Image and file attachments stored in R2
- **Rate Limiting** -- Per-user request limits to prevent abuse
- **Webhooks** -- Notify external services of document changes
- **Batch Operations** -- Bulk create/update/delete endpoints
