/**
 * DocumentSync Utility
 *
 * Client-side module for auto-saving and syncing notes with the cloud
 * document API. Bridges the local AsyncStorage-based note model to the
 * cloud document format, providing debounced auto-save, conflict
 * detection, retry with exponential backoff, and batch migration.
 *
 * Security:
 *   - Supports JWT authentication via setAuthToken()
 *   - Falls back to X-User-ID header for backward compatibility
 *   - All public methods validate inputs before processing
 *   - Destroyed instances throw to prevent use-after-teardown bugs
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SYNC_API_BASE = 'https://document-sync.inlaynoteapp.workers.dev';
const AUTO_SAVE_DELAY = 2500; // 2.5 seconds debounce
const RETRY_DELAYS = [1000, 3000, 10000]; // exponential backoff delays

// ---------------------------------------------------------------------------
// DocumentSyncClient
// ---------------------------------------------------------------------------

class DocumentSyncClient {
  /**
   * @param {string} apiBase  Base URL of the document sync API.
   * @param {string} userId   Authenticated user identifier.
   * @throws {Error} If apiBase is not a non-empty string.
   */
  constructor(apiBase = SYNC_API_BASE, userId = 'anonymous') {
    if (typeof apiBase !== 'string' || apiBase.trim().length === 0) {
      throw new Error('DocumentSyncClient: apiBase must be a non-empty string');
    }

    // Strip trailing slashes to prevent double-slash URL issues
    this.apiBase = apiBase.replace(/\/+$/, '');
    this.userId = userId;

    /** @type {string|null} JWT token for authenticated requests */
    this._authToken = null;

    /** @type {boolean} True after destroy() is called */
    this._destroyed = false;

    /** @type {Map<string, ReturnType<typeof setTimeout>>} per-document debounce timers */
    this.autoSaveTimers = new Map();

    /** @type {Map<string, Promise>} track in-flight saves */
    this.pendingSaves = new Map();

    /** @type {Map<string, number>} track known versions for conflict detection */
    this.documentVersions = new Map();

    // Callbacks -----------------------------------------------------------------
    /** @type {((localDoc: object, serverDoc: object) => object) | null} */
    this.onConflict = null;

    /** @type {((document: object) => void) | null} */
    this.onSaveSuccess = null;

    /** @type {((error: Error, document: object) => void) | null} */
    this.onSaveError = null;

    /** @type {((status: 'idle'|'saving'|'error'|'conflict') => void) | null} */
    this.onSyncStatusChange = null;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle guard
  // ---------------------------------------------------------------------------

  /**
   * Assert that this client has not been destroyed.
   * @param {string} methodName  Name of the calling method for error messages.
   * @returns {void}
   * @throws {Error} If the client has been destroyed.
   */
  _assertNotDestroyed(methodName) {
    if (this._destroyed) {
      throw new Error(`DocumentSyncClient.${methodName}(): client has been destroyed`);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Set the authenticated user ID. Call after login / authentication.
   * @param {string} userId
   * @returns {void}
   * @throws {Error} If userId is not a non-empty string.
   */
  setUserId(userId) {
    this._assertNotDestroyed('setUserId');
    if (typeof userId !== 'string' || userId.trim().length === 0) {
      throw new Error('DocumentSyncClient.setUserId(): userId must be a non-empty string');
    }
    this.userId = userId;
  }

  /**
   * Set the JWT authentication token. When set, requests use
   * Authorization: Bearer instead of X-User-ID.
   *
   * @param {string|null} token  JWT token string or null to clear.
   * @returns {void}
   */
  setAuthToken(token) {
    this._assertNotDestroyed('setAuthToken');
    if (token !== null && typeof token !== 'string') {
      throw new Error('DocumentSyncClient.setAuthToken(): token must be a string or null');
    }
    this._authToken = token;
  }

  /**
   * Build default headers for every request.
   * Uses Bearer token auth if available, falls back to X-User-ID.
   * @returns {Record<string, string>}
   */
  _headers() {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (this._authToken) {
      headers['Authorization'] = `Bearer ${this._authToken}`;
    } else {
      headers['X-User-ID'] = this.userId;
    }
    return headers;
  }

  /**
   * Emit a sync status change to the callback, if registered.
   * @param {'idle'|'saving'|'error'|'conflict'} status
   * @returns {void}
   */
  _emitStatus(status) {
    if (typeof this.onSyncStatusChange === 'function') {
      try {
        this.onSyncStatusChange(status);
      } catch (_) {
        // Swallow callback errors so they don't break internal flow.
      }
    }
  }

  /**
   * Wait for a given number of milliseconds.
   * @param {number} ms
   * @returns {Promise<void>}
   */
  static _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---------------------------------------------------------------------------
  // Format conversion helpers
  // ---------------------------------------------------------------------------

  /**
   * Convert an existing app note to the cloud document format.
   *
   * Existing note format:
   *   { id, title, content (plain text string), updatedAt (timestamp), colorFamily, colorDots }
   *
   * Cloud document format:
   *   { document_id, user_id, title,
   *     content: { type: 'delta', ops: [{insert: text}], plainText: text, format: 'delta-v1' },
   *     metadata: { colorFamily, colorDots, wordCount, characterCount },
   *     version, created_at, updated_at }
   *
   * @param {object} note  Local app note object.
   * @returns {object}     Cloud document object.
   * @throws {Error} If note is not a valid object.
   */
  static noteToDocument(note) {
    if (!note || typeof note !== 'object') {
      throw new Error('noteToDocument: note must be a non-null object');
    }

    const plainText = typeof note.content === 'string' ? note.content : '';
    const wordCount = plainText
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    const characterCount = plainText.length;

    return {
      document_id: note.id,
      user_id: null, // Populated by the API based on auth
      title: note.title || '',
      content: {
        type: 'delta',
        ops: [{ insert: plainText }],
        plainText,
        format: 'delta-v1',
      },
      metadata: {
        colorFamily: (note.colorFamily != null) ? note.colorFamily : null,
        colorDots: Array.isArray(note.colorDots) ? note.colorDots : [],
        wordCount,
        characterCount,
      },
      version: 1,
      created_at: note.updatedAt
        ? new Date(note.updatedAt).toISOString()
        : new Date().toISOString(),
      updated_at: note.updatedAt
        ? new Date(note.updatedAt).toISOString()
        : new Date().toISOString(),
    };
  }

  /**
   * Convert a cloud document back to the local app note format.
   *
   * @param {object} doc  Cloud document object.
   * @returns {object}    Local app note object.
   * @throws {Error} If doc is not a valid object.
   */
  static documentToNote(doc) {
    if (!doc || typeof doc !== 'object') {
      throw new Error('documentToNote: doc must be a non-null object');
    }

    // Extract plain text from the content structure
    let plainText = '';
    if (doc.content) {
      if (typeof doc.content === 'string') {
        plainText = doc.content;
      } else if (typeof doc.content.plainText === 'string') {
        plainText = doc.content.plainText;
      } else if (Array.isArray(doc.content.ops)) {
        plainText = doc.content.ops
          .map((op) => (typeof op.insert === 'string' ? op.insert : ''))
          .join('');
      }
    }

    return {
      id: doc.document_id,
      title: doc.title || '',
      content: plainText,
      updatedAt: doc.updated_at
        ? new Date(doc.updated_at).getTime()
        : Date.now(),
      colorFamily: (doc.metadata && doc.metadata.colorFamily) || null,
      colorDots: (doc.metadata && Array.isArray(doc.metadata.colorDots))
        ? doc.metadata.colorDots
        : [],
    };
  }

  // ---------------------------------------------------------------------------
  // API methods
  // ---------------------------------------------------------------------------

  /**
   * Create a new document in the cloud.
   *
   * @param {object} noteData  Local note data.
   * @returns {Promise<object>} Created document from server.
   * @throws {Error} If noteData is invalid or the request fails.
   */
  async createDocument(noteData) {
    this._assertNotDestroyed('createDocument');
    if (!noteData || typeof noteData !== 'object') {
      throw new Error('createDocument: noteData must be a non-null object');
    }

    const doc = DocumentSyncClient.noteToDocument(noteData);

    try {
      const response = await fetch(`${this.apiBase}/api/documents`, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify(doc),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const err = new Error(
          `createDocument failed (${response.status}): ${errorBody}`
        );
        err.status = response.status;
        throw err;
      }

      const result = await response.json();

      // Track the version we received from the server
      if (result.document_id && result.version != null) {
        this.documentVersions.set(result.document_id, result.version);
      }

      return result;
    } catch (error) {
      // Enrich network errors with context
      if (!error.status) {
        const enriched = new Error(`createDocument network error: ${error.message}`);
        enriched.status = 0;
        throw enriched;
      }
      throw error;
    }
  }

  /**
   * Retrieve a single document by ID.
   *
   * @param {string} documentId
   * @returns {Promise<object>} Document from server.
   * @throws {Error} If documentId is invalid or the request fails.
   */
  async getDocument(documentId) {
    this._assertNotDestroyed('getDocument');
    if (typeof documentId !== 'string' || documentId.trim().length === 0) {
      throw new Error('getDocument: documentId must be a non-empty string');
    }

    try {
      const response = await fetch(
        `${this.apiBase}/api/documents/${encodeURIComponent(documentId)}`,
        {
          method: 'GET',
          headers: this._headers(),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const err = new Error(
          `getDocument failed (${response.status}): ${errorBody}`
        );
        err.status = response.status;
        throw err;
      }

      const result = await response.json();

      // Track version
      if (result.document_id && result.version != null) {
        this.documentVersions.set(result.document_id, result.version);
      }

      return result;
    } catch (error) {
      if (!error.status) {
        const enriched = new Error(`getDocument network error: ${error.message}`);
        enriched.status = 0;
        throw enriched;
      }
      throw error;
    }
  }

  /**
   * List documents for the current user.
   *
   * @param {object} options  Query params: { limit, offset, sort, order, search, deleted }
   * @returns {Promise<object>} { documents: [], total, limit, offset }
   */
  async listDocuments(options = {}) {
    this._assertNotDestroyed('listDocuments');

    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options)) {
        if (value != null) {
          params.set(key, String(value));
        }
      }

      const qs = params.toString();
      const url = `${this.apiBase}/api/documents${qs ? `?${qs}` : ''}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this._headers(),
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const err = new Error(
          `listDocuments failed (${response.status}): ${errorBody}`
        );
        err.status = response.status;
        throw err;
      }

      const result = await response.json();

      // Track versions for every returned document
      if (Array.isArray(result.documents)) {
        for (const doc of result.documents) {
          if (doc.document_id && doc.version != null) {
            this.documentVersions.set(doc.document_id, doc.version);
          }
        }
      }

      return result;
    } catch (error) {
      if (!error.status) {
        const enriched = new Error(`listDocuments network error: ${error.message}`);
        enriched.status = 0;
        throw enriched;
      }
      throw error;
    }
  }

  /**
   * Update an existing document in the cloud. Sends the known version via
   * the `X-Document-Version` header for conflict detection.
   *
   * @param {string} documentId
   * @param {object} noteData   Local note data.
   * @returns {Promise<object>} Updated document from server.
   * @throws {Error} If inputs are invalid or the request fails.
   */
  async updateDocument(documentId, noteData) {
    this._assertNotDestroyed('updateDocument');
    if (typeof documentId !== 'string' || documentId.trim().length === 0) {
      throw new Error('updateDocument: documentId must be a non-empty string');
    }
    if (!noteData || typeof noteData !== 'object') {
      throw new Error('updateDocument: noteData must be a non-null object');
    }

    const doc = DocumentSyncClient.noteToDocument(noteData);
    const knownVersion = this.documentVersions.get(documentId);

    const headers = {
      ...this._headers(),
    };

    if (knownVersion != null) {
      headers['X-Document-Version'] = String(knownVersion);
    }

    try {
      const response = await fetch(
        `${this.apiBase}/api/documents/${encodeURIComponent(documentId)}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify(doc),
        }
      );

      if (response.status === 409) {
        // Surface conflict explicitly so callers can handle it
        const conflictBody = await response.json().catch(() => ({}));
        const err = new Error('Conflict: document version mismatch');
        err.status = 409;
        err.serverDocument = conflictBody.serverDocument || conflictBody;
        throw err;
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const err = new Error(
          `updateDocument failed (${response.status}): ${errorBody}`
        );
        err.status = response.status;
        throw err;
      }

      const result = await response.json();

      // Track the new version
      if (result.document_id && result.version != null) {
        this.documentVersions.set(result.document_id, result.version);
      }

      return result;
    } catch (error) {
      // Let conflict errors propagate as-is
      if (error.status === 409) throw error;
      if (!error.status) {
        const enriched = new Error(`updateDocument network error: ${error.message}`);
        enriched.status = 0;
        throw enriched;
      }
      throw error;
    }
  }

  /**
   * Delete a document (soft-delete by default, permanent if specified).
   *
   * @param {string}  documentId
   * @param {boolean} permanent  If true, permanently delete.
   * @returns {Promise<object>}
   * @throws {Error} If documentId is invalid or the request fails.
   */
  async deleteDocument(documentId, permanent = false) {
    this._assertNotDestroyed('deleteDocument');
    if (typeof documentId !== 'string' || documentId.trim().length === 0) {
      throw new Error('deleteDocument: documentId must be a non-empty string');
    }

    try {
      const params = permanent ? '?permanent=true' : '';
      const response = await fetch(
        `${this.apiBase}/api/documents/${encodeURIComponent(documentId)}${params}`,
        {
          method: 'DELETE',
          headers: this._headers(),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        const err = new Error(
          `deleteDocument failed (${response.status}): ${errorBody}`
        );
        err.status = response.status;
        throw err;
      }

      const result = await response.json();

      // Remove tracked version for permanently deleted documents
      if (permanent) {
        this.documentVersions.delete(documentId);
      }

      return result;
    } catch (error) {
      if (!error.status) {
        const enriched = new Error(`deleteDocument network error: ${error.message}`);
        enriched.status = 0;
        throw enriched;
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Auto-save
  // ---------------------------------------------------------------------------

  /**
   * Schedule an auto-save for a document. Uses a per-document debounce timer
   * so rapid edits collapse into a single save after {@link AUTO_SAVE_DELAY}
   * milliseconds of idle time.
   *
   * @param {string} documentId  The document / note ID.
   * @param {object} noteData    Current note data to persist.
   * @returns {void}
   * @throws {Error} If inputs are invalid.
   */
  scheduleAutoSave(documentId, noteData) {
    this._assertNotDestroyed('scheduleAutoSave');
    if (typeof documentId !== 'string' || documentId.trim().length === 0) {
      throw new Error('scheduleAutoSave: documentId must be a non-empty string');
    }
    if (!noteData || typeof noteData !== 'object') {
      throw new Error('scheduleAutoSave: noteData must be a non-null object');
    }

    // Clear any existing timer for this document
    this.cancelAutoSave(documentId);

    const timerId = setTimeout(() => {
      this.autoSaveTimers.delete(documentId);
      this._emitStatus('saving');

      const savePromise = this._performSave(documentId, noteData);
      this.pendingSaves.set(documentId, savePromise);

      savePromise.finally(() => {
        // Only remove if this is still the tracked promise (it may have been
        // replaced by a newer save).
        if (this.pendingSaves.get(documentId) === savePromise) {
          this.pendingSaves.delete(documentId);
        }
      });
    }, AUTO_SAVE_DELAY);

    this.autoSaveTimers.set(documentId, timerId);
  }

  /**
   * Cancel a pending auto-save for a specific document.
   *
   * @param {string} documentId
   * @returns {void}
   */
  cancelAutoSave(documentId) {
    const timerId = this.autoSaveTimers.get(documentId);
    if (timerId != null) {
      clearTimeout(timerId);
      this.autoSaveTimers.delete(documentId);
    }
  }

  /**
   * Cancel all pending auto-save timers.
   * @returns {void}
   */
  cancelAllAutoSaves() {
    for (const timerId of this.autoSaveTimers.values()) {
      clearTimeout(timerId);
    }
    this.autoSaveTimers.clear();
  }

  // ---------------------------------------------------------------------------
  // Internal save with retry & conflict resolution
  // ---------------------------------------------------------------------------

  /**
   * Perform the actual save (create or update) with retry and conflict
   * resolution logic.
   *
   * @param {string} documentId  Document / note ID.
   * @param {object} noteData    Note data to save.
   * @param {number} retryCount  Current retry attempt (0-indexed).
   * @returns {Promise<object|null>} Saved document or null on unrecoverable error.
   */
  async _performSave(documentId, noteData, retryCount = 0) {
    try {
      let result;

      // Decide whether to create or update based on whether we already know
      // a version for this document (i.e., it exists in the cloud).
      if (this.documentVersions.has(documentId)) {
        result = await this.updateDocument(documentId, noteData);
      } else {
        // Attempt create; the server may still return 409 if the document was
        // created concurrently.
        try {
          result = await this.createDocument({ ...noteData, id: documentId });
        } catch (createError) {
          // If the document already exists, fall back to update.
          if (
            createError.status === 409 ||
            (createError.message && createError.message.includes('409'))
          ) {
            // Fetch the server version first so we have the version number
            const serverDoc = await this.getDocument(documentId);
            this.documentVersions.set(documentId, serverDoc.version);
            result = await this.updateDocument(documentId, noteData);
          } else {
            throw createError;
          }
        }
      }

      this._emitStatus('idle');
      if (typeof this.onSaveSuccess === 'function') {
        try {
          this.onSaveSuccess(result);
        } catch (_) {
          // Swallow callback errors
        }
      }
      return result;
    } catch (error) {
      // ----- Conflict handling (HTTP 409) ------------------------------------
      if (error.status === 409) {
        this._emitStatus('conflict');

        try {
          // Fetch the latest server version
          const serverDoc = await this.getDocument(documentId);
          const localDoc = DocumentSyncClient.noteToDocument({
            ...noteData,
            id: documentId,
          });

          let resolvedNoteData = noteData;
          if (typeof this.onConflict === 'function') {
            const resolved = await this.onConflict(localDoc, serverDoc);
            // Convert resolved document back to note format for updateDocument
            resolvedNoteData = DocumentSyncClient.documentToNote(resolved);
          }

          // Force save with the server's current version so the next PUT succeeds
          this.documentVersions.set(documentId, serverDoc.version);
          const result = await this.updateDocument(documentId, {
            ...resolvedNoteData,
            id: documentId,
          });

          this._emitStatus('idle');
          if (typeof this.onSaveSuccess === 'function') {
            try {
              this.onSaveSuccess(result);
            } catch (_) {
              // Swallow callback errors
            }
          }
          return result;
        } catch (conflictError) {
          this._emitStatus('error');
          if (typeof this.onSaveError === 'function') {
            try {
              this.onSaveError(conflictError, noteData);
            } catch (_) {
              // Swallow callback errors
            }
          }
          return null;
        }
      }

      // ----- Network / transient error retry ---------------------------------
      if (retryCount < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[retryCount];
        await DocumentSyncClient._delay(delay);
        return this._performSave(documentId, noteData, retryCount + 1);
      }

      // ----- Unrecoverable error --------------------------------------------
      this._emitStatus('error');
      if (typeof this.onSaveError === 'function') {
        try {
          this.onSaveError(error, noteData);
        } catch (_) {
          // Swallow callback errors
        }
      }
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Bulk sync (initial migration)
  // ---------------------------------------------------------------------------

  /**
   * Sync all local notes to the cloud. Designed for one-time migration
   * when a user first enables cloud sync.
   *
   * For each local note:
   *   1. Check if a cloud version exists.
   *   2. If not, create it.
   *   3. If yes, compare `updatedAt` and push the newer version.
   *
   * @param {object[]} localNotes  Array of local notes.
   * @returns {Promise<{ synced: number, conflicts: number, errors: number, details: object[] }>}
   */
  async syncAllNotes(localNotes) {
    this._assertNotDestroyed('syncAllNotes');
    if (!Array.isArray(localNotes)) {
      throw new Error('syncAllNotes: localNotes must be an array');
    }

    const stats = { synced: 0, conflicts: 0, errors: 0, details: [] };

    // Fetch the full list of existing cloud documents so we can compare
    const cloudDocMap = new Map();
    try {
      const listResult = await this.listDocuments({ limit: 10000 });
      if (Array.isArray(listResult.documents)) {
        for (const doc of listResult.documents) {
          cloudDocMap.set(doc.document_id, doc);
        }
      }
    } catch (_) {
      // If listing fails, we'll treat every note as new and rely on
      // per-document error handling below.
    }

    for (const note of localNotes) {
      // Validate each note has an ID
      if (!note || !note.id) {
        stats.errors++;
        stats.details.push({ id: note?.id || 'unknown', status: 'error', reason: 'missing id' });
        continue;
      }

      try {
        const existingDoc = cloudDocMap.get(note.id);

        if (!existingDoc) {
          // Document does not exist yet -- create it
          await this.createDocument(note);
          stats.synced++;
          stats.details.push({ id: note.id, status: 'created' });
        } else {
          // Document exists -- compare timestamps
          const localTimestamp = note.updatedAt || 0;
          const serverTimestamp = existingDoc.updated_at
            ? new Date(existingDoc.updated_at).getTime()
            : 0;

          if (localTimestamp > serverTimestamp) {
            // Local is newer -- push to cloud
            this.documentVersions.set(note.id, existingDoc.version);
            await this.updateDocument(note.id, note);
            stats.synced++;
            stats.details.push({ id: note.id, status: 'updated' });
          } else if (serverTimestamp > localTimestamp) {
            // Server is newer -- nothing to push (caller should pull)
            stats.synced++;
            stats.details.push({ id: note.id, status: 'server-newer' });
          } else {
            // Timestamps are equal -- nothing to do
            stats.synced++;
            stats.details.push({ id: note.id, status: 'up-to-date' });
          }
        }
      } catch (error) {
        if (error.status === 409) {
          stats.conflicts++;
          stats.details.push({ id: note.id, status: 'conflict' });
        } else {
          stats.errors++;
          stats.details.push({ id: note.id, status: 'error', reason: error.message });
        }
      }
    }

    return stats;
  }

  // ---------------------------------------------------------------------------
  // Health check
  // ---------------------------------------------------------------------------

  /**
   * Check if the sync API is reachable and healthy.
   * Does not send auth credentials -- health check is a public endpoint.
   *
   * @returns {Promise<{ healthy: boolean, latencyMs: number, details?: object }>}
   */
  async checkHealth() {
    this._assertNotDestroyed('checkHealth');
    const start = Date.now();
    try {
      const response = await fetch(`${this.apiBase}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const latencyMs = Date.now() - start;

      if (!response.ok) {
        return { healthy: false, latencyMs };
      }

      const details = await response.json().catch(() => null);
      return { healthy: true, latencyMs, details };
    } catch (error) {
      return { healthy: false, latencyMs: Date.now() - start, error: error.message };
    }
  }

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------

  /**
   * Tear down the client -- cancel all pending auto-saves.
   * After calling destroy(), all public methods will throw.
   * @returns {void}
   */
  destroy() {
    this.cancelAllAutoSaves();
    this._destroyed = true;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export default DocumentSyncClient;
export { DocumentSyncClient, SYNC_API_BASE, AUTO_SAVE_DELAY, RETRY_DELAYS };
