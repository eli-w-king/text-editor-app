# Authentication System Documentation

## Overview

Writer App uses a simple email/password authentication system built for MVP. The backend runs on Cloudflare Workers with KV storage, and clients (mobile + desktop) store JWT tokens locally.

**Architecture:**
```
Mobile App (React Native)        Desktop App (React/Vite)
      |                                |
      |  POST /api/auth/register       |
      |  POST /api/auth/login          |
      |  GET  /api/auth/me             |
      |                                |
      +---------- HTTPS --------------+
                    |
         Cloudflare Worker (auth)
         writer-app-auth.workers.dev
                    |
              Cloudflare KV
              (USERS_KV namespace)
```

---

## User Model

Users are stored in Cloudflare KV as JSON objects:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "password_hash": "<base64 PBKDF2 derived key>",
  "salt": "<base64 random salt>",
  "created_at": "2025-01-15T12:00:00.000Z"
}
```

**KV key patterns:**
- `user:email:{email}` -- primary lookup by email (used for login + duplicate check)
- `user:id:{uuid}` -- secondary lookup by user ID (used for /me endpoint)

Both keys store the full user JSON so either lookup returns the complete record.

---

## Password Hashing

Since Cloudflare Workers don't support Node.js `bcrypt` or `argon2`, we use **PBKDF2-SHA256** via `crypto.subtle`:

- **Algorithm:** PBKDF2
- **Hash:** SHA-256
- **Iterations:** 100,000
- **Salt:** 16 bytes (cryptographically random via `crypto.getRandomValues`)
- **Key length:** 32 bytes (256 bits)
- **Storage format:** Both hash and salt are stored as base64-encoded strings

Password verification uses timing-safe comparison to prevent timing attacks.

---

## JWT Tokens

Tokens are signed with **HMAC-SHA256** using `crypto.subtle`.

**JWT payload:**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "iat": 1705334400,
  "exp": 1705939200
}
```

- **Expiry:** 7 days from issuance
- **Signing secret:** Stored as a Cloudflare Worker secret (`JWT_SECRET`)
- **Token format:** Standard JWT (header.payload.signature) with base64url encoding

---

## API Endpoints

### `POST /api/auth/register`

Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Success (201):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "created_at": "2025-01-15T12:00:00.000Z"
  }
}
```

**Errors:**
| Status | Error Message |
|--------|--------------|
| 400 | Invalid email address |
| 400 | Password must be at least 8 characters |
| 409 | An account with this email already exists |

---

### `POST /api/auth/login`

Authenticate with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Success (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "created_at": "2025-01-15T12:00:00.000Z"
  }
}
```

**Errors:**
| Status | Error Message |
|--------|--------------|
| 400 | Email and password are required |
| 401 | Invalid email or password |

Note: The 401 error intentionally uses a generic message to prevent user enumeration.

---

### `GET /api/auth/me`

Verify a JWT token and return the current user's info.

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Success (200):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "created_at": "2025-01-15T12:00:00.000Z"
  }
}
```

**Errors:**
| Status | Error Message |
|--------|--------------|
| 401 | Missing or invalid Authorization header |
| 401 | Invalid or expired token |
| 404 | User not found |

---

## Client Integration

### Mobile App (React Native + AsyncStorage)

**Files:**
- `services/auth.ts` -- API calls + AsyncStorage token management
- `context/AuthContext.tsx` -- React context provider with `useAuth()` hook
- `components/auth/LoginScreen.tsx` -- Login form with frosted glass UI
- `components/auth/RegisterScreen.tsx` -- Registration form
- `components/auth/AuthGate.tsx` -- Wrapper component for auth flow

**Token storage:** `AsyncStorage` under key `writer_auth_token`

**Usage:**
```tsx
import { AuthProvider } from './context/AuthContext';
import AuthGate from './components/auth/AuthGate';

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <YourMainApp />
      </AuthGate>
    </AuthProvider>
  );
}
```

The `AuthGate` component:
1. On mount, checks for a stored JWT in AsyncStorage
2. Calls `GET /api/auth/me` to validate the token
3. If valid, renders children (the main app)
4. If invalid or missing, shows Login/Register screens
5. Handles switching between login and register modes

**Using auth in components:**
```tsx
import { useAuth } from './context/AuthContext';

function MyComponent() {
  const { user, logout } = useAuth();
  return (
    <View>
      <Text>Logged in as: {user?.email}</Text>
      <Button onPress={logout} title="Log Out" />
    </View>
  );
}
```

---

### Desktop App (React + localStorage)

**Files:**
- `desktop/src/services/auth.ts` -- API calls + localStorage token management
- `desktop/src/context/AuthContext.tsx` -- React context provider with `useAuth()` hook
- `desktop/src/pages/Login.tsx` -- Login page with frosted glass styling
- `desktop/src/pages/Register.tsx` -- Registration page

**Token storage:** `localStorage` under key `writer_auth_token`

**Usage:** Identical pattern to mobile, but with `localStorage` instead of `AsyncStorage` and web-native form elements instead of React Native components.

---

## Auth Middleware (for other Workers)

The auth system includes a reusable middleware module at `cloudflare-workers/auth/auth-middleware.js` that can be imported by other Cloudflare Workers to protect their endpoints.

**Two usage patterns:**

### 1. Higher-order function (`withAuth`)
```javascript
import { withAuth } from './auth-middleware.js';

async function handleProtectedRoute(request, env, ctx) {
  const userId = request.auth.sub;    // User ID from JWT
  const email = request.auth.email;   // Email from JWT
  // ... your protected logic
}

// In fetch handler:
return withAuth(handleProtectedRoute)(request, env, ctx);
```

### 2. Manual validation (`validateAuthToken`)
```javascript
import { validateAuthToken } from './auth-middleware.js';

const payload = await validateAuthToken(request, env.JWT_SECRET);
if (!payload) {
  return new Response('Unauthorized', { status: 401 });
}

// payload.sub = user ID
// payload.email = user email
```

Both patterns require the worker to have `JWT_SECRET` in its environment (same secret used by the auth worker).

A reference implementation is provided in `cloudflare-workers/auth/sync-worker-example.js`.

---

## Deployment

### 1. Create the KV namespace

```bash
cd cloudflare-workers/auth
npx wrangler kv namespace create USERS_KV
npx wrangler kv namespace create USERS_KV --preview
```

Update the `id` and `preview_id` in `wrangler.toml` with the values from the output.

### 2. Set the JWT secret

```bash
# Generate a strong secret
openssl rand -base64 32

# Store it in Cloudflare
npx wrangler secret put JWT_SECRET
# Paste the generated secret when prompted
```

### 3. Deploy the worker

```bash
cd cloudflare-workers/auth
npm install
npx wrangler deploy
```

The worker will be available at `https://writer-app-auth.<your-subdomain>.workers.dev`.

### 4. Update client API base URLs

Update the `API_BASE` constant in:
- `services/auth.ts` (mobile)
- `desktop/src/services/auth.ts` (desktop)

---

## Security Considerations

### MVP -- Current State

- **Password hashing:** PBKDF2-SHA256 with 100k iterations and random salt. Industry standard.
- **Timing-safe comparison:** Password verification uses constant-time string comparison.
- **JWT expiry:** 7-day expiry to balance security and convenience.
- **No user enumeration:** Login errors use generic "Invalid email or password" message.
- **CORS:** Currently allows all origins (`*`) for MVP simplicity.
- **HTTPS only:** Cloudflare Workers enforce HTTPS by default.

### Future Improvements (Post-MVP)

- **Rate limiting:** Add rate limiting to `/register` and `/login` to prevent brute force (marked with TODO in code).
- **CORS restriction:** Restrict `Access-Control-Allow-Origin` to specific app domains.
- **Refresh tokens:** Implement short-lived access tokens (15min) + long-lived refresh tokens.
- **Password reset:** Add email-based password reset flow.
- **Email verification:** Verify email addresses during registration.
- **Account lockout:** Lock accounts after repeated failed login attempts.
- **Token revocation:** Maintain a blocklist of revoked tokens in KV.
- **Audit logging:** Log authentication events for security monitoring.
- **2FA/MFA:** Add optional two-factor authentication.

---

## File Structure

```
cloudflare-workers/auth/
  worker.js              -- Main auth worker (register, login, me endpoints)
  auth-middleware.js     -- Reusable JWT validation middleware
  sync-worker-example.js -- Reference: document sync worker using auth middleware
  wrangler.toml          -- Cloudflare Worker configuration
  package.json           -- Worker dependencies

services/
  auth.ts                -- Mobile auth service (AsyncStorage-based)

context/
  AuthContext.tsx         -- Mobile auth React context + useAuth() hook

components/auth/
  LoginScreen.tsx         -- Mobile login screen (frosted glass UI)
  RegisterScreen.tsx      -- Mobile registration screen
  AuthGate.tsx           -- Auth gate wrapper component

desktop/src/
  services/auth.ts       -- Desktop auth service (localStorage-based)
  context/AuthContext.tsx -- Desktop auth React context + useAuth() hook
  pages/Login.tsx         -- Desktop login page (frosted glass CSS)
  pages/Register.tsx      -- Desktop registration page
```

---

## Auth Flow Diagram

```
User opens app
      |
      v
AuthGate checks for stored token
      |
      +--- No token ---> Show LoginScreen
      |                        |
      |                   User enters email/password
      |                        |
      |                   POST /api/auth/login
      |                        |
      |                   +--- 200 OK: Store token, show app
      |                   |
      |                   +--- 401: Show error message
      |
      +--- Has token ---> GET /api/auth/me
                               |
                          +--- 200 OK: Token valid, show app
                          |
                          +--- 401: Token expired, clear token
                                    Show LoginScreen
```

---

## Testing

### Manual testing with curl

```bash
# Register
curl -X POST https://writer-app-auth.YOUR_SUBDOMAIN.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Login
curl -X POST https://writer-app-auth.YOUR_SUBDOMAIN.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get current user (replace TOKEN with the JWT from login response)
curl https://writer-app-auth.YOUR_SUBDOMAIN.workers.dev/api/auth/me \
  -H "Authorization: Bearer TOKEN"

# Health check
curl https://writer-app-auth.YOUR_SUBDOMAIN.workers.dev/health
```

### Local development

```bash
cd cloudflare-workers/auth
npx wrangler dev
```

This starts a local development server. You'll need to create a `.dev.vars` file:
```
JWT_SECRET=your-local-dev-secret
```

The KV namespace will use the preview namespace ID from `wrangler.toml`.
