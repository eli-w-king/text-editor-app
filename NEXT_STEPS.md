# Next Steps -- Writer App

## Competitive Advantage (Summary)

Writer's core differentiator is the intersection of three qualities competitors
only offer individually:

1. **Premium visual aesthetic** -- visionOS-inspired frosted glass UI with
   watercolor dot accents. No competitor matches this level of polish in a
   note/writing app.
2. **AI-native writing** -- built-in AI writing tools (summarize, rewrite,
   expand, grammar, tone) powered by local proxy to avoid exposing API keys.
3. **True cross-platform parity** -- the same aesthetic and functionality on
   iOS, Android, and desktop web, backed by per-user cloud sync via Cloudflare
   R2. Each user has their own isolated storage namespace scoped by their JWT
   `sub` claim (user ID).

**Per-user storage**: Yes -- each user has their own area in Cloudflare R2.
Documents are stored at `documents/{user_id}/{document_id}.json` with a
per-user `_index.json` for fast listing. The document-sync worker validates
the JWT and extracts the user ID from the token, so users can only access
their own documents.

**Auth connectivity**: The login/register flow connects to a Cloudflare Workers
auth backend (`writer-app-auth`) that uses KV for user storage and
PBKDF2-SHA256 for password hashing. JWTs are issued on login/register and
validated on every API call.

---

## 1. Branded Welcome Email on Account Creation

### What You Need

To send a branded email when a user creates an account, set up one of:

**Option A: Cloudflare Email Workers (recommended for your stack)**

1. **Domain**: You need a custom domain (e.g., `inlaynoteapp.com`) configured
   in Cloudflare.
2. **Cloudflare Email Routing**: Enable Email Routing in the Cloudflare
   dashboard for your domain.
3. **Email Worker**: Create a new Cloudflare Worker that sends emails using the
   `send()` API. Cloudflare Workers can send emails via the Email Workers API
   (currently in beta).
4. **Trigger**: In `cloudflare-workers/auth/worker.js`, after a successful
   registration (after the `USERS_KV.put` calls), call the email worker via a
   Service Binding or a fetch to the email worker's endpoint.
5. **HTML Template**: Create a branded HTML email template with Writer's
   frosted glass aesthetic (inline CSS only -- email clients strip `<style>`
   tags). Include the Writer logo, a welcome message, and a CTA to open the
   app.

**Option B: Resend (easiest third-party option)**

1. Sign up at [resend.com](https://resend.com) (free tier: 3,000 emails/month).
2. Verify your domain via DNS TXT record.
3. Get an API key and store it as a Cloudflare Worker secret:
   `wrangler secret put RESEND_API_KEY`
4. In `handleRegister()` in `worker.js`, after creating the user, call:
   ```
   fetch('https://api.resend.com/emails', {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${env.RESEND_API_KEY}`,
       'Content-Type': 'application/json',
     },
     body: JSON.stringify({
       from: 'Writer <hello@inlaynoteapp.com>',
       to: normalizedEmail,
       subject: 'Welcome to Writer',
       html: welcomeEmailHtml(normalizedEmail),
     }),
   })
   ```
5. Fire-and-forget (do not block the registration response on email delivery).

**Option C: SendGrid / Mailgun / Postmark**

Same pattern as Resend -- REST API call from the Worker. All support free tiers
for low volume.

### Email Verification Flow

If you want email verification (not just a welcome email):

1. Generate a random verification token and store it in KV with a TTL
   (e.g., 24 hours): `verification:{token} -> userId`.
2. Include a verification link in the welcome email:
   `https://writer-app-auth.inlaynoteapp.workers.dev/verify?token={token}`
3. Add a `/verify` endpoint in the auth worker that looks up the token,
   marks the user as verified in KV, and redirects to a success page.
4. Optionally gate certain features (e.g., AI tools) behind verified status.

---

## 2. LLM Transition Affordances (ALREADY BUILT)

The following LLM transition affordances are already implemented in
`desktop/src/components/LLMTransitions.tsx` and integrated into
`desktop/src/pages/EditorPage.tsx`:

| Component | Purpose | Status |
|---|---|---|
| `LLMThinkingIndicator` | 3-dot pulse inline where AI text will appear (2.4s cycle, staggered 0.4s per dot) | Built |
| `StreamingTextTransition` | Word-by-word materialization of streamed LLM text (200ms fade-in per word) | Built |
| `SkeletonLoader` | Glass shimmer placeholder lines while waiting for initial AI response | Built |
| `ImageGenerationShimmer` | Frosted glass rectangle with slow pulse for AI image generation | Built |
| `TransitionOverlay` | Ultra-subtle full-editor ambient dim (opacity 0.02-0.05) during AI ops | Built |

The mobile app (`App.js`) also has its own thinking animation (dot-leader
progression at 220ms intervals) -- see the `useEffect` block around line 426.

**Integration status**: The LLM transition components are rendered in
EditorPage.tsx and their state is controlled by `aiSettersRef` -- a ref
object containing `setAiGenerating`, `setStreamingText`, and
`setImageGenerating`. When the AI integration layer is wired up, it will
call these setters to drive the visual transitions.

---

## 3. Ambient AI Integration Ideas

These ideas follow the "it just works" philosophy -- AI should feel like a
natural extension of the writing surface, not a bolt-on feature. The user
should never feel like they are "using AI"; instead, the app should feel
intelligent and anticipatory.

### 3.1 Ghost Text Completions (Inline Suggestions)

- After 1.5 seconds of typing inactivity, send the current paragraph to the
  LLM and render a ghost-text completion (low-opacity, italic) after the
  cursor position.
- User presses Tab to accept, Escape to dismiss, or just keeps typing to
  ignore.
- Completions should be contextually aware of the full document -- send the
  last 2000 characters as context, not just the current sentence.
- Limit to 1-2 sentences max to keep the UI clean.
- Use the existing `StreamingTextTransition` component to materialize
  accepted text.
- Throttle API calls: debounce at 1.5s, cancel in-flight requests when the
  user starts typing again. Never more than 1 request per 3 seconds.
- Free tier: 5 ghost completions per day. Pro: unlimited.

### 3.2 Smart Formatting Detection

- As the user types patterns like `1.`, `- `, `# `, `> `, the editor should
  automatically recognize these as list items, headings, or blockquotes and
  apply the corresponding formatting.
- This is not AI-powered -- it is a pure pattern match on the first few
  characters of a line. But it feels intelligent because the formatting
  "just happens" without the user touching the toolbar.
- On Enter after a list item, auto-continue the list. On Enter on an empty
  list item, exit the list.
- The transition should be smooth -- the text gently shifts into its
  formatted position over 200ms.

### 3.3 Paragraph-Level Tone Adjustment

- Long-press (mobile) or right-click (desktop) on a paragraph to open a
  radial context menu with tone options: Formal, Casual, Concise, Detailed,
  Persuasive.
- The selected paragraph fades to 60% opacity while the AI processes it,
  then materializes the rewritten version using `StreamingTextTransition`.
- The original text is stored in an undo buffer (Cmd/Ctrl+Z to revert).
- Maximum 500 words per selection.

### 3.4 Writing Session Summary

- When the user closes the app (or navigates away from the editor after
  writing for 5+ minutes), show a brief ambient card at the top of the
  document list:
  ```
  Today's session: 847 words in 22 minutes
  ```
- After longer sessions (30+ minutes), optionally show an AI-generated
  one-sentence summary of what was written. This is useful when the user
  comes back the next day and needs to remember where they left off.
- The summary card should use the same frosted glass styling as the rest of
  the UI and auto-dismiss after 10 seconds (or on tap).

### 3.5 Ambient Document Context

- On the document list page, each document card could show a 1-sentence
  AI-generated summary below the title, replacing the typical "first 100
  characters" preview.
- Generate these summaries once on save (background job) and cache them in
  the document metadata (the `metadata` field in the document-sync API
  already supports arbitrary fields).
- This gives the document list an intelligent feel without the user doing
  anything.

### 3.6 Smart Clipboard Formatting

- When the user pastes text from another source (web, email, PDF), the app
  should detect the source formatting and offer a subtle toast:
  "Pasted. Tap to match document style."
- If tapped, the pasted text is reformatted by the AI to match the tone
  and formatting of the surrounding text.
- If not tapped, the paste proceeds as-is after 3 seconds.

### 3.7 Ambient Grammar and Style

- While the editor is idle (user has not typed for 5+ seconds), run a
  background grammar/style check on the visible paragraphs.
- Errors are shown as ultra-subtle underlines (not the aggressive red
  squiggles of Word) -- use a muted tint color at 40% opacity.
- Tap/click on an underline to see the suggestion in a glass tooltip.
- Accept/dismiss with one tap. No multi-step modals.
- Use the existing OpenRouter proxy to run this through a fast model
  (e.g., GPT-4o-mini or Claude Haiku) for low latency.

### 3.8 Document Continuation on Open

- When a user opens a document they haven't edited in 24+ hours, show a
  subtle glass prompt at the bottom of the editor:
  "Continue where you left off?"
- Tapping it generates a 2-3 sentence continuation of the last paragraph,
  rendered with `StreamingTextTransition`.
- This creates the feeling that the app "remembers" what you were working
  on and is ready to help.

### 3.9 Title Suggestion

- If a document has no title and the user has written 2+ paragraphs,
  suggest a title in the title field as ghost text.
- The AI reads the first 500 characters and generates a concise,
  descriptive title.
- Tab to accept, keep typing to override.

---

## 4. Premium Improvement Ideas

### UI/UX Enhancements

- [ ] **Haptic feedback** -- subtle haptics on button presses, note creation,
  and toolbar actions (iOS Taptic Engine / Android vibration API).
- [ ] **Custom app icon** -- offer 3-5 alternative app icons that match the
  watercolor aesthetic (Settings > App Icon picker).
- [ ] **Focus mode** -- full-screen writing mode with everything hidden except
  the text. Gentle fade transitions in/out.
- [ ] **Ambient sound** -- optional lo-fi background sounds while writing
  (campfire, rain, white noise). Use Web Audio API.
- [ ] **Writing streaks** -- track daily writing habit with a streak counter
  and gentle encouragement (not gamification -- premium feels understated).
- [ ] **Smooth page transitions** -- shared element transitions between the
  document list and editor (React Navigation 7 shared transitions).
- [ ] **Keyboard shortcuts overlay** -- pressing `?` shows a frosted glass
  overlay listing all keyboard shortcuts. Dismisses on any key.
- [ ] **Typewriter scrolling** -- the active line stays vertically centered
  in the viewport as the user types, like iA Writer's typewriter mode.
- [ ] **Reading time estimate** -- show estimated reading time in the editor
  footer alongside word count. Use the standard 200 WPM formula.
- [ ] **Document version history** -- store the last 10 versions of each
  document in R2. Allow the user to browse and restore previous versions
  with a diff view.

### AI Features

- [ ] **Inline suggestions** -- ghost text that appears as the user types
  (like GitHub Copilot but for prose). Triggered after a pause.
- [ ] **Tone adjustment** -- slider to adjust the tone of selected text
  (formal <-> casual, concise <-> detailed).
- [ ] **Smart formatting** -- AI auto-detects when the user is writing a list,
  heading, or quote and applies formatting automatically.
- [ ] **Writing coach** -- end-of-session summary with readability score,
  word count trends, and style suggestions.
- [ ] **Translation** -- select text, right-click, "Translate to..." with
  a glass dropdown of languages. Uses the existing OpenRouter proxy.
- [ ] **Content expansion** -- select a bullet point or outline item, and
  the AI expands it into a full paragraph maintaining the document's tone.

### Premium Monetization

- [ ] **Theme packs** -- curated color themes beyond the default watercolor
  families (Tokyo Night, Solarized, Nord, Monokai).
- [ ] **Template marketplace** -- user-submitted templates for different writing
  formats (screenplays, academic papers, blog posts, journals).
- [ ] **Export to PDF** -- beautiful PDF export with the frosted glass aesthetic
  preserved as a print layout.
- [ ] **Collaboration** -- real-time collaborative editing on Team tier
  (Cloudflare Durable Objects for operational transform).
- [ ] **White-label API** -- allow power users and businesses to embed Writer's
  editor into their own products via an iframe or web component.

### Infrastructure

- [ ] **Offline-first sync** -- queue changes locally when offline, sync when
  connectivity returns. Use a CRDT or operational transform approach.
- [ ] **Push notifications** -- remind users of their writing streak.
  Use Expo Notifications + a scheduled Cloudflare Worker.
- [ ] **Analytics dashboard** -- per-user writing analytics (words per day,
  most productive hours, topic frequency). Store aggregates, not raw content.
- [ ] **CDN-cached document previews** -- generate preview thumbnails via
  Cloudflare Workers and cache in R2 for fast document list rendering.
- [ ] **Edge caching for document list** -- cache the user's `_index.json`
  response at the Cloudflare edge with a short TTL (30s) and stale-while-
  revalidate. This makes the document list feel instant.

### Security Hardening

- [ ] **CORS origin allowlist** -- the auth worker still uses wildcard `*` CORS
  in some code paths. Migrate all paths to the origin-based allowlist pattern
  already used by the document-sync worker.
- [ ] **Rate limiting with Durable Objects** -- replace KV-based approximate
  rate limiting with Durable Objects for consistent per-IP counting.
- [ ] **Refresh tokens** -- implement a refresh token rotation flow so the
  7-day JWT expiry can be shortened to 15 minutes without UX impact.
- [ ] **Content Security Policy** -- add CSP headers to the desktop web app
  and landing page to prevent XSS.
- [ ] **Subresource Integrity (SRI)** -- add integrity hashes to all external
  script/stylesheet tags (Google Fonts, etc.) to prevent CDN tampering.
- [ ] **HttpOnly cookie auth (BFF pattern)** -- migrate the desktop auth from
  localStorage JWT to HttpOnly cookies via a Backend-for-Frontend proxy.
  This eliminates XSS-based token theft.

---

## 5. Immediate Technical Debt

- [ ] Fix `components/GlobalUI.tsx` TS7006 error (parameter `key` needs type).
- [ ] Integrate `AuthProvider` + `AuthGate` into `App.js` -- the components
  exist but are not yet wired into the main mobile app entry point.
- [ ] Connect the document-sync client (`utils/documentSync.js`) to the mobile
  app's note storage so notes sync to the backend on save.
- [ ] Replace wildcard CORS in `cloudflare-workers/auth/worker.js` with the
  origin-based allowlist (already done in the document-sync worker).
- [ ] Wire the `LLMTransitions` components to the actual OpenRouter proxy
  calls in EditorPage.tsx -- currently the AI state defaults are all inactive.
- [ ] Add the `/documents` and `/editor/:documentId` routes to the landing
  page navigation so users can deep-link to specific documents.
- [ ] Implement the rich text editor replacement for the textarea in
  EditorPage.tsx (TipTap or ProseMirror recommended for the desktop web app).
