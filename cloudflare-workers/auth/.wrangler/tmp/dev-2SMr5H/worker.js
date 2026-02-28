var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-WHlvk9/checked-fetch.js
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
var MAX_REQUEST_BODY_BYTES = 10 * 1024;
var MAX_EMAIL_LENGTH = 254;
var MAX_PASSWORD_LENGTH = 128;
var MIN_PASSWORD_LENGTH = 8;
var RATE_LIMIT_LOGIN_MAX = 10;
var RATE_LIMIT_LOGIN_WINDOW_SECONDS = 15 * 60;
var RATE_LIMIT_REGISTER_MAX = 5;
var RATE_LIMIT_REGISTER_WINDOW_SECONDS = 60 * 60;
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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
    headers: { ...corsHeaders(request), "Content-Type": "application/json" }
  });
}
__name(jsonResponse, "jsonResponse");
function generateUUID() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = bytes[6] & 15 | 64;
  bytes[8] = bytes[8] & 63 | 128;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join("-");
}
__name(generateUUID, "generateUUID");
function getClientIP(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}
__name(getClientIP, "getClientIP");
async function checkRateLimit(env, ip, action, maxAttempts, windowSeconds) {
  const key = `ratelimit:${ip}:${action}`;
  try {
    const current = await env.USERS_KV.get(key);
    const count = current ? parseInt(current, 10) : 0;
    if (count >= maxAttempts) {
      return false;
    }
    await env.USERS_KV.put(key, String(count + 1), {
      expirationTtl: windowSeconds
    });
    return true;
  } catch {
    return true;
  }
}
__name(checkRateLimit, "checkRateLimit");
async function parseJsonBody(request) {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_BODY_BYTES) {
    return { data: null, error: jsonResponse(request, { error: "Request body too large" }, 413) };
  }
  try {
    const text = await request.text();
    if (text.length > MAX_REQUEST_BODY_BYTES) {
      return { data: null, error: jsonResponse(request, { error: "Request body too large" }, 413) };
    }
    const data = JSON.parse(text);
    return { data, error: null };
  } catch {
    return { data: null, error: jsonResponse(request, { error: "Invalid JSON body" }, 400) };
  }
}
__name(parseJsonBody, "parseJsonBody");
var PBKDF2_ITERATIONS = 1e5;
var SALT_LENGTH = 16;
var KEY_LENGTH = 32;
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    keyMaterial,
    KEY_LENGTH * 8
  );
  return {
    hash: arrayBufferToBase64(derivedBits),
    salt: arrayBufferToBase64(salt.buffer)
  };
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, storedHash, storedSalt) {
  const salt = base64ToUint8Array(storedSalt);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    keyMaterial,
    KEY_LENGTH * 8
  );
  const computedHash = arrayBufferToBase64(derivedBits);
  return timingSafeEqual(computedHash, storedHash);
}
__name(verifyPassword, "verifyPassword");
function timingSafeEqual(a, b) {
  const maxLen = Math.max(a.length, b.length);
  let lengthMismatch = a.length !== b.length ? 1 : 0;
  let mismatch = 0;
  for (let i = 0; i < maxLen; i++) {
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    mismatch |= charA ^ charB;
  }
  return (mismatch | lengthMismatch) === 0;
}
__name(timingSafeEqual, "timingSafeEqual");
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
__name(arrayBufferToBase64, "arrayBufferToBase64");
function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
__name(base64ToUint8Array, "base64ToUint8Array");
var JWT_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
function base64urlEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(base64urlEncode, "base64urlEncode");
function base64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) {
    str += "=";
  }
  return atob(str);
}
__name(base64urlDecode, "base64urlDecode");
async function getSigningKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}
__name(getSigningKey, "getSigningKey");
async function createJWT(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1e3);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + JWT_EXPIRY_SECONDS
  };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(fullPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await getSigningKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput)
  );
  const encodedSignature = base64urlEncode(
    String.fromCharCode(...new Uint8Array(signature))
  );
  return `${signingInput}.${encodedSignature}`;
}
__name(createJWT, "createJWT");
async function verifyJWT(token, secret) {
  try {
    if (!token || typeof token !== "string") {
      return null;
    }
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    let header;
    try {
      header = JSON.parse(base64urlDecode(encodedHeader));
    } catch {
      return null;
    }
    if (!header || header.alg !== "HS256") {
      return null;
    }
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const key = await getSigningKey(secret);
    const signatureStr = base64urlDecode(encodedSignature);
    const signatureBytes = new Uint8Array(signatureStr.length);
    for (let i = 0; i < signatureStr.length; i++) {
      signatureBytes[i] = signatureStr.charCodeAt(i);
    }
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      new TextEncoder().encode(signingInput)
    );
    if (!valid) {
      return null;
    }
    const payload = JSON.parse(base64urlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1e3);
    if (payload.exp && payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
__name(verifyJWT, "verifyJWT");
function isValidEmail(email) {
  if (typeof email !== "string") return false;
  if (email.length > MAX_EMAIL_LENGTH) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
__name(isValidEmail, "isValidEmail");
function isValidPassword(password) {
  if (typeof password !== "string") return false;
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}
__name(isValidPassword, "isValidPassword");
async function handleRegister(request, env) {
  const ip = getClientIP(request);
  const allowed = await checkRateLimit(env, ip, "register", RATE_LIMIT_REGISTER_MAX, RATE_LIMIT_REGISTER_WINDOW_SECONDS);
  if (!allowed) {
    return jsonResponse(request, { error: "Too many requests. Please try again later." }, 429);
  }
  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;
  const { email, password } = body;
  if (!email || !isValidEmail(email)) {
    return jsonResponse(request, { error: "Invalid email format" }, 400);
  }
  if (!password || !isValidPassword(password)) {
    return jsonResponse(
      request,
      { error: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters long` },
      400
    );
  }
  const normalizedEmail = email.toLowerCase().trim();
  const existingUser = await env.USERS_KV.get(`user:email:${normalizedEmail}`);
  if (existingUser) {
    return jsonResponse(request, { error: "Registration failed. Please try again or sign in if you already have an account." }, 409);
  }
  const { hash, salt } = await hashPassword(password);
  const userId = generateUUID();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const user = {
    id: userId,
    email: normalizedEmail,
    password_hash: hash,
    salt,
    created_at: now
  };
  const userJson = JSON.stringify(user);
  await env.USERS_KV.put(`user:email:${normalizedEmail}`, userJson);
  await env.USERS_KV.put(`user:id:${userId}`, userJson);
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    return jsonResponse(request, { error: "Internal server error" }, 500);
  }
  const token = await createJWT({ sub: userId, email: normalizedEmail }, jwtSecret);
  return jsonResponse(request, {
    token,
    user: {
      id: userId,
      email: normalizedEmail,
      created_at: now
    }
  }, 201);
}
__name(handleRegister, "handleRegister");
async function handleLogin(request, env) {
  const ip = getClientIP(request);
  const allowed = await checkRateLimit(env, ip, "login", RATE_LIMIT_LOGIN_MAX, RATE_LIMIT_LOGIN_WINDOW_SECONDS);
  if (!allowed) {
    return jsonResponse(request, { error: "Too many requests. Please try again later." }, 429);
  }
  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;
  const { email, password } = body;
  if (!email || !password) {
    return jsonResponse(request, { error: "Email and password are required" }, 400);
  }
  if (typeof email !== "string" || typeof password !== "string") {
    return jsonResponse(request, { error: "Email and password must be strings" }, 400);
  }
  const normalizedEmail = email.toLowerCase().trim();
  const userJson = await env.USERS_KV.get(`user:email:${normalizedEmail}`);
  if (!userJson) {
    return jsonResponse(request, { error: "Invalid email or password" }, 401);
  }
  const user = JSON.parse(userJson);
  const passwordValid = await verifyPassword(password, user.password_hash, user.salt);
  if (!passwordValid) {
    return jsonResponse(request, { error: "Invalid email or password" }, 401);
  }
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    return jsonResponse(request, { error: "Internal server error" }, 500);
  }
  const token = await createJWT({ sub: user.id, email: user.email }, jwtSecret);
  return jsonResponse(request, {
    token,
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at
    }
  });
}
__name(handleLogin, "handleLogin");
async function handleMe(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return jsonResponse(request, { error: "Missing or invalid Authorization header" }, 401);
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return jsonResponse(request, { error: "Missing or invalid Authorization header" }, 401);
  }
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    return jsonResponse(request, { error: "Internal server error" }, 500);
  }
  const payload = await verifyJWT(token, jwtSecret);
  if (!payload) {
    return jsonResponse(request, { error: "Invalid or expired token" }, 401);
  }
  const userJson = await env.USERS_KV.get(`user:id:${payload.sub}`);
  if (!userJson) {
    return jsonResponse(request, { error: "User not found" }, 404);
  }
  const user = JSON.parse(userJson);
  return jsonResponse(request, {
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at
    }
  });
}
__name(handleMe, "handleMe");
function handleHealth(request) {
  return jsonResponse(request, {
    status: "ok",
    service: "inlay-app-auth",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
}
__name(handleHealth, "handleHealth");
var worker_default = {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;
      if (request.method === "OPTIONS") {
        return handleOptions(request);
      }
      if (path === "/" || path === "/health") {
        if (request.method !== "GET") {
          return jsonResponse(request, { error: "Method not allowed" }, 405);
        }
        return handleHealth(request);
      }
      if (path === "/api/auth/register") {
        if (request.method !== "POST") {
          return jsonResponse(request, { error: "Method not allowed" }, 405);
        }
        return handleRegister(request, env);
      }
      if (path === "/api/auth/login") {
        if (request.method !== "POST") {
          return jsonResponse(request, { error: "Method not allowed" }, 405);
        }
        return handleLogin(request, env);
      }
      if (path === "/api/auth/me") {
        if (request.method !== "GET") {
          return jsonResponse(request, { error: "Method not allowed" }, 405);
        }
        return handleMe(request, env);
      }
      return jsonResponse(request, { error: "Not found" }, 404);
    } catch {
      const hdrs = corsHeaders(request);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...hdrs, "Content-Type": "application/json" }
      });
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

// .wrangler/tmp/bundle-WHlvk9/middleware-insertion-facade.js
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

// .wrangler/tmp/bundle-WHlvk9/middleware-loader.entry.ts
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
