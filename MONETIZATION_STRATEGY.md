# Writer -- Monetization Strategy

> A comprehensive monetization plan for Writer, a minimal AI-powered note-taking app built with React Native/Expo, featuring a frosted glass aesthetic, AI inline autocomplete via OpenRouter proxy on Cloudflare Workers, and cross-platform support (iOS, Android, Web).

---

## Table of Contents

1. [Competitive Differentiator Analysis](#1-competitive-differentiator-analysis)
2. [Freemium Tier Structure](#2-freemium-tier-structure)
3. [Payment Integration Plan](#3-payment-integration-plan)
4. [Additional Revenue Services](#4-additional-revenue-services)
5. [Implementation Roadmap](#5-implementation-roadmap)
6. [Financial Projections](#6-financial-projections)

---

## 1. Competitive Differentiator Analysis

### Market Positioning

Writer sits at the intersection of three pillars that no single competitor fully combines:

| Pillar | Description |
|---|---|
| **Beautiful Minimal Design** | Frosted glass aesthetic (Expo Blur), distraction-free writing, light/dark themes |
| **Intelligent AI Assistance** | Inline autocomplete (`/` and `//` triggers), contextual completions via OpenRouter, streaming text animation |
| **Seamless Cross-Platform Sync** | React Native + Expo targeting iOS, Android, and Web from a single codebase |

### Competitor Breakdown

| Feature | **Writer** | Google Docs | Notion | Bear | iA Writer |
|---|:---:|:---:|:---:|:---:|:---:|
| Minimal, distraction-free UI | Yes | No | No | Yes | Yes |
| AI writing assistance (built-in) | Yes | Limited (Gemini add-on) | Yes (add-on, extra cost) | No | No |
| Frosted glass / modern aesthetic | Yes | No | No | Partial | No |
| Cross-platform (iOS, Android, Web) | Yes | Yes | Yes | No (Apple only) | Partial (no Android) |
| Free tier available | Yes | Yes | Yes | Limited | No (one-time purchase) |
| Offline-first | Yes | Limited | Limited | Yes | Yes |
| Simple onboarding (< 1 min) | Yes | Yes | No | Yes | Yes |
| Real-time collaboration | Planned | Yes | Yes | No | No |

#### Google Docs
- **Strengths**: Ubiquitous, free, real-time collaboration, deep enterprise integrations.
- **Weaknesses**: Bloated for personal note-taking. The UI is cluttered with toolbars, menus, and formatting options. AI features (Gemini) feel bolted on rather than natively integrated. Mobile experience is sluggish. No aesthetic appeal -- it looks like a productivity spreadsheet, not a writing tool.
- **Writer's advantage**: Writer is purpose-built for writing, not document management. The AI is native to the experience (type `/`, get completions), not hidden behind a sidebar prompt. The frosted glass UI makes writing feel calm and intentional.

#### Notion
- **Strengths**: Powerful databases, flexible block system, templates, team workspaces.
- **Weaknesses**: Steep learning curve. New users face a blank canvas with dozens of block types, database views, and configuration options. Performance suffers with large workspaces. AI features cost extra ($8-10/user/mo on top of plan). The UI, while clean, is dense and information-heavy.
- **Writer's advantage**: Writer does one thing exceptionally well: writing. No databases, no Kanban boards, no property schemas. Open the app, start writing, get AI help inline. The cognitive load is near zero compared to Notion.

#### Bear
- **Strengths**: Beautiful native design, Markdown support, tagging system, fast and reliable.
- **Weaknesses**: Apple ecosystem only (no Android, no web). No AI features whatsoever. No real-time collaboration. Subscription ($2.99/mo) unlocks sync but offers no intelligent features. Development pace is slow.
- **Writer's advantage**: Cross-platform from day one. AI inline autocomplete is a generational leap over Bear's static text editing. Writer matches Bear's design quality while adding intelligence and broader platform reach.

#### iA Writer
- **Strengths**: Best-in-class typography, focus mode, content blocks, solid Markdown support.
- **Weaknesses**: One-time purchase at $49.99 per platform (iOS + Mac = ~$100). No AI features. No cloud collaboration. Limited to Apple + Windows (no Android, web is file-based). Feels premium but static -- the product has not evolved meaningfully in years.
- **Writer's advantage**: AI-native writing experience at a lower price point. Cross-platform sync included. The frosted glass aesthetic is a modern counterpoint to iA Writer's utilitarian design. Writer's freemium model removes the upfront cost barrier entirely.

### Writer's Unique Value Proposition

> **Writer is the note-taking app for people who want to think clearly, write beautifully, and let AI handle the rest -- on any device.**

The competitive moat is the combination of:
1. **Aesthetic differentiation** -- The frosted glass UI, powered by `expo-blur` and `expo-linear-gradient`, creates an emotional connection that productivity tools lack.
2. **AI-native workflow** -- The `/` and `//` inline triggers make AI feel like a natural extension of typing, not a separate tool or sidebar.
3. **Cross-platform parity** -- A single Expo codebase ensures that switching between iPhone, Android tablet, and web browser is seamless.
4. **Simplicity as a feature** -- Auto-save, auto-generated titles, swipe gestures, and zero configuration. Writer respects the user's time and attention.

---

## 2. Freemium Tier Structure

### Tier Overview

| Feature | Free | Pro ($5/mo or $48/yr) | Team ($12/user/mo) |
|---|:---:|:---:|:---:|
| **Documents** | 3 | Unlimited | Unlimited |
| **Basic formatting** (bold, italic, headings) | Yes | Yes | Yes |
| **Device access** | 1 device | Unlimited devices | Unlimited devices |
| **Cross-device sync** | -- | Yes | Yes |
| **AI inline autocomplete** (`/` and `//`) | 10 uses/day | Unlimited | Unlimited |
| **AI writing tools** (summarize, rewrite, expand, grammar, tone) | -- | Yes | Yes |
| **Advanced formatting** (tables, code blocks, footnotes) | -- | Yes | Yes |
| **Export to PDF / DOCX** | -- | Yes | Yes |
| **Custom themes** | Default light/dark | All themes | All themes + custom branding |
| **Real-time collaboration** | -- | -- | Yes |
| **Shared workspaces** | -- | -- | Yes |
| **Admin controls** (user management, permissions) | -- | -- | Yes |
| **Team templates** | -- | -- | Yes |
| **Priority support** | -- | -- | Yes |
| **API access** | -- | -- | Yes (rate-limited) |

### Tier Design Rationale

#### Free Tier -- "Hook"
- **3 documents**: Enough to experience the app's quality, tight enough to create upgrade pressure. Users who write regularly will hit the limit within days.
- **10 AI uses/day**: Lets users experience the magic of inline autocomplete without giving away the farm. The limit resets daily to encourage habitual use.
- **Single device**: Removes sync as a free feature, making cross-platform the primary upgrade driver.
- **Goal**: Convert to Pro within 14 days of first use. The free tier should feel generous enough to build trust but limited enough to make the value of Pro obvious.

#### Pro Tier -- "Core Revenue"
- **$5/mo or $48/yr (20% annual discount)**: Priced below Bear ($2.99/mo with no AI), Notion AI ($8/mo add-on), and iA Writer ($49.99 one-time). The annual plan at $48 is the sweet spot -- less than $1/week.
- **Unlimited AI**: The primary value driver. Summarize, rewrite, expand, grammar check, and tone adjustment transform Writer from a note-taking app into an AI writing partner.
- **Cross-device sync**: Essential for users with multiple devices. Sync is technically low-cost (leveraging existing auth infrastructure) but perceived as high-value.
- **Export**: PDF and DOCX export unlocks professional use cases (sharing drafts, submitting work, archiving).
- **Goal**: 60-70% of revenue. Pro is the workhorse tier.

#### Team Tier -- "Expansion Revenue"
- **$12/user/mo**: Competitive with Notion Team ($8/user/mo) and Google Workspace ($7.20/user/mo), justified by AI inclusion. No annual discount initially to maximize short-term revenue from early adopters.
- **Real-time collaboration**: Collaborative editing using CRDTs (Conflict-Free Replicated Data Types) or OT (Operational Transformation). This is the most complex feature to build but creates the strongest lock-in.
- **Shared workspaces**: Folder-level sharing with role-based permissions (Owner, Editor, Viewer).
- **Admin controls**: User provisioning, usage analytics, billing management.
- **Team templates**: Shared template library for consistent formatting across the organization.
- **Goal**: 20-30% of revenue. Higher ARPU, stronger retention, and pathway to enterprise.

### Upgrade Triggers

| Trigger | Conversion Point |
|---|---|
| User creates 4th document | Soft paywall: "Upgrade to Pro for unlimited documents" |
| User exceeds 10 AI uses in a day | Soft paywall: "Upgrade to Pro for unlimited AI assistance" |
| User logs in on second device | Prompt: "Sync your notes across devices with Pro" |
| User tries to export | Paywall: "Export to PDF/DOCX is a Pro feature" |
| User tries to share a document for editing | Prompt: "Real-time collaboration is available on Team" |

---

## 3. Payment Integration Plan

### Architecture Overview

```
+-------------------+       +-------------------+       +-------------------+
|                   |       |                   |       |                   |
|   Writer App      |       |   Auth Backend    |       |   User Database   |
|   (Expo/RN)       +------>+   (Cloudflare     +------>+   (D1 / Postgres) |
|                   |       |    Workers)        |       |                   |
+--------+----------+       +--------+----------+       +-------------------+
         |                           |
         |                           |
    +----+----+                +-----+------+
    |         |                |            |
    v         v                v            v
+---+---+ +---+----+    +-----+----+ +-----+----+
| Stripe| |Revenue |    | Stripe   | |RevenueCat|
| Web   | |  Cat   |    | Webhooks | | Webhooks |
| Chkout| | (iOS)  |    |          | |          |
+-------+ +--------+    +----------+ +----------+
```

### 3.1 Stripe (Web and Android Payments)

Stripe handles all non-iOS subscription billing. This covers web users and Android users (Google Play billing can also be managed through RevenueCat, but Stripe is the primary web payment processor).

#### Implementation Details

**Stripe Checkout (Subscription Initiation)**
- Use Stripe Checkout Sessions for the initial subscription flow.
- Create a Cloudflare Worker endpoint (`/api/create-checkout-session`) that generates a Checkout Session with the appropriate `price_id` for Pro monthly, Pro annual, or Team.
- Redirect the user to Stripe's hosted checkout page. This avoids PCI compliance complexity.
- On success, Stripe redirects to a confirmation page; the webhook confirms payment.

```
POST /api/create-checkout-session
Body: { tier: "pro_monthly" | "pro_annual" | "team", userId: "..." }
Response: { checkoutUrl: "https://checkout.stripe.com/..." }
```

**Stripe Billing (Recurring Management)**
- Use Stripe Billing for subscription lifecycle management: upgrades, downgrades, cancellations, payment method updates.
- Create a Customer Portal session (`/api/create-portal-session`) so users can self-manage their subscription without custom UI.
- Proration is handled automatically by Stripe when users switch plans mid-cycle.

**Stripe Webhooks**
- Deploy a webhook handler at `/api/stripe-webhook` on Cloudflare Workers.
- Critical events to handle:

| Webhook Event | Action |
|---|---|
| `checkout.session.completed` | Activate subscription, update user tier in DB |
| `invoice.paid` | Confirm renewal, extend subscription period |
| `invoice.payment_failed` | Mark subscription as `past_due`, send recovery email |
| `customer.subscription.updated` | Handle plan changes (upgrade/downgrade) |
| `customer.subscription.deleted` | Revert user to Free tier |

- All webhooks are verified using Stripe's signature verification (`stripe-signature` header) to prevent spoofing.

**Stripe Product/Price Configuration**
| Product | Price ID Pattern | Amount | Interval |
|---|---|---|---|
| Writer Pro Monthly | `price_pro_monthly` | $5.00 | month |
| Writer Pro Annual | `price_pro_annual` | $48.00 | year |
| Writer Team Monthly | `price_team_monthly` | $12.00/user | month |

### 3.2 RevenueCat (iOS In-App Purchases)

RevenueCat abstracts away StoreKit complexity and provides a unified SDK for managing iOS subscriptions.

#### Why RevenueCat Over Raw StoreKit
- **Receipt validation**: Server-side receipt verification without building custom infrastructure.
- **Entitlement management**: A single `isEntitledTo("pro")` API call replaces complex receipt parsing.
- **Analytics**: Built-in MRR, churn, and trial conversion dashboards.
- **Cross-platform support**: If Android billing is later routed through RevenueCat, the same SDK handles both.
- **Server-side webhook**: RevenueCat pushes subscription events to our backend, keeping the user database in sync.

#### Implementation Details

**SDK Integration**
- Install `react-native-purchases` (RevenueCat's React Native SDK).
- Initialize in the app's root layout (`app/_layout.tsx`) with the RevenueCat API key.
- Configure offerings in the RevenueCat dashboard to match the three tiers.

**Offerings Configuration**
| Offering | Product | Apple Price | Duration |
|---|---|---|---|
| `default` | `writer_pro_monthly` | $4.99 | 1 month |
| `default` | `writer_pro_annual` | $47.99 | 1 year |
| `default` | `writer_team_monthly` | $11.99 | 1 month |

Note: Apple takes a 30% commission (15% for small businesses under $1M revenue). Prices are set to match Stripe pricing as closely as Apple's tiered pricing allows.

**Purchase Flow**
1. User taps "Upgrade to Pro" in the app.
2. App checks platform: iOS uses RevenueCat, Web uses Stripe.
3. On iOS, `Purchases.purchasePackage(package)` presents the native StoreKit purchase sheet.
4. On success, RevenueCat validates the receipt and updates entitlements.
5. RevenueCat fires a webhook to our backend to update the user database.

**RevenueCat Webhooks**
- Configure webhook URL: `https://api.writer-app.com/api/revenuecat-webhook`
- Events to handle:

| Event Type | Action |
|---|---|
| `INITIAL_PURCHASE` | Activate subscription, update user tier |
| `RENEWAL` | Extend subscription period |
| `CANCELLATION` | Schedule downgrade to Free at period end |
| `BILLING_ISSUE` | Flag account, trigger in-app recovery prompt |
| `EXPIRATION` | Revert to Free tier |

### 3.3 Cross-Platform Subscription Sync

The critical challenge: a user who subscribes via Stripe on the web must be recognized as Pro on iOS, and vice versa. This requires a unified entitlement layer in the backend.

#### Sync Architecture

**User Database Schema**
```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  tier          TEXT DEFAULT 'free',        -- 'free' | 'pro' | 'team'
  stripe_cust   TEXT,                        -- Stripe customer ID
  rc_user_id    TEXT,                        -- RevenueCat app user ID
  sub_source    TEXT,                        -- 'stripe' | 'revenuecat'
  sub_status    TEXT DEFAULT 'none',         -- 'active' | 'past_due' | 'canceled' | 'none'
  sub_expires   TIMESTAMP,                   -- Current period end
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);
```

**JWT Claims for Subscription Tier**
- When a user authenticates, the JWT includes subscription information:
```json
{
  "sub": "user_abc123",
  "email": "user@example.com",
  "tier": "pro",
  "sub_status": "active",
  "sub_expires": "2025-02-15T00:00:00Z",
  "iat": 1706000000,
  "exp": 1706086400
}
```
- The app reads `tier` from the JWT to gate features client-side.
- All API requests include the JWT; the backend validates the tier claim against the database before processing gated requests (AI calls, sync, export).
- JWTs are short-lived (24h) to ensure tier changes propagate quickly. A refresh token mechanism issues new JWTs with updated claims.

**Webhook-Driven State Machine**
```
Stripe Webhook                RevenueCat Webhook
     |                              |
     v                              v
+----+------------------------------+----+
|        Auth Backend (Workers)           |
|                                         |
|  1. Verify webhook signature            |
|  2. Map event to user (by email/ID)     |
|  3. Update tier + status in DB          |
|  4. Invalidate cached JWT claims        |
|  5. (Optional) Push notification        |
+-----------------------------------------+
```

**Conflict Resolution**
- If a user has both a Stripe and RevenueCat subscription, the backend uses the most recently activated subscription as the source of truth.
- On login, the app checks entitlements from both RevenueCat (client-side) and the backend JWT (server-side). If they disagree, the backend wins, and the app refreshes its local state.
- A reconciliation job runs daily to catch edge cases (e.g., webhook delivery failures).

**Platform Detection for Purchase Flow**
```typescript
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

async function handleUpgrade(tier: 'pro' | 'team') {
  if (Platform.OS === 'ios') {
    // Use RevenueCat for iOS
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find(
      p => p.identifier === `$rc_${tier}`
    );
    if (pkg) await Purchases.purchasePackage(pkg);
  } else {
    // Use Stripe for web/Android
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify({ tier }),
    });
    const { checkoutUrl } = await response.json();
    // Redirect to Stripe Checkout
    await WebBrowser.openBrowserAsync(checkoutUrl);
  }
}
```

---

## 4. Additional Revenue Services

### 4.1 AI Writing Assistant Features

Building on the existing OpenRouter proxy infrastructure (Cloudflare Workers + OpenRouter API), Writer can offer advanced AI writing tools as a core Pro feature.

#### Feature Set

| Feature | Description | Implementation |
|---|---|---|
| **Summarize** | Condense selected text or entire document into key points | System prompt: "Summarize the following text concisely..." |
| **Rewrite** | Rephrase selected text while preserving meaning | System prompt: "Rewrite the following text in a clearer way..." |
| **Expand** | Elaborate on selected text with additional detail | System prompt: "Expand on the following text with more detail..." |
| **Grammar Check** | Identify and correct grammatical errors | System prompt: "Check the following text for grammar errors and return corrected version..." |
| **Tone Adjustment** | Shift tone (formal, casual, persuasive, academic) | System prompt with tone parameter: "Rewrite in a {tone} tone..." |

#### Cost Management
- All AI features route through the existing Cloudflare Worker proxy (`backend/worker.js`).
- The proxy enforces rate limits per user tier:
  - Free: 10 AI operations/day (inline autocomplete only).
  - Pro: 500 AI operations/day (all features).
  - Team: 1,000 AI operations/user/day.
- Model selection is optimized for cost: use smaller/faster models (e.g., `mistralai/mistral-7b-instruct`) for grammar checks and lightweight rewrites; reserve larger models (e.g., `anthropic/claude-3.5-sonnet`) for complex expansions and summaries.
- Estimated cost per AI operation: $0.001 - $0.01 depending on model and token count. At 500 ops/day for a Pro user, worst-case daily cost is $5.00, but average usage will be far lower (estimated 20-50 ops/day per active user = $0.05-$0.50/day).

#### UX Integration
- Select text and tap a floating toolbar with AI actions (Summarize, Rewrite, Expand, Grammar, Tone).
- Results stream in with the existing text animation system (`utils/animations.js`).
- Users can accept, reject, or iterate on AI suggestions.
- The frosted glass aesthetic extends to the AI toolbar -- a blurred, translucent panel that feels native to the app.

### 4.2 Template Marketplace

A marketplace for document templates, offering both curated (first-party) and community-created templates.

#### Template Categories
- **Writing**: Blog posts, essays, short stories, journal entries
- **Professional**: Meeting notes, project briefs, status updates, SOPs
- **Academic**: Research papers, lab reports, thesis outlines, study guides
- **Personal**: Daily planners, gratitude journals, habit trackers, travel logs
- **Creative**: Screenplays, poetry collections, worldbuilding docs, character sheets

#### Revenue Model

| Template Type | Price | Revenue Split |
|---|---|---|
| **Free templates** (basic set) | $0 | N/A -- included in all tiers |
| **Curated premium templates** | $1.99 - $4.99 each | 100% to Writer |
| **Community templates** | $0.99 - $2.99 each | 70% creator / 30% Writer |
| **Template packs** (bundles of 5-10) | $4.99 - $9.99 | 70% creator / 30% Writer |

#### Community Creator Program
- Any Pro or Team user can submit templates for review.
- Templates are reviewed for quality, formatting, and content policy compliance.
- Approved templates are listed in the marketplace with creator attribution.
- Creators earn 70% of each sale, paid out monthly via Stripe Connect.
- Top creators get featured placement and a "Verified Creator" badge.

#### Implementation
- Templates are stored as JSON documents with metadata (title, description, category, tags, preview image, author).
- A template is essentially a pre-filled document with placeholder sections and formatting.
- The marketplace UI is a grid view within the app, accessible from the home screen.
- Templates are downloaded and instantiated as new documents.

### 4.3 Custom Themes

Premium theme packs that extend Writer's visual identity beyond the default light/dark themes.

#### Theme Offerings

| Theme Pack | Description | Price |
|---|---|---|
| **Frosted Glass Variants** | Ocean Frost, Rose Frost, Midnight Frost, Forest Frost, Sunset Frost | $2.99 (pack of 5) |
| **Minimal Ink** | High-contrast themes inspired by ink on paper -- Sepia, Charcoal, Blueprint, Parchment | $2.99 (pack of 4) |
| **Night Owl** | Ultra-dark themes for late-night writing -- OLED Black, Deep Navy, Obsidian, Cosmic | $2.99 (pack of 4) |
| **Seasonal** | Limited-edition seasonal themes (Spring Bloom, Summer Haze, Autumn Warmth, Winter Calm) | $1.99 (pack of 4) |
| **Custom Theme Creator** | Tool for Pro/Team users to create and save their own themes | Included with Pro |

#### Implementation
- Themes are defined as JSON configuration files extending the existing `constants/theme.ts` structure.
- Each theme specifies: background colors/gradients, text colors, blur intensity, tint colors, accent colors, and optional background images.
- Themes are downloaded and cached locally using `expo-file-system`.
- The theme switcher in the floating menu expands to show purchased themes alongside default options.
- Team tier includes custom branding: upload a logo, set organization colors, create a branded theme for all team members.

### 4.4 Writer API (Developer Access)

A REST API that exposes Writer's note management and AI features for developers, enabling integrations and automations.

#### API Tiers

| Tier | Rate Limit | Price |
|---|---|---|
| **Included with Team** | 100 requests/hour | $0 (included) |
| **Developer** | 1,000 requests/hour | $29/mo |
| **Business** | 10,000 requests/hour | $99/mo |

#### API Endpoints (Planned)

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/documents` | GET | List all documents |
| `/api/v1/documents` | POST | Create a new document |
| `/api/v1/documents/:id` | GET | Get document by ID |
| `/api/v1/documents/:id` | PUT | Update a document |
| `/api/v1/documents/:id` | DELETE | Delete a document |
| `/api/v1/ai/summarize` | POST | Summarize provided text |
| `/api/v1/ai/rewrite` | POST | Rewrite provided text |
| `/api/v1/ai/expand` | POST | Expand provided text |
| `/api/v1/ai/grammar` | POST | Check grammar of provided text |
| `/api/v1/ai/complete` | POST | Inline completion (same as `/` trigger) |

#### Use Cases
- **Zapier/Make integration**: Auto-create notes from emails, Slack messages, or calendar events.
- **CLI tool**: `writer create "Meeting notes for Q1 review"` from the terminal.
- **Browser extension**: Clip web content directly into Writer.
- **Third-party apps**: Embed Writer's AI writing tools in other apps.

---

## 5. Implementation Roadmap

### Phase 1: Foundation (Months 1-2)

**Goal**: Establish the authentication system and basic paywall infrastructure.

| Task | Details | Effort |
|---|---|---|
| User authentication | Email/password + OAuth (Google, Apple) via Cloudflare Workers + D1 database | 3 weeks |
| JWT-based session management | Short-lived access tokens (24h) + refresh tokens, tier claims in JWT | 1 week |
| Document ownership | Associate documents with user accounts, migrate from AsyncStorage to synced storage | 2 weeks |
| Document limit enforcement | Free tier: 3 document cap with soft paywall UI | 1 week |
| Basic paywall UI | Upgrade prompts at limit triggers, tier comparison modal | 1 week |

**Deliverables**:
- Users can sign up, log in, and own their documents.
- Free tier limits are enforced (3 docs, 10 AI uses/day, single device).
- Paywall UI is polished and on-brand (frosted glass modals).

**Key Decisions**:
- Auth provider: Build on Cloudflare Workers + D1 to stay within the existing infrastructure. Evaluate Clerk or Supabase Auth if custom auth proves too complex.
- Storage migration: Move from `AsyncStorage` to a server-synced model where documents are stored in D1/Postgres and cached locally.

---

### Phase 2: Pro Tier Launch (Months 3-4)

**Goal**: Launch the Pro tier with Stripe payments on web and Android.

| Task | Details | Effort |
|---|---|---|
| Stripe integration | Checkout Sessions, Billing Portal, webhook handler on Workers | 2 weeks |
| Subscription management backend | CRUD operations on subscriptions, status tracking in DB | 1 week |
| Pro feature gates | Unlock unlimited docs, AI, advanced formatting, export based on JWT tier | 2 weeks |
| PDF/DOCX export | Client-side document export using `react-native-html-to-pdf` (iOS/Android) and server-side for web | 2 weeks |
| Subscription management UI | Settings screen: current plan, usage stats, manage subscription (links to Stripe portal) | 1 week |

**Deliverables**:
- Users can subscribe to Pro via Stripe on web.
- Pro features are unlocked immediately upon payment.
- Users can manage their subscription (upgrade, downgrade, cancel) through the Stripe Customer Portal.

**Launch Strategy**:
- Announce Pro on Product Hunt and Twitter/X.
- Offer a 30-day free trial for the first 1,000 users.
- 20% early adopter discount on annual plans for the first month.

---

### Phase 3: iOS IAP + Cross-Platform Sync (Months 5-6)

**Goal**: Enable iOS in-app purchases via RevenueCat and reliable cross-device sync.

| Task | Details | Effort |
|---|---|---|
| RevenueCat SDK integration | Install `react-native-purchases`, configure offerings, implement purchase flow | 2 weeks |
| App Store product setup | Create subscription products in App Store Connect, configure pricing tiers | 1 week |
| Cross-platform entitlement sync | Webhook handlers for RevenueCat, reconciliation with Stripe subscriptions | 2 weeks |
| Cross-device document sync | Real-time sync using WebSockets or polling, conflict resolution (last-write-wins or CRDT) | 3 weeks |
| Offline support | Queue changes when offline, sync when connection is restored | 1 week |

**Deliverables**:
- iOS users can subscribe to Pro via native IAP.
- Subscription status syncs seamlessly between Stripe and RevenueCat.
- Documents sync across all devices in near real-time.
- Offline editing works reliably with conflict resolution.

**Key Decisions**:
- Sync strategy: Start with last-write-wins for simplicity. Migrate to CRDTs if user demand for real-time collaboration justifies the complexity.
- Offline queue: Use a local-first architecture where all writes go to local storage first, then sync to the server. The server is the eventual source of truth.

---

### Phase 4: AI Writing Tools + Team Tier (Months 7-9)

**Goal**: Launch the full AI writing assistant suite and the Team tier.

| Task | Details | Effort |
|---|---|---|
| AI writing tools backend | New endpoints on the OpenRouter proxy: `/summarize`, `/rewrite`, `/expand`, `/grammar`, `/tone` | 2 weeks |
| AI writing tools UI | Floating toolbar on text selection, streaming results, accept/reject flow | 3 weeks |
| Team tier backend | Workspace model, user roles (Owner, Admin, Editor, Viewer), invitation system | 3 weeks |
| Real-time collaboration | CRDT-based collaborative editing (Yjs or Automerge integration) | 4 weeks |
| Team billing | Per-seat Stripe billing, admin dashboard for seat management | 2 weeks |

**Deliverables**:
- Pro users can summarize, rewrite, expand, grammar-check, and tone-adjust selected text.
- Teams can create shared workspaces with role-based access.
- Real-time collaborative editing works across devices.
- Team admins can manage seats and billing.

**Key Decisions**:
- CRDT library: Yjs is recommended for its maturity, WebSocket provider, and React bindings. Automerge is an alternative if Yjs performance is insufficient.
- Collaboration UX: Show remote cursors with user names/colors. Document presence indicators on the home screen.

---

### Phase 5: Marketplace + Themes + API (Months 10-12)

**Goal**: Launch revenue diversification features.

| Task | Details | Effort |
|---|---|---|
| Template marketplace backend | Template storage, search, purchase flow, creator payouts (Stripe Connect) | 3 weeks |
| Template marketplace UI | Browse, preview, purchase, and instantiate templates | 2 weeks |
| Custom themes system | Theme JSON schema, theme store, theme switcher UI expansion | 2 weeks |
| Theme creator tool | In-app theme customization for Pro/Team users | 2 weeks |
| Writer API v1 | REST API with authentication, rate limiting, documentation | 3 weeks |
| API developer portal | API key management, usage dashboard, documentation site | 2 weeks |

**Deliverables**:
- Template marketplace is live with curated and community templates.
- Premium theme packs are available for purchase.
- Pro/Team users can create custom themes.
- Writer API v1 is documented and available to Team/Developer subscribers.
- Creator program is launched for community template contributors.

---

### Roadmap Timeline Summary

```
Month 1  |====== Phase 1: Auth + Paywall ======|
Month 2  |====================================|
Month 3  |====== Phase 2: Stripe + Pro ========|
Month 4  |====================================|
Month 5  |==== Phase 3: RevenueCat + Sync ====|
Month 6  |====================================|
Month 7  |==== Phase 4: AI Tools + Teams =====|
Month 8  |====================================|
Month 9  |====================================|
Month 10 |=== Phase 5: Marketplace + API =====|
Month 11 |====================================|
Month 12 |====================================|
```

---

## 6. Financial Projections

### Assumptions

| Metric | Value | Rationale |
|---|---|---|
| Monthly organic downloads (Year 1) | 2,000 | Product Hunt launch, SEO, word-of-mouth |
| Monthly organic downloads (Year 2) | 5,000 | Growing brand awareness, App Store optimization |
| Free-to-Pro conversion rate | 5% | Industry average for freemium writing apps: 3-7% |
| Pro monthly churn rate | 5% | Industry average for $5/mo SaaS: 4-6% |
| Annual plan adoption | 40% | Incentivized by 20% discount |
| Team tier adoption | 2% of total users | Teams are a later-stage feature |
| Average team size | 5 users | Small creative teams, agencies |
| Customer Acquisition Cost (CAC) | $3.00 | Primarily organic; some paid social ($1-5 CPI) |
| Pro monthly LTV | $60.00 | Average 12-month retention at $5/mo |
| Pro annual LTV | $86.40 | 1.8-year avg retention at $48/yr |
| Team LTV (per seat) | $108.00 | Average 9-month retention at $12/mo |

### Year 1 Revenue Projection (Conservative)

| Quarter | Cumulative Users | New Pro Subs | Active Pro Subs | Pro MRR | Team MRR | Total MRR |
|---|---:|---:|---:|---:|---:|---:|
| Q1 (Months 1-3) | 6,000 | 150 | 135 | $675 | $0 | $675 |
| Q2 (Months 4-6) | 12,000 | 300 | 390 | $1,950 | $0 | $1,950 |
| Q3 (Months 7-9) | 18,000 | 300 | 600 | $3,000 | $360 | $3,360 |
| Q4 (Months 10-12) | 24,000 | 300 | 765 | $3,825 | $720 | $4,545 |

**Year 1 Total Revenue: ~$126,000**

*Note: Pro MRR accounts for 5% monthly churn. Team MRR assumes 30 users in Q3, growing to 60 in Q4. Annual plan revenue is amortized monthly.*

### Year 2 Revenue Projection (Conservative)

| Quarter | Cumulative Users | New Pro Subs | Active Pro Subs | Pro MRR | Team MRR | Marketplace/Themes | Total MRR |
|---|---:|---:|---:|---:|---:|---:|---:|
| Q1 | 39,000 | 750 | 1,200 | $6,000 | $1,440 | $500 | $7,940 |
| Q2 | 54,000 | 750 | 1,575 | $7,875 | $2,160 | $1,000 | $11,035 |
| Q3 | 69,000 | 750 | 1,900 | $9,500 | $3,000 | $1,500 | $14,000 |
| Q4 | 84,000 | 750 | 2,175 | $10,875 | $3,600 | $2,000 | $16,475 |

**Year 2 Total Revenue: ~$594,000**

### Revenue Breakdown by Source (Year 2 Steady State)

| Revenue Source | % of Total |
|---|---:|
| Pro Subscriptions | 65% |
| Team Subscriptions | 25% |
| Template Marketplace | 5% |
| Custom Themes | 3% |
| API Access | 2% |

### Key Metrics Dashboard

| Metric | Target (Month 6) | Target (Month 12) | Target (Month 24) |
|---|---:|---:|---:|
| Monthly Active Users (MAU) | 3,600 | 7,200 | 25,200 |
| Paying Users | 300 | 825 | 2,475 |
| Monthly Recurring Revenue (MRR) | $1,950 | $4,545 | $16,475 |
| Annual Recurring Revenue (ARR) | $23,400 | $54,540 | $197,700 |
| Customer Acquisition Cost (CAC) | $3.00 | $3.50 | $4.00 |
| Pro Lifetime Value (LTV) | $60.00 | $60.00 | $72.00 |
| LTV:CAC Ratio | 20:1 | 17:1 | 18:1 |
| Free-to-Pro Conversion Rate | 5% | 5% | 6% |
| Monthly Churn (Pro) | 5% | 5% | 4% |
| Net Revenue Retention (NRR) | -- | 105% | 110% |

### Cost Structure (Monthly, at Month 12)

| Cost Category | Monthly Cost | Notes |
|---|---:|---|
| AI API costs (OpenRouter) | $500 | ~$0.005/operation avg, ~100K operations/mo |
| Cloudflare Workers | $25 | Workers Paid plan, D1 storage |
| Stripe fees (2.9% + $0.30) | $145 | On ~$3,000 Stripe-processed revenue |
| Apple commission (15-30%) | $230 | On ~$1,500 iOS revenue (assuming SBDP 15%) |
| RevenueCat | $0 | Free up to $2.5K MTR |
| Infrastructure (domain, email, etc.) | $50 | DNS, transactional email, monitoring |
| **Total Monthly Costs** | **$950** | |
| **Monthly Gross Margin** | **~79%** | At $4,545 MRR |

### Break-Even Analysis

| Scenario | Monthly Fixed Costs | Required MRR | Timeline |
|---|---:|---:|---|
| Solo developer (no salary) | $950 | $950 | Month 3 |
| Solo developer ($5K/mo salary) | $5,950 | $5,950 | Month 10 |
| Small team (2 devs, $10K/mo) | $10,950 | $10,950 | Month 14 |

### Revenue Growth Levers

| Lever | Impact | Effort |
|---|---|---|
| Increase free-to-Pro conversion (5% to 8%) | +60% Pro revenue | Medium -- A/B test paywall copy, trial length, feature gates |
| Reduce Pro churn (5% to 3%) | +40% Pro LTV | Medium -- Improve onboarding, engagement emails, feature education |
| Launch Team tier | +25% total revenue | High -- Requires collaboration infrastructure |
| Annual plan push (40% to 60%) | +15% revenue (reduced churn) | Low -- Pricing page optimization, annual-first defaults |
| Template marketplace | +5% total revenue | Medium -- Build marketplace, recruit creators |
| International pricing | +20% downloads | Low -- Stripe/RevenueCat support regional pricing natively |

---

## Appendix: Risk Factors and Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Apple rejects IAP implementation | Medium | High | Follow App Store Review Guidelines strictly; use RevenueCat's battle-tested SDK |
| AI costs exceed revenue per user | Low | High | Rate limits per tier; model selection optimization; cache frequent responses |
| Low conversion rate (< 3%) | Medium | High | A/B test paywall triggers; extend free trial; add more free AI uses to demonstrate value |
| Competitor launches similar AI+minimal app | Medium | Medium | Move fast on brand identity; build community; leverage first-mover advantage in this niche |
| Cloudflare Workers limitations at scale | Low | Medium | Architecture allows migration to dedicated servers if needed; Workers scale automatically to millions of requests |

---

*Document version: 1.0*
*Last updated: 2025*
*Owner: Writer Product Team*
