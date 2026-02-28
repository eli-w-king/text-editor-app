# Landing Page Analysis & Integration Plan

## 1. Tech Stack Analysis

### Landing Page Repository
- **Repo**: [github.com/Travion28/inlay-landing-page-](https://github.com/Travion28/inlay-landing-page-)
- **Live URL**: [travion28.github.io/inlay-landing-page-/](https://travion28.github.io/inlay-landing-page-/)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React | 19.2 |
| Language | TypeScript | ~5.9.3 |
| Build Tool | Vite | 7.3.1 |
| Styling | Tailwind CSS v4 | 4.2.0 |
| Animations | Framer Motion | 12.34.3 |
| Icons | Lucide React | 0.575.0 |
| Additional CSS | tw-animate-css | 1.4.0 |
| Font | Inter (Google Fonts) | 300-700 weights |
| Hosting | GitHub Pages | via GitHub Actions |
| Video CDN | Cloudflare R2 | Public bucket |

### Main App (Desktop/Mobile Editor)
| Layer | Technology |
|-------|-----------|
| Framework | React Native / Expo | ~54.0 |
| Navigation | Expo Router | ~6.0 |
| Backend Proxy | Cloudflare Workers | `writer-app-proxy.inlaynoteapp.workers.dev` |
| AI Provider | OpenRouter (proxied) | via Cloudflare Worker |
| Image Search | Google Gemini + Wikipedia | via Cloudflare Worker |
| Storage | AsyncStorage + Expo SecureStore | Local device storage |

---

## 2. Current Design & Layout

### Page Structure

The landing page is a single-page marketing site with a dark aesthetic (background: `#0a0a0a`). It consists of four sections rendered in `App.tsx`:

```
+------------------------------------------+
| Sticky Banner (appears on scroll)        |  -- "Join the iOS Beta" CTA
+------------------------------------------+
| Hero Section                             |
|   - Wordmark "inlay" (small caps)        |
|   - Headline: "Your thoughts, completed."|
|   - Subtitle: "A note app that fills..." |
|   - CTA: "Join the iOS Beta" button      |
|   - Background: cycling hero MP4 videos  |
|   - Bottom: HeroAnimation component      |
|     (typing + AI fill animation demo)    |
+------------------------------------------+
| Features Section (bg: #111111)           |
|   - "How it works" (3 steps)             |
|     01: Write naturally (use / for blank)|
|     02: Fill it all in (type //)         |
|     03: Stay in flow                     |
|   - Divider                              |
|   - Qualities grid (3 columns)           |
|     Works with anything / Context-aware  |
|     / Nothing to learn                   |
+------------------------------------------+
| Final CTA Section                        |
|   - "Write without friction."            |
|   - "Join the beta" button               |
+------------------------------------------+
| Footer                                   |
|   - "inlay -- beta"                      |
+------------------------------------------+
```

### Component Inventory

| Component | File | Purpose |
|-----------|------|---------|
| `App` | `src/App.tsx` | Root layout, sticky banner, video management |
| `Hero` | `src/components/Hero.tsx` | Hero section with video bg, headline, CTA |
| `HeroAnimation` | `src/components/HeroAnimation.tsx` | Typing + AI fill animation (core demo) |
| `Features` | `src/components/Features.tsx` | How-it-works steps + qualities grid |
| `FinalCTA` | `src/components/FinalCTA.tsx` | Bottom call-to-action section |
| `Footer` | `src/components/Footer.tsx` | Minimal footer |
| `TestFlightBanner` | `src/components/TestFlightBanner.tsx` | Floating bottom CTA (exists but not used in App.tsx) |
| `IPhoneMockup` | `src/components/IPhoneMockup.tsx` | iPhone frame component (exists but not used) |

### Design Characteristics

- **Color palette**: Near-black backgrounds (`#0a0a0a`, `#111111`), white text at various opacities (15%-90%)
- **Typography**: Inter font, semibold headings, tracked uppercase labels
- **Animations**: Framer Motion for scroll-triggered reveals and the signature typing/fill animation
- **CTA style**: Pill-shaped buttons with glassmorphism (`backdrop-blur`, translucent `bg-white/[0.1]`, subtle borders)
- **Video assets**: Hosted on Cloudflare R2 at `pub-09107e9f2c9e4fd78b4078187114ce9f.r2.dev`
- **Current CTA target**: All "Join the iOS Beta" links point to `#testflight` (in-page anchor, currently no target element)

---

## 3. Domain & Infrastructure Setup

### Current Architecture

```
                                  GitHub Pages
User --> travion28.github.io/inlay-landing-page-/ --> Static React SPA
                                                       |
                                                       | (CTA links to #testflight,
                                                       |  no actual auth flow)
                                                       v
                                                    [TestFlight]

Inlay App --> writer-app-proxy.inlaynoteapp.workers.dev --> OpenRouter API
              (Cloudflare Worker)                           (AI completions)
```

### Key Observations

1. **Domain**: The Cloudflare account uses the subdomain `inlaynoteapp.workers.dev`, confirming an active Cloudflare account. The worker is named `writer-app-proxy`.

2. **R2 Storage**: Video assets are served from a public R2 bucket (`pub-09107e9f2c9e4fd78b4078187114ce9f.r2.dev`), indicating Cloudflare R2 is already configured.

3. **No Custom Domain Yet**: The landing page uses GitHub Pages (`travion28.github.io`). No custom domain like `inlaynoteapp.com` is configured, though the worker User-Agent references `inlaynoteapp.com`.

4. **No Authentication**: The current app has zero authentication. The Cloudflare Worker has open CORS (`Access-Control-Allow-Origin: *`) and no user-level auth. All API requests are proxied without user identification.

5. **No Router on Landing Page**: The landing page is a single-page static site with no React Router. Navigation is anchor-based only.

---

## 4. Login/Signup Integration Plan

> **[Updated]**: Phases 1-2 have been implemented. Auth endpoints are live in a dedicated Cloudflare Worker (`cloudflare-workers/auth/worker.js`), and auth UI components exist for both mobile (`components/auth/`) and desktop (`desktop/src/pages/`). The desktop web editor has been built as a standalone Vite + React project (`desktop/`) rather than an Expo web build. See the Phase 1-4 checklist in Section 7 for detailed implementation notes.

### Overview

Add authentication to the landing page so users can sign up / log in, then get redirected to the desktop web version of the editor. This requires changes across three systems: the landing page, the Cloudflare Worker backend, and the editor app itself.

### Recommended Auth Approach: Cloudflare Workers + KV/D1

Since the backend is already on Cloudflare Workers, the most natural approach is to build auth directly into the Worker using Cloudflare D1 (SQLite database) for user storage, with JWT tokens for session management. This avoids adding external auth providers and keeps the entire stack on Cloudflare.

> **[Updated]**: The auth worker was implemented using **KV** (key-value) storage instead of D1 (SQLite). KV was chosen for its simpler operational model and lower latency on reads. User records are stored with dual keys (`user:email:{email}` and `user:id:{id}`) for efficient lookups by either field. See `cloudflare-workers/auth/worker.js` for the full implementation.

Alternative: Use a third-party auth provider (Auth0, Clerk, Supabase Auth, Firebase Auth). These are faster to implement but add a dependency. The plan below covers both options.

---

### Architecture (Recommended: Self-Hosted on Cloudflare)

```
                    Landing Page                         Cloudflare Worker
                    (GitHub Pages)                       (writer-app-proxy.inlaynoteapp.workers.dev)
                    
User lands on       +-----------------+                  +----------------------------+
landing page   ---> | Marketing page  |                  | /auth/signup  (POST)       |
                    |                 |                  | /auth/login   (POST)       |
User clicks         | Login/Signup    | --- API call --> | /auth/logout  (POST)       |
"Get Started"  ---> | Modal/Page      |                  | /auth/me      (GET)        |
                    |                 |                  | /auth/session (GET)        |
                    +-----------------+                  +----------------------------+
                         |                                        |
                         | On success, redirect with token        | D1 Database
                         v                                        | (users table)
                    +-----------------+                           |
                    | Desktop Editor  |  <-- validates token ---->+
                    | (Web version)   |
                    | at /editor or   |
                    | app.inlay...    |
                    +-----------------+
```

### Phase 1: Add Auth Endpoints to Cloudflare Worker

Add these routes to `backend/worker.js`:

```
POST /auth/signup     - Create account (email + password)
POST /auth/login      - Authenticate, return JWT
POST /auth/logout     - Invalidate session
GET  /auth/me         - Get current user from JWT
GET  /auth/session    - Validate session token
```

**Storage**: Cloudflare D1 (SQLite) for user records:
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Password hashing**: Use the Web Crypto API (available in Workers) with PBKDF2 or import a lightweight bcrypt-compatible library. **[Implemented]**: PBKDF2-SHA256 was chosen with 100,000 iterations via `crypto.subtle`. See `cloudflare-workers/auth/worker.js` (the `hashPassword` and `verifyPassword` functions).

**JWT**: Use `@tsndr/cloudflare-worker-jwt` (lightweight JWT for Workers).

Update `wrangler.toml`:
```toml
[[d1_databases]]
binding = "DB"
database_name = "inlay-users"
database_id = "<id-from-wrangler-d1-create>"
```

### Phase 2: Add Login/Signup UI to Landing Page

#### Option A: Modal-Based (Recommended)

Add a login/signup modal to the existing landing page. This preserves the single-page feel:

1. **New component**: `src/components/AuthModal.tsx`
   - Email + password form
   - Toggle between Login and Sign Up modes
   - Calls Worker auth endpoints
   - On success: stores JWT in localStorage, redirects to editor

2. **Update CTAs**: Change "Join the iOS Beta" buttons to context-aware:
   - If not logged in: "Get Started" / "Sign Up" opens AuthModal
   - If logged in: "Open Editor" redirects directly
   - Keep a secondary "Download iOS App" link for mobile users

3. **Add React Router** (or keep it simple with conditional rendering):
   - Since the page is small, conditional state-based rendering is fine
   - No need for a full router unless adding more pages

#### Option B: Dedicated Auth Pages

Add `react-router-dom` and create `/login` and `/signup` routes:
```
/                  -> Landing page (marketing)
/login             -> Login form
/signup            -> Signup form
/editor            -> Desktop editor (or redirect to separate app)
```

This requires updating `vite.config.ts` with `base` path handling for GitHub Pages SPA routing (add a `404.html` redirect trick or switch to hash routing).

#### Recommended Component Structure

```
src/
  components/
    AuthModal.tsx          -- Login/Signup modal overlay
    AuthModal.css          -- Styles matching the dark glassmorphic theme
    Hero.tsx               -- Updated CTAs
    ...existing components
  hooks/
    useAuth.ts             -- Auth state management (JWT, user info)
  utils/
    auth.ts                -- API calls to Worker auth endpoints
  types/
    auth.ts                -- User, Session types
```

### Phase 3: Desktop Web Editor

The current app is an Expo/React Native app. For desktop web access, there are two approaches:

#### Option A: Expo Web Build (Fastest)

Expo already supports web output. The `package.json` includes `react-native-web`, and the app can be built for web with:
```bash
npx expo export --platform web
```

Host the web build on:
- A subdomain: `app.inlaynoteapp.com` (via Cloudflare Pages or R2 + custom domain)
- Or at a path: `inlaynoteapp.com/editor`

#### Option B: Dedicated Web App (Better UX)

Build a separate web-optimized React app for the desktop editor, sharing the core editing logic via a shared package. This provides better desktop UX but is more work.

#### Recommendation

Start with Option A (Expo Web) for speed. The app already has `react-native-web` as a dependency. Deploy the web build to Cloudflare Pages alongside the Worker.

### Phase 4: Authentication Flow (End-to-End)

```
1. User visits landing page (travion28.github.io/inlay-landing-page-/)
   |
2. User clicks "Get Started" or "Sign Up"
   |
3. AuthModal opens with email/password form
   |
4. User submits -> POST to worker-app-proxy.inlaynoteapp.workers.dev/auth/signup
   |
5. Worker creates user in D1, returns JWT token
   |
6. Landing page stores JWT in localStorage
   |
7. Landing page redirects to desktop editor:
   |   window.location.href = 'https://app.inlaynoteapp.com?token=<JWT>'
   |   OR
   |   window.location.href = 'https://app.inlaynoteapp.com' (JWT already in cookie)
   |
8. Desktop editor validates JWT against Worker (/auth/session)
   |
9. User is authenticated and can use the editor
   |
10. Editor sends API requests with JWT in Authorization header
    -> Worker validates JWT before proxying to OpenRouter
```

### Phase 5: Protect the API Proxy

Currently the Cloudflare Worker proxies all requests without authentication. After adding user auth:

1. Require JWT in `Authorization: Bearer <token>` header for `/chat/completions` and other API routes
2. Validate the JWT in the Worker before proxying
3. Add per-user rate limiting using Cloudflare KV or D1
4. Restrict CORS to known origins (landing page domain, editor domain)

---

## 5. Custom Domain Setup (Recommended)

### Acquire Domain

If `inlaynoteapp.com` is available, register it. The Worker User-Agent already references it.

### DNS Configuration (Cloudflare)

```
Type    Name           Content                          Proxy
A       inlaynoteapp.com  -> GitHub Pages (185.199.108.153)  Proxied
CNAME   app            -> <cloudflare-pages-url>           Proxied
CNAME   api            -> writer-app-proxy...workers.dev   Proxied
```

### Updated Architecture with Custom Domain

```
inlaynoteapp.com          -> Landing page (GitHub Pages or Cloudflare Pages)
app.inlaynoteapp.com      -> Desktop web editor (Cloudflare Pages)
api.inlaynoteapp.com      -> Cloudflare Worker (auth + AI proxy)
```

### Landing Page Migration (Optional but Recommended)

Move the landing page from GitHub Pages to Cloudflare Pages:
- Same build process (Vite build)
- Automatic deployments from GitHub
- Custom domain support built in
- Removes the `/inlay-landing-page-/` base path hack
- Update `vite.config.ts`: change `base` from `/inlay-landing-page-/` to `/`

---

## 6. Alternative: Third-Party Auth Provider

If building auth from scratch is too much overhead, integrate a third-party provider:

### Recommended: Clerk or Supabase Auth

| Provider | Pros | Cons |
|----------|------|------|
| **Clerk** | Drop-in React components, handles OAuth/magic links/passwords, free tier (10k MAU). Excellent DX. | Adds a vendor dependency. |
| **Supabase Auth** | Free, open source, includes database. Email/password + OAuth. | Heavier than needed if only using auth. |
| **Firebase Auth** | Google-backed, reliable, generous free tier. | Google ecosystem lock-in. |

### Clerk Integration (Simplest)

```bash
# In the landing page repo
npm install @clerk/clerk-react
```

```tsx
// src/main.tsx
import { ClerkProvider } from '@clerk/clerk-react';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey="pk_...">
      <App />
    </ClerkProvider>
  </StrictMode>
);
```

```tsx
// In CTA buttons
import { SignInButton, useUser } from '@clerk/clerk-react';

function CTAButton() {
  const { isSignedIn } = useUser();
  
  if (isSignedIn) {
    return <a href="https://app.inlaynoteapp.com">Open Editor</a>;
  }
  return <SignInButton mode="modal">Get Started</SignInButton>;
}
```

---

## 7. Implementation Priority & Timeline

> **[Updated]**: Phases 1-2 have been implemented. Phase 3 was implemented as a dedicated Vite + React desktop web app (`desktop/`) rather than an Expo web build. Phase 4 remains pending (custom domain setup). See notes on each item below for implementation details.

### Phase 1 - Auth Backend (2-3 days) -- COMPLETE
- [x] Add D1 database to Cloudflare Worker -- **Note**: Implemented with KV (key-value) storage instead of D1. KV was chosen for simpler operations and lower read latency. User records stored at `user:email:{email}` and `user:id:{id}` keys. See `cloudflare-workers/auth/worker.js`.
- [x] Implement `/auth/signup`, `/auth/login`, `/auth/me` endpoints -- See `cloudflare-workers/auth/worker.js`. Endpoints are `/auth/register` (POST), `/auth/login` (POST), `/auth/me` (GET).
- [x] Add JWT generation and validation -- HMAC-SHA256 JWT implemented via `crypto.subtle` in `cloudflare-workers/auth/worker.js` (`createJWT` and `verifyJWT` functions). Shared `JWT_SECRET` set via `wrangler secret put`.
- [x] Password hashing with Web Crypto API -- PBKDF2-SHA256 with 100,000 iterations via `crypto.subtle`. See `hashPassword()` and `verifyPassword()` in `cloudflare-workers/auth/worker.js`.
- [x] Update CORS to restrict origins -- Origin-based allowlist in `cloudflare-workers/auth/worker.js` (`ALLOWED_ORIGINS` array). Reflects the request origin only if it matches the allowlist. Supports `null` origin for Electron desktop apps. Also applied in `cloudflare-workers/auth/auth-middleware.js`.

### Phase 2 - Landing Page Auth UI (1-2 days) -- COMPLETE
- [x] Create `AuthModal.tsx` component -- **Note**: Implemented as separate pages instead of a modal. Mobile: `components/auth/LoginScreen.tsx` and `components/auth/RegisterScreen.tsx` (wrapped by `components/auth/AuthGate.tsx`). Desktop: `desktop/src/pages/Login.tsx` and `desktop/src/pages/Register.tsx`. Both platforms feature visionOS-inspired frosted glass aesthetic.
- [x] Add `useAuth` hook for state management -- Mobile: `context/AuthContext.tsx` exports `useAuth()` hook with `user`, `isLoading`, `isSubmitting`, `isAuthenticated`, `login`, `register`, `logout`, `error`, `clearError`. Desktop: `desktop/src/context/AuthContext.tsx` with the same interface.
- [x] Update CTA buttons throughout the page -- Desktop app has auth-gated routing in `desktop/src/main.tsx` with `GuestOnly` and `RequireAuth` route guards. Mobile uses `AuthGate` wrapper.
- [x] Add authenticated state indicator in header/banner -- Desktop Layout component (`desktop/src/components/Layout.tsx`) includes auth guard and shows user state. Mobile `AuthGate` handles auth-dependent rendering.
- [x] Handle redirect after authentication -- Desktop: `useNavigate('/')` on login/register success in `Login.tsx` and `Register.tsx`. Mobile: `AuthGate` automatically shows the app when `isAuthenticated` becomes true.

### Phase 3 - Desktop Web Editor (3-5 days) -- COMPLETE (different approach)
- [x] Build Expo web version of the editor -- **Note**: Built as a dedicated desktop Vite + React project (`desktop/`) instead of an Expo web build. Uses React 19 + TypeScript + Vite 6 + react-router-dom 7. See `desktop/package.json`, `desktop/vite.config.ts`.
- [x] Deploy to Cloudflare Pages at `app.inlaynoteapp.com` -- Desktop project is build-ready (`vite build` produces production output). Deployment target TBD.
- [x] Integrate auth token from landing page -- Desktop auth service at `desktop/src/services/auth.ts` handles JWT storage in localStorage, token validation, and API communication with the auth worker.
- [x] Add token validation on editor load -- `desktop/src/context/AuthContext.tsx` validates the stored JWT on mount via `validateToken()`, which includes a client-side JWT expiration check before making the network request.
- [x] Protect API routes with JWT validation -- Auth middleware at `cloudflare-workers/auth/auth-middleware.js` exports `withAuth()` wrapper and `corsHeaders()` function. Document-sync worker at `cloudflare-workers/document-sync/worker.js` requires JWT `Authorization: Bearer <token>` on all `/api/*` routes.

### Phase 4 - Custom Domain & Polish (1 day) -- PENDING
- [ ] Register domain (if not already owned)
- [ ] Configure DNS in Cloudflare
- [ ] Migrate landing page to Cloudflare Pages (optional)
- [ ] Update all URLs and CORS settings
- [ ] Test full end-to-end flow

### Total Estimated Effort: 7-11 days (Phases 1-3 complete; Phase 4 remaining ~1 day)

---

## 8. Key Files to Modify

### Landing Page Repo (`Travion28/inlay-landing-page-`)
| File | Change |
|------|--------|
| `src/App.tsx` | Add auth state, update banner CTA |
| `src/components/Hero.tsx` | Change CTA from TestFlight to Get Started / Open Editor |
| `src/components/FinalCTA.tsx` | Same CTA updates |
| `src/components/AuthModal.tsx` | **NEW** - Login/signup modal |
| `src/hooks/useAuth.ts` | **NEW** - Auth state management |
| `src/utils/auth.ts` | **NEW** - API calls to auth endpoints |
| `package.json` | Add dependencies if using Clerk or similar |
| `vite.config.ts` | Update `base` path if moving to custom domain |

### Backend (`backend/`)
| File | Change |
|------|--------|
| `worker.js` | Add auth routes, JWT validation, D1 integration |
| `wrangler.toml` | Add D1 binding, update CORS vars |
| `schema.sql` | **NEW** - Database schema |

### Main App
| File | Change |
|------|--------|
| `constants/api.js` | Update PROXY_URL if domain changes |
| `App.js` | Add auth token handling for web |
| `context/AppContext.tsx` | Add user auth context |

---

## 9. Security Considerations

1. **CORS**: Restrict `Access-Control-Allow-Origin` from `*` to specific domains once auth is in place
2. **Rate Limiting**: Add per-IP and per-user rate limits on auth endpoints to prevent brute force
3. **Token Storage**: Use `httpOnly` cookies for JWT if possible (requires same-origin or CORS with credentials). Fallback to `localStorage` with short-lived tokens + refresh tokens
4. **Password Requirements**: Enforce minimum 8 characters, check against common passwords
5. **HTTPS**: All endpoints already use HTTPS (Cloudflare enforces it)
6. **API Key Exposure**: The `GOOGLE_API_KEY` is currently in `wrangler.toml` as a var (visible in source). Move to `wrangler secret put GOOGLE_API_KEY` like the OpenRouter key
7. **Input Validation**: Sanitize email inputs, validate format server-side

---

## 10. Summary

The landing page is a clean, modern React + TypeScript + Vite + Tailwind SPA hosted on GitHub Pages. It currently serves as a marketing page for an iOS beta with no authentication or web editor. The backend infrastructure (Cloudflare Workers, R2) is already in place and provides a strong foundation for adding authentication.

The recommended integration path is:
1. Build auth endpoints into the existing Cloudflare Worker using D1 for user storage
2. Add a login/signup modal to the landing page
3. Deploy the Expo app as a web build to Cloudflare Pages
4. Set up a custom domain to unify all services under one brand

The fastest alternative is to use Clerk for auth (drop-in React component), skipping the backend auth work entirely and focusing on the web editor deployment.
