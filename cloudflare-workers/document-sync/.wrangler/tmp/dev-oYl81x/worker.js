var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-Nmg7KT/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// worker.js
var MAX_CONTENT_SIZE_BYTES = 1048576;
var MAX_TITLE_LENGTH = 500;
var DOCUMENT_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
var ALLOWED_ORIGINS = [
  "http://localhost:8081",
  "http://localhost:19006",
  "http://localhost:3000",
  "https://inlaynoteapp.com",
  "https://app.inlaynoteapp.com",
  "https://www.inlaynoteapp.com"
];
function corsHeaders(request) {
  const origin = request.headers.get("Origin");
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Document-Version",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400"
  };
  if (!origin) {
    headers["Access-Control-Allow-Origin"] = "null";
  } else if (ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
__name(corsHeaders, "corsHeaders");
function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request)
  });
}
__name(handleOptions, "handleOptions");
function jsonResponse(request, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json"
    }
  });
}
__name(jsonResponse, "jsonResponse");
function errorResponse(request, message, status, code) {
  const body = { error: message };
  if (code) body.code = code;
  return jsonResponse(request, body, status);
}
__name(errorResponse, "errorResponse");
function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad) base64 += "=".repeat(4 - pad);
  return atob(base64);
}
__name(base64UrlDecode, "base64UrlDecode");
function base64UrlDecodeToBuffer(str) {
  const binary = base64UrlDecode(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
__name(base64UrlDecodeToBuffer, "base64UrlDecodeToBuffer");
async function verifyJWT(token, secret) {
  try {
    if (typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    let header;
    try {
      header = JSON.parse(base64UrlDecode(encodedHeader));
    } catch {
      return null;
    }
    if (!header || header.alg !== "HS256") return null;
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const signatureBuffer = base64UrlDecodeToBuffer(encodedSignature);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBuffer,
      encoder.encode(signingInput)
    );
    if (!valid) return null;
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1e3);
    if (payload.exp && payload.exp < now) return null;
    if (!payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}
__name(verifyJWT, "verifyJWT");
async function authenticateRequest(request, jwtSecret) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  return verifyJWT(token, jwtSecret);
}
__name(authenticateRequest, "authenticateRequest");
function isValidDocumentId(id) {
  return typeof id === "string" && DOCUMENT_ID_REGEX.test(id);
}
__name(isValidDocumentId, "isValidDocumentId");
function documentKey(userId, documentId) {
  return `documents/${userId}/${documentId}.json`;
}
__name(documentKey, "documentKey");
function indexKey(userId) {
  return `documents/${userId}/_index.json`;
}
__name(indexKey, "indexKey");
async function readIndex(bucket, userId) {
  const key = indexKey(userId);
  const obj = await bucket.get(key);
  if (!obj) return [];
  try {
    const data = await obj.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
__name(readIndex, "readIndex");
async function writeIndex(bucket, userId, index) {
  const key = indexKey(userId);
  await bucket.put(key, JSON.stringify(index), {
    httpMetadata: { contentType: "application/json" }
  });
}
__name(writeIndex, "writeIndex");
function buildSummary(doc) {
  return {
    document_id: doc.document_id,
    title: doc.title,
    updated_at: doc.updated_at,
    created_at: doc.created_at,
    deleted_at: doc.deleted_at,
    version: doc.version,
    wordCount: doc.metadata?.wordCount ?? 0,
    isPinned: doc.metadata?.isPinned ?? false,
    isArchived: doc.metadata?.isArchived ?? false
  };
}
__name(buildSummary, "buildSummary");
async function upsertIndex(bucket, userId, doc) {
  const index = await readIndex(bucket, userId);
  const summary = buildSummary(doc);
  const existingIdx = index.findIndex((s) => s.document_id === doc.document_id);
  if (existingIdx >= 0) {
    index[existingIdx] = summary;
  } else {
    index.push(summary);
  }
  await writeIndex(bucket, userId, index);
  return index;
}
__name(upsertIndex, "upsertIndex");
async function removeFromIndex(bucket, userId, documentId) {
  const index = await readIndex(bucket, userId);
  const filtered = index.filter((s) => s.document_id !== documentId);
  await writeIndex(bucket, userId, filtered);
  return filtered;
}
__name(removeFromIndex, "removeFromIndex");
function handleHealth(request) {
  return jsonResponse(request, {
    status: "ok",
    service: "writer-app-document-sync",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
}
__name(handleHealth, "handleHealth");
async function handleCreateDocument(request, env, userId) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(request, "Invalid JSON body", 400, "INVALID_JSON");
  }
  if (body.content != null) {
    const contentStr = typeof body.content === "string" ? body.content : JSON.stringify(body.content);
    if (new TextEncoder().encode(contentStr).length > MAX_CONTENT_SIZE_BYTES) {
      return errorResponse(
        request,
        `Content exceeds maximum size of ${MAX_CONTENT_SIZE_BYTES} bytes`,
        413,
        "CONTENT_TOO_LARGE"
      );
    }
  }
  const title = typeof body.title === "string" ? body.title.slice(0, MAX_TITLE_LENGTH) : "Untitled";
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const doc = {
    document_id: crypto.randomUUID(),
    user_id: userId,
    title,
    content: body.content || {
      type: "delta",
      ops: [],
      plainText: "",
      format: "delta-v1"
    },
    metadata: {
      wordCount: body.metadata?.wordCount ?? 0,
      characterCount: body.metadata?.characterCount ?? 0,
      colorFamily: body.metadata?.colorFamily ?? null,
      colorDots: body.metadata?.colorDots ?? [],
      tags: body.metadata?.tags ?? [],
      isPinned: body.metadata?.isPinned ?? false,
      isArchived: body.metadata?.isArchived ?? false
    },
    version: 1,
    created_at: now,
    updated_at: now,
    deleted_at: null
  };
  const key = documentKey(userId, doc.document_id);
  await env.DOCUMENTS_BUCKET.put(key, JSON.stringify(doc), {
    httpMetadata: { contentType: "application/json" }
  });
  await upsertIndex(env.DOCUMENTS_BUCKET, userId, doc);
  return jsonResponse(request, doc, 201);
}
__name(handleCreateDocument, "handleCreateDocument");
async function handleListDocuments(request, env, userId) {
  const url = new URL(request.url);
  const includeDeleted = url.searchParams.get("include_deleted") === "true";
  const sortField = url.searchParams.get("sort") || "updated_at";
  const order = url.searchParams.get("order") || "desc";
  const allowedSortFields = ["updated_at", "created_at", "title", "version"];
  const safeSortField = allowedSortFields.includes(sortField) ? sortField : "updated_at";
  let index = await readIndex(env.DOCUMENTS_BUCKET, userId);
  if (!includeDeleted) {
    index = index.filter((s) => !s.deleted_at);
  }
  index.sort((a, b) => {
    const aVal = a[safeSortField] ?? "";
    const bVal = b[safeSortField] ?? "";
    if (aVal < bVal) return order === "asc" ? -1 : 1;
    if (aVal > bVal) return order === "asc" ? 1 : -1;
    return 0;
  });
  return jsonResponse(request, { documents: index, total: index.length });
}
__name(handleListDocuments, "handleListDocuments");
async function handleGetDocument(request, env, userId, documentId) {
  if (!isValidDocumentId(documentId)) {
    return errorResponse(request, "Invalid document ID", 400, "INVALID_DOCUMENT_ID");
  }
  const key = documentKey(userId, documentId);
  const obj = await env.DOCUMENTS_BUCKET.get(key);
  if (!obj) {
    return errorResponse(request, "Document not found", 404, "NOT_FOUND");
  }
  let doc;
  try {
    doc = await obj.json();
  } catch {
    return errorResponse(request, "Failed to read document", 500, "STORAGE_ERROR");
  }
  return jsonResponse(request, doc);
}
__name(handleGetDocument, "handleGetDocument");
async function handleUpdateDocument(request, env, userId, documentId) {
  if (!isValidDocumentId(documentId)) {
    return errorResponse(request, "Invalid document ID", 400, "INVALID_DOCUMENT_ID");
  }
  const key = documentKey(userId, documentId);
  const obj = await env.DOCUMENTS_BUCKET.get(key);
  if (!obj) {
    return errorResponse(request, "Document not found", 404, "NOT_FOUND");
  }
  let storedDoc;
  try {
    storedDoc = await obj.json();
  } catch {
    return errorResponse(request, "Failed to read document", 500, "STORAGE_ERROR");
  }
  const clientVersionHeader = request.headers.get("X-Document-Version");
  if (clientVersionHeader !== null) {
    const clientVersion = parseInt(clientVersionHeader, 10);
    if (!isNaN(clientVersion) && clientVersion < storedDoc.version) {
      return jsonResponse(
        request,
        {
          error: "Conflict: document has been modified",
          code: "VERSION_CONFLICT",
          server_version: storedDoc.version,
          client_version: clientVersion,
          document: storedDoc
        },
        409
      );
    }
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(request, "Invalid JSON body", 400, "INVALID_JSON");
  }
  if (body.content !== void 0) {
    const contentStr = typeof body.content === "string" ? body.content : JSON.stringify(body.content);
    if (new TextEncoder().encode(contentStr).length > MAX_CONTENT_SIZE_BYTES) {
      return errorResponse(
        request,
        `Content exceeds maximum size of ${MAX_CONTENT_SIZE_BYTES} bytes`,
        413,
        "CONTENT_TOO_LARGE"
      );
    }
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updatedDoc = {
    ...storedDoc,
    title: body.title !== void 0 ? typeof body.title === "string" ? body.title.slice(0, MAX_TITLE_LENGTH) : storedDoc.title : storedDoc.title,
    content: body.content !== void 0 ? body.content : storedDoc.content,
    metadata: {
      ...storedDoc.metadata,
      ...body.metadata && typeof body.metadata === "object" ? body.metadata : {}
    },
    version: storedDoc.version + 1,
    updated_at: now,
    // Allow restoring a soft-deleted document by setting deleted_at to null
    deleted_at: body.deleted_at !== void 0 ? body.deleted_at : storedDoc.deleted_at
  };
  await env.DOCUMENTS_BUCKET.put(key, JSON.stringify(updatedDoc), {
    httpMetadata: { contentType: "application/json" }
  });
  await upsertIndex(env.DOCUMENTS_BUCKET, userId, updatedDoc);
  return jsonResponse(request, updatedDoc);
}
__name(handleUpdateDocument, "handleUpdateDocument");
async function handleDeleteDocument(request, env, userId, documentId) {
  if (!isValidDocumentId(documentId)) {
    return errorResponse(request, "Invalid document ID", 400, "INVALID_DOCUMENT_ID");
  }
  const key = documentKey(userId, documentId);
  const url = new URL(request.url);
  const permanent = url.searchParams.get("permanent") === "true";
  const obj = await env.DOCUMENTS_BUCKET.get(key);
  if (!obj) {
    return errorResponse(request, "Document not found", 404, "NOT_FOUND");
  }
  if (permanent) {
    await env.DOCUMENTS_BUCKET.delete(key);
    await removeFromIndex(env.DOCUMENTS_BUCKET, userId, documentId);
    return jsonResponse(request, { deleted: true, document_id: documentId, permanent: true });
  }
  let storedDoc;
  try {
    storedDoc = await obj.json();
  } catch {
    return errorResponse(request, "Failed to read document", 500, "STORAGE_ERROR");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  storedDoc.deleted_at = now;
  storedDoc.updated_at = now;
  storedDoc.version += 1;
  await env.DOCUMENTS_BUCKET.put(key, JSON.stringify(storedDoc), {
    httpMetadata: { contentType: "application/json" }
  });
  await upsertIndex(env.DOCUMENTS_BUCKET, userId, storedDoc);
  return jsonResponse(request, storedDoc);
}
__name(handleDeleteDocument, "handleDeleteDocument");
function matchDocumentId(pathname) {
  const match = pathname.match(/^\/api\/documents\/([a-zA-Z0-9_-]+)$/);
  return match ? match[1] : null;
}
__name(matchDocumentId, "matchDocumentId");
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (method === "OPTIONS") {
      return handleOptions(request);
    }
    try {
      if (path === "/health" || path === "/") {
        if (method !== "GET") {
          return errorResponse(request, "Method not allowed", 405, "METHOD_NOT_ALLOWED");
        }
        return handleHealth(request);
      }
      if (!path.startsWith("/api/")) {
        return errorResponse(request, "Not found", 404, "NOT_FOUND");
      }
      if (!env.JWT_SECRET || !env.DOCUMENTS_BUCKET) {
        console.error("Missing required env bindings: JWT_SECRET and/or DOCUMENTS_BUCKET");
        return errorResponse(request, "Internal server error", 500, "INTERNAL_ERROR");
      }
      const auth = await authenticateRequest(request, env.JWT_SECRET);
      if (!auth) {
        return errorResponse(
          request,
          "Unauthorized - invalid or missing authentication token",
          401,
          "UNAUTHORIZED"
        );
      }
      const userId = auth.sub;
      if (path === "/api/documents") {
        if (method === "POST") {
          return await handleCreateDocument(request, env, userId);
        }
        if (method === "GET") {
          return await handleListDocuments(request, env, userId);
        }
        return errorResponse(request, "Method not allowed", 405, "METHOD_NOT_ALLOWED");
      }
      const documentId = matchDocumentId(path);
      if (documentId) {
        if (method === "GET") {
          return await handleGetDocument(request, env, userId, documentId);
        }
        if (method === "PUT") {
          return await handleUpdateDocument(request, env, userId, documentId);
        }
        if (method === "DELETE") {
          return await handleDeleteDocument(request, env, userId, documentId);
        }
        return errorResponse(request, "Method not allowed", 405, "METHOD_NOT_ALLOWED");
      }
      return errorResponse(request, "Not found", 404, "NOT_FOUND");
    } catch (err) {
      console.error("Unhandled error:", err);
      return errorResponse(request, "Internal server error", 500, "INTERNAL_ERROR");
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-Nmg7KT/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-Nmg7KT/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
