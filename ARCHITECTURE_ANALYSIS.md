# Architecture Analysis - Inlay Note App

## Table of Contents
1. [Folder Structure](#1-folder-structure)
2. [Tech Stack](#2-tech-stack)
3. [Design System](#3-design-system)
4. [Data Model](#4-data-model)
5. [Screens and Navigation](#5-screens-and-navigation)
6. [OpenRouter API Proxy](#6-openrouter-api-proxy)
7. [R2 Storage Bucket](#7-r2-storage-bucket)
8. [Authentication](#8-authentication)
9. [Cloudflare Workers Configuration](#9-cloudflare-workers-configuration)
10. [Package.json Dependencies and Scripts](#10-packagejson-dependencies-and-scripts)
11. [Key Application Logic](#11-key-application-logic)

---

## 1. Folder Structure

```
/
├── App.js                          # MAIN app entry (2167 lines) - full editor, standalone mode
├── app.json                        # Expo config (name: "Inlay", slug: "myApp")
├── eas.json                        # EAS Build config
├── package.json                    # Dependencies & scripts
├── package-lock.json
├── tsconfig.json                   # TypeScript config, uses "@/*" path alias
├── eslint.config.js                # ESLint flat config with expo preset
├── .gitignore
├── README.md
│
├── app/                            # Expo Router file-based routing
│   ├── _layout.tsx                 # Root layout (Stack nav, AppProvider, GlobalUI)
│   ├── index.tsx                   # Home screen - notes list with FAB
│   ├── modal.tsx                   # Generic modal (minimal, boilerplate)
│   ├── (tabs)/                     # Tab-based layout (appears to be unused/boilerplate)
│   │   ├── _layout.tsx             # Tabs: Home + Explore
│   │   ├── index.tsx               # (boilerplate tab content)
│   │   └── explore.tsx             # (boilerplate tab content)
│   └── note/
│       └── [id].tsx                # Note editor screen (Expo Router version)
│
├── backend/                        # Cloudflare Worker proxy backend
│   ├── worker.js                   # Main worker: OpenRouter proxy + image search/generation
│   ├── wrangler.toml               # Wrangler config: "writer-app-proxy"
│   ├── package.json                # Backend deps (wrangler)
│   ├── package-lock.json
│   └── README.md                   # Backend setup instructions
│
├── components/
│   ├── FloatingMenu.tsx            # Draggable floating action menu (theme, debug, API, notes)
│   ├── GlobalUI.tsx                # Renders FloatingMenu + API key modal globally
│   ├── external-link.tsx           # External link component (boilerplate)
│   ├── haptic-tab.tsx              # Tab bar button with haptics (boilerplate)
│   ├── hello-wave.tsx              # Animated wave emoji (boilerplate)
│   ├── parallax-scroll-view.tsx    # Parallax scroll view (boilerplate)
│   ├── themed-text.tsx             # Themed Text component with type variants
│   ├── themed-view.tsx             # Themed View component
│   └── ui/
│       ├── collapsible.tsx         # Collapsible UI component
│       ├── icon-symbol.tsx         # Icon using vector icons
│       └── icon-symbol.ios.tsx     # iOS-specific SFSymbol icon
│
├── constants/
│   ├── api.js                      # API config (PROXY_URL, helpers)
│   ├── api.example.js              # Template for api.js
│   ├── prompts.ts                  # LLM system prompts (fill, batch fill, image search)
│   └── theme.ts                    # Color tokens and font definitions
│
├── context/
│   └── AppContext.tsx               # Global state: theme, API key, LLM status, debug mode
│
├── hooks/
│   ├── useNotes.ts                 # Notes CRUD hook (AsyncStorage)
│   ├── use-color-scheme.ts         # Re-export of RN useColorScheme
│   ├── use-color-scheme.web.ts     # Web version
│   └── use-theme-color.ts          # Theme-aware color hook
│
├── styles/
│   └── index.js                    # Shared StyleSheet (container, editor, modal, images, debug)
│
├── utils/
│   └── animations.js               # Text streaming animations (fill, delete, parallel)
│
├── scripts/
│   └── reset-project.js            # Project reset script
│
├── assets/
│   └── images/                     # App icons, splash screen, logos
│       ├── icon.png
│       ├── splash-icon.png
│       ├── favicon.png
│       ├── android-icon-*.png
│       └── react-logo*.png         # Boilerplate assets
│
└── myApp/                          # Appears to be an older/duplicate copy
    ├── App.js
    ├── README.md
    ├── app/note/
    ├── context/AppContext.tsx
    └── styles/index.js
```

### Key Observation: Two App Entry Points

The codebase has **two parallel entry points**:

1. **`App.js`** (root, 2167 lines): The **primary, fully-featured** standalone app that is used as the Expo entry point (via `"main": "node_modules/expo/AppEntry.js"` which loads `App.js`). This contains all features: editor, notes list, image support, watercolor dot animations, glassmorphism, the full LLM fill system, etc.

2. **`app/` directory** (Expo Router): A **secondary/simplified** version using Expo Router with file-based routing. It has a simpler notes list (`app/index.tsx`) and a note editor (`app/note/[id].tsx`) without image support, watercolor dots, or the full animation system. The `(tabs)` directory contains boilerplate Expo template code that appears unused.

**The root `App.js` is the active production code.** The `app/` directory appears to be a migration in progress or alternative routing approach.

---

## 2. Tech Stack

### Core Framework
| Technology | Version | Purpose |
|---|---|---|
| React Native | 0.81.5 | Mobile app framework |
| Expo | ~54.0.30 | React Native tooling/platform |
| React | 19.1.0 | UI library |
| TypeScript | ~5.9.2 | Type checking (mixed with JS) |

### Navigation
| Technology | Version | Purpose |
|---|---|---|
| Expo Router | ~6.0.21 | File-based routing (used in `app/` directory) |
| @react-navigation/native | ^7.1.8 | Navigation core |
| @react-navigation/bottom-tabs | ^7.4.0 | Tab navigation (boilerplate, largely unused) |
| react-native-screens | ~4.16.0 | Native screen containers |

### UI/Visual Effects
| Technology | Version | Purpose |
|---|---|---|
| expo-blur (BlurView) | ~15.0.8 | Frosted glass / glassmorphism effects |
| expo-linear-gradient | ~15.0.8 | Gradient backgrounds, loading shimmers |
| expo-image | ~3.0.11 | Optimized image rendering |
| expo-haptics | ~15.0.8 | Haptic feedback |
| @expo/vector-icons (Ionicons) | ^15.0.3 | Icon system |
| expo-symbols | ~1.0.8 | SF Symbols on iOS |
| react-native-reanimated | ~4.1.1 | Advanced animations |
| react-native-gesture-handler | ~2.28.0 | Gesture handling |
| react-native-svg | 15.12.1 | SVG rendering |
| react-native-worklets | 0.5.1 | Reanimated worklets |

### Data/Storage
| Technology | Version | Purpose |
|---|---|---|
| @react-native-async-storage/async-storage | ^2.2.0 | Local key-value storage (notes, API keys) |
| expo-secure-store | ~15.0.8 | Encrypted token storage for auth (iOS Keychain / Android Keystore) |
| expo-file-system | ~19.0.19 | File system access (installed, not heavily used) |

### Content Rendering
| Technology | Version | Purpose |
|---|---|---|
| marked | ^17.0.1 | Markdown parsing (installed, not actively used in main code) |
| react-native-markdown-display | ^7.0.2 | Markdown rendering (installed, not actively used) |
| react-native-render-html | ^6.3.4 | HTML rendering (installed, not actively used) |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Cloudflare Workers | - | Serverless proxy backend |
| Wrangler | ^4.54.0 | Cloudflare Workers CLI |

### Build/Deploy
| Technology | Purpose |
|---|---|
| EAS Build | Cloud builds via Expo Application Services |
| Expo CLI | Local development |
| ESLint (expo config) | Linting |

### External APIs
| API | Usage |
|---|---|
| OpenRouter API | LLM inference (via proxy or direct) |
| Google Gemini API | Image search (Google Search grounding) + image generation |
| Wikipedia/Wikimedia Commons API | Image URL resolution fallback |

---

## 3. Design System

### Color Palette

#### Theme Colors (`constants/theme.ts`)

**Light Theme:**
| Token | Value | Usage |
|---|---|---|
| `text` | `#1C1C1E` | Primary text |
| `background` | `#E8E8ED` | Main background |
| `tint` | `#0a7ea4` | Accent/tint color |
| `icon` | `#636366` | Icon color |
| `tabIconDefault` | `#636366` | Inactive tab icon |
| `tabIconSelected` | `#0a7ea4` | Active tab icon |

**Dark Theme:**
| Token | Value | Usage |
|---|---|---|
| `text` | `#ECEDEE` | Primary text |
| `background` | `#000000` | Main background (pure black) |
| `tint` | `#fff` | Accent/tint color |
| `icon` | `#9BA1A6` | Icon color |
| `tabIconDefault` | `#9BA1A6` | Inactive tab icon |
| `tabIconSelected` | `#fff` | Active tab icon |

#### Additional In-Component Colors

**Note List Items:**
- Light card background: `#FFFFFF`
- Dark card background: `#2C2C2E`
- Light preview text: `#666`
- Dark preview text: `#8E8E93`
- Light date text: `#999`
- Dark date text: `#636366`

**Shared Styles (`styles/index.js`):**
- Container background: `#F9F9F9` (legacy, overridden by theme)
- Nav pill background: `#E5E5EA` (iOS system light grey)
- Editor text: `#333333`
- Modal border: `rgba(0,0,0,0.1)`
- Modal input background: `#F2F2F7`
- Reset button: `#FF3B30` (iOS red)
- Image caption: `#9ca3af`

**FloatingMenu Colors:**
- Light mode BG: `rgba(255,255,255,0.3)` with blur
- Dark mode BG: `rgba(40,40,42,0.5)` with blur
- Light glow: `rgba(255,255,255,0.9)`
- Dark glow: `rgba(255,255,255,0.15)`

**Gradient Background (`App.js`):**
- Light: `['#E8E8ED', '#D8D8DD', '#E8E8ED']`
- Dark: `['#000000', '#0a0a0a', '#000000']`

**Saved Notes Overlay Background:**
- Light: `rgba(255,255,255,0.3)`
- Dark: `rgba(21,23,24,0.3)`

#### Watercolor Dot Color Families (`App.js`)

Each note is assigned a random color family. Colors are chosen based on LLM token count:

| Family | Colors |
|---|---|
| **burntOrange** | `#8B4513`, `#A0522D`, `#B7410E`, `#CC5500`, `#D2691E`, `#964B00`, `#8B3A00`, `#A45A2A` |
| **darkBlue** | `#191970`, `#000080`, `#1B1B6A`, `#1C2951`, `#002147`, `#1D3461`, `#1A237E`, `#0D1B2A` |
| **bloodRed** | `#660000`, `#8B0000`, `#800000`, `#6B0F1A`, `#722F37`, `#7B3B3B`, `#701C1C`, `#5C0A0A` |
| **deepPurple** | `#301934`, `#4A0E4E`, `#2E0854`, `#3C1361`, `#4B0082`, `#371E4E`, `#2D1B3D`, `#432C6B` |

### Typography / Fonts (`constants/theme.ts`)

Platform-adaptive font system:

| Variant | iOS | Android | Web |
|---|---|---|---|
| `sans` | `system-ui` | `normal` | `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, ...` |
| `serif` | `ui-serif` | `serif` | `Georgia, 'Times New Roman', serif` |
| `rounded` | `ui-rounded` | `normal` | `'SF Pro Rounded', ...` |
| `mono` | `ui-monospace` | `monospace` | `SFMono-Regular, Menlo, Monaco, ...` |

**Font Sizes Used:**
| Element | Size | Weight | Extra |
|---|---|---|---|
| Title (collapsed, scroll) | 17px | 400 | letterSpacing: -0.5 |
| Title (expanded, large) | 42px | 400 | letterSpacing: -0.5, serif on iOS |
| Note list title | 18px | 600 | - |
| Note preview | 14px | - | - |
| Note date | 12px | - | - |
| Editor text | 18px | - | lineHeight: 28, serif |
| Header "Notes" | 34px | bold | - |
| Saved notes list title | 17px | 500 | - |
| Saved notes date | 15px | - | opacity: 0.7 |
| Saved notes page title | 22px | 400 | letterSpacing: 0.5 |
| Floating menu label | 10px | 600 | - |
| Debug text | 12px | - | monospace |
| Date below title | 12px | - | - |
| Placeholder text | - | - | color: #9ca3af |
| ThemedText default | 16px | - | lineHeight: 24 |
| ThemedText title | 32px | bold | lineHeight: 32 |
| ThemedText subtitle | 20px | bold | - |
| ThemedText link | 16px | - | lineHeight: 30, color: #0a7ea4 |

### Glassmorphism / Frosted Glass Styles

The app makes **extensive** use of `BlurView` from `expo-blur` for glassmorphism effects:

1. **FloatingMenu**: `BlurView` with `intensity={40}`, tint matches theme, semi-transparent background overlay (`rgba(255,255,255,0.3)` light / `rgba(40,40,42,0.5)` dark)

2. **Main Background (App.js)**: Two stacked `BlurView` layers over watercolor dots:
   - First: `intensity={100}` -- heavy blur making dots look like soft orbs
   - Second: `intensity={60}` -- extra smoothness pass

3. **Sticky Header Blur (7 tiered layers for seamless falloff)**:
   - `intensity={30}` at height 130
   - `intensity={25}` at height 140
   - `intensity={20}` at height 150
   - `intensity={15}` at height 160
   - `intensity={10}` at height 170
   - `intensity={5}` at height 180
   - `intensity={2}` at height 190

4. **Saved Notes Overlay**: `BlurView intensity={25}` over semi-transparent background

5. **Image Loading Shimmer**: `BlurView intensity={40}` over animated gradient

### Spacing Conventions
| Context | Value |
|---|---|
| Screen horizontal padding | 24px |
| List content horizontal padding | 20px |
| Note card padding | 15px |
| Note card border radius | 12px |
| Note card margin bottom | 12px |
| FAB bottom offset | 120px (above FloatingMenu) |
| FAB size | 56x56px, borderRadius: 28 |
| FloatingMenu width | 60px, borderRadius: 30 |
| Icon circle size | 44x44px, borderRadius: 22 |
| Modal border radius | 20px |
| Modal padding | 24px |
| Button border radius | 12px |
| Editor content paddingTop | 280px (for sticky header space) |
| Editor content paddingBottom | 300px |
| Image block border radius | 12px |
| Image block height | 220px |
| Image margin | 12px vertical, 24px horizontal |

### Animations

**Thinking Indicator**: Braille dot wave animation at 100ms interval:
```
Frames: ⠁⠄ -> ⠁⠂ -> ⠂⠁ -> ⠄⠁ -> ⠄⠂ -> ⠂⠄
```

**Watercolor Dots**: Bloom animation 5-8 seconds, opacity 0.05-0.15, organic drift 8-20 seconds between random positions.

**Text Streaming**: Character-by-character typing effect at configurable speed (default 40ms for fill, 50ms for response, 30ms for delete).

**Title**: Scroll-based interpolation from 42px to 17px as user scrolls (0-120px range).

---

## 4. Data Model

### Note Object

```typescript
// From hooks/useNotes.ts (simplified version)
interface Note {
  id: string;           // Timestamp string (Date.now().toString())
  title: string;        // Auto-generated or default "New Note"
  content: string;      // Raw text content (may contain [IMG||url||alt] markers)
  updatedAt: number;    // Unix timestamp (Date.now())
}

// Extended version in App.js (full production model)
interface NoteExtended {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  colorFamily: string;           // Color family name: 'burntOrange' | 'darkBlue' | 'bloodRed' | 'deepPurple'
  colorDots: ColorDotData[];     // Saved watercolor dot state
}

interface ColorDotData {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;                  // 80-200px
  blotShapes: BlotShape[];       // Watercolor blot shapes for rendering
  opacityValue: number;          // Saved opacity (0.05-0.15)
}

interface BlotShape {
  offsetX: number;
  offsetY: number;
  scale: number;                 // 0.25-1.0
  opacity: number;               // 0.15-0.50
  rotation: number;              // 0-360 degrees
  scaleX: number;                // 0.6-1.4
  scaleY: number;                // 0.6-1.4
  color: string;                 // Hex color from family palette
}
```

### Image Markers in Content

Images are stored inline in note content using a custom marker format:
```
[IMG||<url>||<alt-text>]
```

Loading placeholders use:
```
__IMG_LOADING_<timestamp>__
```

### Storage

- **Storage Engine**: `@react-native-async-storage/async-storage`
- **Notes Key**: `notes_data` -- stores JSON array of all notes
- **API Key**: `llm_api_key` -- stores OpenRouter API key string
- **Sorting**: Notes sorted by `updatedAt` descending (most recent first)
- **Limits**: Notes list in overlay shows max 50 notes

### Content Blocks (Runtime Only)

Text with image markers is parsed at runtime into content blocks for rendering:
```typescript
type ContentBlock = 
  | { type: 'text'; content: string }
  | { type: 'image'; uri: string; alt: string }
  | { type: 'image_loading'; placeholder: string }
```

---

## 5. Screens and Navigation

### Primary App (App.js - Single Screen Architecture)

The root `App.js` uses a **single-screen architecture** with overlay-based navigation:

1. **Editor View** (default): Full-screen text editor with:
   - Animated sticky header (title + date, shrinks on scroll)
   - Watercolor dot background with dual BlurView layers
   - Animated gradient background
   - Content block rendering (text + images)
   - FloatingMenu (draggable, left/right snap)

2. **Saved Notes Overlay**: Slides in via opacity animation over the editor. Contains:
   - Animated title ("X Notes" that types into "//" after 2 seconds, tappable to toggle)
   - Scrollable list of saved notes (title, preview, date)
   - Tiered blur header matching editor style
   - No explicit "new note" button (handled via FloatingMenu)

3. **API Key Modal**: Platform-specific:
   - iOS: `Alert.prompt` with secure text
   - Android: Full modal with TextInput

### Secondary App (Expo Router - `app/` directory)

Uses Expo Router Stack navigation:

1. **`/` (index.tsx)**: Notes list with:
   - Header "Notes"
   - FlatList of note cards
   - FAB "+" button -> navigates to `/note/new`

2. **`/note/[id]` ([id].tsx)**: Note editor with:
   - Simplified editor (no images, no watercolor dots)
   - Saved notes overlay (slide up/down gesture)
   - Pan responder for swipe navigation
   - Direct OpenRouter API calls (not using proxy helper)

3. **`/modal` (modal.tsx)**: Boilerplate modal screen

4. **`/(tabs)` layout**: Boilerplate tab structure (Home + Explore). **Not actively used** in the navigation flow since the root `_layout.tsx` only defines `index` and `note/[id]` routes.

### FloatingMenu Navigation

The FloatingMenu acts as the primary navigation control:
- **Theme**: Toggle light/dark with color circle selection
- **Notes**: Opens/closes saved notes overlay
- **New**: Creates a new note (shows when viewing saved notes)
- **API**: Opens API key input (hidden in proxy mode)
- **Debug**: Toggle debug panel (requires "dev mode boing boing" text in editor)

---

## 6. OpenRouter API Proxy

### Proxy URL
```
https://writer-app-proxy.inlaynoteapp.workers.dev
```

### Configuration (`constants/api.js`)
```javascript
export const PROXY_URL = 'https://writer-app-proxy.inlaynoteapp.workers.dev';
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1';
```

### Two Operating Modes

1. **Proxy Mode** (production, `PROXY_URL` is set):
   - No API key needed from user
   - All requests go through Cloudflare Worker
   - Worker adds `Authorization: Bearer <OPENROUTER_API_KEY>` header
   - API button hidden in FloatingMenu
   - Validates via `/validate` endpoint

2. **Direct Mode** (development, `PROXY_URL` is `null`):
   - User provides their own OpenRouter API key
   - Stored in AsyncStorage under `llm_api_key`
   - API button visible in FloatingMenu
   - Validates via OpenRouter `/auth/key` endpoint

### API Helper (`App.js::makeApiCall`)
```javascript
const makeApiCall = async (endpoint, body, apiKey) => {
  const baseUrl = getApiBaseUrl();
  const usingProxy = isProxyMode();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(usingProxy ? {} : {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/elijahking/text-editor-app',
      'X-Title': 'Inlay App',
    }),
  };
  // ...
};
```

### LLM Models Used

| Model | Usage | Temperature |
|---|---|---|
| `anthropic/claude-haiku-4.5` | Batch fill (multiple blanks), inline fill, pronoun resolution for images | 0.1 - 0.2 |
| `google/gemini-2.5-flash-lite` | Title generation (proxy mode) | 0.3 |
| `google/gemini-2.5-flash-lite-preview-09-2025` | Title generation, single fill, batch fill (Expo Router version) | 0.2 - 0.3 |

### LLM Features

1. **Single Fill (`/`)**: User types `/` as a placeholder, then `//` triggers fill. Uses `SYSTEM_PROMPT` to fill 1-4 words.
2. **Batch Fill (`//`)**: Finds all `/` placeholders, sends all at once with `BATCH_FILL_PROMPT`, gets JSON array of answers, animates them sequentially.
3. **Inline Fill (`//` without placeholders)**: Direct text completion at cursor position.
4. **Auto Title Generation**: After 3s debounce, when text > 20 chars and changed by > 50 chars. Animated delete-then-type effect.
5. **Easter Egg**: Typing `//` in an empty editor triggers "Boing boing!" animation. Typing "dev mode boing boing" enables debug panel.

### OpenRouter Plugins
- Web search plugin: `{ id: "web", max_results: 3 }` used for fill operations.

---

## 7. R2 Storage Bucket

### URL
```
https://pub-7e101bb6531543ad99554a132a4ac26f.r2.dev
```

### Finding: NOT USED IN CODEBASE

**No references** to this R2 storage bucket URL were found anywhere in the codebase (source files, configs, or package files). The R2 bucket exists but is not integrated into the current application code.

This may be:
- Planned for future use (e.g., image storage, note sync)
- Used externally (e.g., hosting landing page assets)
- A leftover from previous development

---

## 8. Authentication

### Current State: FULLY IMPLEMENTED

The app has a **complete email/password authentication system** built on Cloudflare Workers. User authentication is separate from the OpenRouter API proxy (section 6), which continues to use its own API key pattern for LLM requests.

### Backend: Auth Worker (`cloudflare-workers/auth/worker.js`)

A dedicated Cloudflare Worker handles all authentication logic:

- **User storage**: Cloudflare KV namespace. Users stored under `user:{userId}` keys with email index entries at `email:{email}` for lookup.
- **Password hashing**: PBKDF2-SHA256 with 100,000 iterations and random 16-byte salt via `crypto.subtle`. Passwords are never stored in plaintext.
- **JWT tokens**: HMAC-SHA256 signed tokens with 7-day expiry (`604800` seconds). Payload contains `sub` (user ID), `email`, `iat`, and `exp` claims. The `JWT_SECRET` is stored as a Cloudflare secret (set via `wrangler secret put JWT_SECRET`).
- **Timing-safe comparison**: Password verification uses a constant-time comparison that does not leak length information (no early exit on length mismatch).

### API Endpoints

| Path | Method | Description |
|---|---|---|
| `POST /api/auth/register` | POST | Create a new account. Accepts `{ email, password }`. Returns `{ user, token }`. Rate limited to 5 requests per IP per hour. |
| `POST /api/auth/login` | POST | Authenticate. Accepts `{ email, password }`. Returns `{ user, token }`. Rate limited to 10 requests per IP per 15 minutes. |
| `GET /api/auth/me` | GET | Validate token and return current user. Requires `Authorization: Bearer <token>` header. |
| `GET /health` | GET | Health check (public, no auth required). |

### Input Validation and Security

- **Email**: Must be a valid format, max 254 characters (RFC 5321).
- **Password**: Minimum 8 characters, maximum 128 characters.
- **Request body size**: Limited to 10 KB to prevent abuse.
- **Rate limiting**: IP-based, using a separate `RATE_LIMIT_KV` namespace with TTL-based expiry. Login: 10 attempts per IP per 15 minutes. Register: 5 attempts per IP per hour. Returns HTTP 429 when exceeded. Gracefully degrades if KV is unavailable.
- **Registration enumeration prevention**: Duplicate email registration returns a generic error message ("Registration failed. Please try again or sign in if you already have an account.") rather than confirming whether the email exists.
- **CORS**: Origin-based allowlist (not wildcard `*`). Reflects the request origin only if it matches a predefined list of allowed origins (localhost dev ports + production domains). Includes `Access-Control-Allow-Credentials: true`.
- **Error responses**: Global try/catch returns generic `"Internal server error"` messages. No stack traces or internal configuration details are ever leaked to the client.
- **Method validation**: Known paths with incorrect HTTP methods return 405 (Method Not Allowed) instead of 404.

### Reusable Auth Middleware (`cloudflare-workers/auth/auth-middleware.js`)

Provides three exports for use by other Cloudflare Workers (e.g., the document-sync worker):

- **`corsHeaders(request)`**: Function that returns CORS headers with origin-based allowlist (same list as the auth worker). Not a static object -- accepts the request to read the `Origin` header.
- **`validateAuthToken(request, jwtSecret)`**: Extracts and verifies the JWT from the `Authorization: Bearer <token>` header. Returns the decoded payload or `null`.
- **`withAuth(handler)`**: Higher-order function that wraps a request handler with authentication. Adds `request.auth` (the decoded JWT payload) to the request object before passing it to the wrapped handler. Returns 401 if the token is missing or invalid.

### Mobile Client (`services/auth.ts` + `context/AuthContext.tsx`)

- **Token storage**: `expo-secure-store` for encrypted storage (iOS Keychain / Android Keystore) under the key `writer_auth_token`. This is hardware-backed encrypted storage, not plaintext AsyncStorage.
- **Auth service** (`services/auth.ts`): Provides `login()`, `register()`, `logout()`, `getCurrentUser()`, `getToken()`, and `validateToken()` functions. Includes input validation (`validateInputs()` trims email, checks for empty fields) and network error handling (fetch failures throw user-friendly messages without calling `logout()`).
- **AuthContext** (`context/AuthContext.tsx`): React context providing `user`, `isLoading`, `isSubmitting`, `isAuthenticated`, `login`, `register`, `logout`, `error`, and `clearError`. Key design: `isLoading` is `true` only during the initial session restoration on mount, while `isSubmitting` is `true` during active login/register API calls. This separation prevents the loading screen from reappearing during form submission. Uses `mountedRef` to guard against state updates after unmount.
- **AuthGate** (`components/auth/AuthGate.tsx`): Wrapper component that enforces default-deny security posture. When `isLoading` is true, a loading screen is shown (with 400ms minimum display time and fade-in animation). When `isAuthenticated` is false, login/register screens are shown. Protected content (children) only renders when both conditions are met: loading is complete AND user is authenticated.

### Desktop Client (`desktop/src/services/auth.ts` + `desktop/src/context/AuthContext.tsx`)

- **Token storage**: `localStorage` under keys `writer_auth_token` and `writer_auth_user`. This is the standard approach for web SPAs. All localStorage access is wrapped in try/catch for environments where it may be unavailable.
- **Auth service** (`desktop/src/services/auth.ts`): Same interface as mobile (`login`, `register`, `logout`, `validateToken`, `getToken`). Includes input validation, network error handling, and a client-side JWT expiration check (`isTokenExpired()`) that avoids unnecessary network requests for expired tokens. The `validateToken()` function preserves the stored token on network errors (only clears on explicit 401/403 from the server). API base URL is configurable via `VITE_API_URL` environment variable with production fallback.
- **AuthContext** (`desktop/src/context/AuthContext.tsx`): Same interface as mobile (`user`, `isLoading`, `isSubmitting`, `isAuthenticated`, `login`, `register`, `logout`, `error`, `clearError`).
- **Route guards** (`desktop/src/main.tsx`): React Router-based guards enforce default-deny:
  - `GuestOnly` -- redirects authenticated users away from login/register pages.
  - `RequireAuth` -- redirects unauthenticated users to `/login`.
  - `RequireOnboarding` -- redirects users who have completed onboarding to `/` (first-time use flow).
  - All guards show a loading screen during the initial auth check to prevent content flash.

### Auth File Structure

```
cloudflare-workers/auth/
  worker.js              # Auth API Worker (register, login, me endpoints)
  wrangler.toml          # Worker config (KV bindings, no secrets in file)
  package.json           # Worker package
  test.mjs               # Auth worker test suite
  auth-middleware.js      # Reusable CORS + JWT validation for other workers
  sync-worker-example.js # Example of integrating auth middleware

services/auth.ts              # Mobile auth service (expo-secure-store-based)
context/AuthContext.tsx        # Mobile auth React context

desktop/src/services/auth.ts   # Desktop auth service (localStorage-based)
desktop/src/context/AuthContext.tsx # Desktop auth React context

components/auth/
  AuthGate.tsx           # Mobile default-deny wrapper
  LoginScreen.tsx        # Mobile login UI
  RegisterScreen.tsx     # Mobile registration UI
```

### OpenRouter Proxy API Key (Separate from User Auth)

The OpenRouter API proxy (`backend/worker.js`) uses its own `OPENROUTER_API_KEY` secret to authenticate with the OpenRouter API on behalf of all users. This is **not** user authentication -- it is a server-side API key that the proxy injects into outbound LLM requests. The Google API key for image search is stored as a plaintext var in `backend/wrangler.toml` (see section 9 for details). User authentication via the auth worker is a separate system that identifies and authorizes individual users.

---

## 9. Cloudflare Workers Configuration

### Wrangler Config (`backend/wrangler.toml`)
```toml
name = "writer-app-proxy"
main = "worker.js"
compatibility_date = "2024-01-01"

[vars]
GOOGLE_API_KEY = "AIzaSyDuHImCJP0XN4iVhGjJRbWB4zc9scxvyIw"
```

### Secrets (set via `wrangler secret put`)
- `OPENROUTER_API_KEY`: OpenRouter API key (not in code)

### Worker Endpoints

| Path | Method | Description |
|---|---|---|
| `/` or `/health` | GET | Health check (returns `{ status: 'ok', configured: bool }`) |
| `/validate` | GET | Validates the stored OpenRouter API key via `/auth/key` |
| `/chat/completions` or `/v1/chat/completions` | POST | Proxies to OpenRouter chat completions API |
| `/models` or `/v1/models` | GET | Proxies to OpenRouter models list |
| `/search-image` | POST | Searches for images using Gemini + Google Search + Wikipedia/Wikimedia |
| `/generate-image` | POST | Generates images using Gemini API |

### Image Search Pipeline (`/search-image`)

1. **Gemini with Google Search grounding**: Identifies the subject's Wikipedia article title
2. **Wikimedia Commons search**: Searches for images in the Wikimedia Commons namespace, validates URL server-side
3. **Wikipedia summary fallback**: Gets the article summary thumbnail as last resort
4. Returns `{ images: [{ url, title }] }` or empty array

### Image Generation (`/generate-image`)

1. Uses `gemini-2.5-flash-image` model with `responseModalities: ['IMAGE', 'TEXT']`
2. Returns base64-encoded image data: `{ imageData, mimeType }`
3. App converts to `data:` URI for display

### CORS
- `Access-Control-Allow-Origin: *` (open to all origins)
- Methods: GET, POST, OPTIONS
- Headers: Content-Type, Authorization

### Deployment
```bash
cd backend
npx wrangler deploy
npx wrangler secret put OPENROUTER_API_KEY
```

---

## 10. Package.json Dependencies and Scripts

### Scripts
```json
{
  "start": "expo start",
  "android": "expo start --android",
  "ios": "expo start --ios",
  "web": "expo start --web",
  "lint": "expo lint",
  "reset-project": "node ./scripts/reset-project.js"
}
```

### Production Dependencies (25 packages)

| Package | Version | Active Usage |
|---|---|---|
| `@expo/vector-icons` | ^15.0.3 | YES - Ionicons throughout |
| `@react-native-async-storage/async-storage` | ^2.2.0 | YES - Primary storage |
| `@react-navigation/bottom-tabs` | ^7.4.0 | MINIMAL - boilerplate tabs |
| `@react-navigation/elements` | ^2.6.3 | MINIMAL |
| `@react-navigation/native` | ^7.1.8 | YES - navigation core |
| `expo` | ~54.0.30 | YES - platform |
| `expo-blur` | ~15.0.8 | YES - glassmorphism effects |
| `expo-constants` | ~18.0.10 | MINIMAL |
| `expo-file-system` | ~19.0.19 | NOT USED in source |
| `expo-font` | ~14.0.9 | MINIMAL |
| `expo-haptics` | ~15.0.8 | YES - tab haptics |
| `expo-image` | ~3.0.11 | YES - image rendering |
| `expo-linear-gradient` | ~15.0.8 | YES - backgrounds, shimmers |
| `expo-linking` | ~8.0.11 | MINIMAL |
| `expo-router` | ~6.0.21 | YES - file-based routing |
| `expo-secure-store` | ~15.0.8 | YES - Encrypted auth token storage (iOS Keychain / Android Keystore) |
| `expo-sharing` | ~14.0.8 | NOT USED in source |
| `expo-splash-screen` | ~31.0.13 | YES - splash config |
| `expo-status-bar` | ~3.0.9 | YES - status bar theming |
| `expo-symbols` | ~1.0.8 | YES - iOS SF Symbols |
| `expo-system-ui` | ~6.0.9 | MINIMAL |
| `expo-web-browser` | ~15.0.10 | MINIMAL (plugin) |
| `marked` | ^17.0.1 | NOT USED in source |
| `react` | 19.1.0 | YES - core |
| `react-dom` | 19.1.0 | YES - web target |
| `react-native` | 0.81.5 | YES - core |
| `react-native-gesture-handler` | ~2.28.0 | YES - gestures |
| `react-native-markdown-display` | ^7.0.2 | NOT USED in source |
| `react-native-reanimated` | ~4.1.1 | YES - animations |
| `react-native-render-html` | ^6.3.4 | NOT USED in source |
| `react-native-safe-area-context` | ~5.6.0 | YES - safe areas |
| `react-native-screens` | ~4.16.0 | YES - native screens |
| `react-native-svg` | 15.12.1 | MINIMAL |
| `react-native-web` | ~0.21.0 | YES - web support |
| `react-native-worklets` | 0.5.1 | MINIMAL - reanimated support |

### Dev Dependencies
```json
{
  "@types/react": "~19.1.0",
  "eslint": "^9.25.0",
  "eslint-config-expo": "~10.0.0",
  "typescript": "~5.9.2"
}
```

### Backend Dependencies (`backend/package.json`)
```json
{
  "devDependencies": {
    "wrangler": "^4.54.0"
  }
}
```

### Potentially Removable Packages
- `marked` - installed but unused
- `react-native-markdown-display` - installed but unused
- `react-native-render-html` - installed but unused
- `expo-file-system` - installed but unused
- `expo-sharing` - installed but unused

---

## 11. Key Application Logic

### LLM Fill System (Core Feature)

The app's primary innovation is slash-based LLM text completion:

1. User types `/` to mark blanks in text
2. User types `//` to trigger fill of all blanks
3. If `//` is typed mid-sentence without `/` placeholders, it triggers inline completion
4. Batch fill sends all blanks to LLM in one request with `[FILL_N]` markers
5. Responses are animated character-by-character into the text

### Image Command System

Syntax: `/image <query>/` triggers inline image insertion:
1. Pronoun resolution via Claude Haiku (if note has context)
2. Image search via Gemini + Google Search grounding
3. Fallback: Gemini image generation
4. Result stored as `[IMG||url||alt]` in note content
5. Loading state shown with animated shimmer component

### Watercolor Dot System

Each LLM call creates a visual "dot" on the background:
- **Size**: Based on API latency (200-2500ms mapped to 80-200px)
- **Color**: Based on token count within the note's color family
- **Shape**: 5-8 overlapping circles with irregular transforms
- **Animation**: 5-8 second fade-in, then continuous organic drift

### Auto-Save Behavior

- App.js: Manual save triggered on note switch and overlay open (NOT auto-save on every keystroke)
- Expo Router version: Auto-save on unmount, back press

### Dev Mode

Hidden debug features activated by typing "dev mode boing boing" in the editor:
- Shows Debug button in FloatingMenu
- Debug panel shows LLM status, theme, sent messages, raw responses
- Reset button clears all app state
- Hidden by typing "dev mode boing boing hide"

---

## Summary of Critical Architecture Decisions

1. **Dual entry point ambiguity**: `App.js` is the real app; `app/` directory is secondary. Any new features should target `App.js` unless migrating to Expo Router.

2. **Auth-separated data model**: User authentication is fully implemented (see section 8), but note data is still stored locally on-device via AsyncStorage. Cloud sync for per-user document storage is designed (see `cloudflare-workers/document-sync/` and `API_DOCS.md`) but not yet integrated into the mobile app's main data flow.

3. **Proxy-first API**: The proxy mode hides the OpenRouter key. Direct mode exists as development fallback.

4. **Heavy visual effects**: Extensive use of `BlurView` for glassmorphism -- performance-sensitive on lower-end devices.

5. **Monolithic component**: `App.js` is 2167 lines in a single component. Significant refactoring opportunity.

6. **Mixed JS/TS**: Root `App.js` is JavaScript; `app/` directory and supporting files are TypeScript.

7. **Unused dependencies**: Several npm packages are installed but never used in source code.

8. **No tests**: No test files or test configuration found in the project.

9. **R2 bucket not integrated**: The R2 storage URL exists but has no code references.

10. **Security concern**: Google API key is in plaintext in `wrangler.toml` `[vars]` instead of being a secret.
