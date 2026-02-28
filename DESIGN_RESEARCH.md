# Design Research: Frosted Glass Document Editor

## Table of Contents
1. [Pinterest Aesthetic Analysis](#1-pinterest-aesthetic-analysis)
2. [Google Docs Feature & UX Analysis](#2-google-docs-feature--ux-analysis)
3. [Minimal Editor Inspiration](#3-minimal-editor-inspiration)
4. [Frosted Glass / Glassmorphism Patterns](#4-frosted-glass--glassmorphism-patterns)
5. [Competitive Positioning](#5-competitive-positioning)
6. [Monetization Strategy](#6-monetization-strategy)
7. [Feature Prioritization (MVP)](#7-feature-prioritization-mvp)
8. [Aesthetic Guidelines](#8-aesthetic-guidelines)

---

## 1. Pinterest Aesthetic Analysis

> Reference board: https://pin.it/4ytrSFEES

### Extracted Visual Themes

Based on the Pinterest board's direction and the existing app's design language (light/dark themes, blur effects via `expo-blur`, rounded UI elements), the following aesthetic themes are central:

#### 1.1 Frosted Glass / Translucency
- **Primary motif**: Semi-transparent surfaces with backdrop blur, reminiscent of Apple's visionOS and macOS Ventura aesthetics
- **Layering**: Multiple translucent layers stacked to create depth without heavy shadows
- **Light diffusion**: Soft, diffused lighting that passes through UI layers, creating an ethereal quality
- **Implementation note**: The app already uses `expo-blur` with `BlurView` (intensity 40) -- this foundation can be extended

#### 1.2 Soft, Muted Color Palette
- **Base tones**: Off-whites (`#F5F5F7`), warm grays (`#E8E8ED`), and deep charcoals (`#1C1C1E`)
- **Accent approach**: Minimal accent colors -- when used, they appear as soft pastels or desaturated tones rather than vivid primaries
- **Gradient usage**: Subtle linear gradients that simulate light passing through glass, not bold color transitions
- **No hard borders**: Surfaces defined by translucency differences rather than stroke/border lines

#### 1.3 Typography-Forward Design
- **Large, confident headings**: Serif or system fonts at generous sizes (36-48pt for titles)
- **Breathing room**: Generous line-height (1.5-1.8x) and paragraph spacing
- **Weight contrast**: Light body text (300-400 weight) paired with bold headings (600-700)
- **The app's existing serif-focused approach aligns well**: `headerTitle` at 42px with -0.5 letter spacing

#### 1.4 Minimal Chrome, Maximum Content
- **Toolbars recede**: Formatting controls are hidden until needed or are very subtle
- **Whitespace as design element**: Margins of 24-32px create a "page floating in space" feeling
- **No visual noise**: Borders, dividers, and icons are minimal and low-contrast
- **Focus mode**: The writing surface feels like an infinite, clean canvas

#### 1.5 Spatial Depth & Layering
- **Z-axis composition**: UI feels like stacked glass panes at different depths
- **Shadow language**: Very subtle, large-radius shadows (blur 20-40px, opacity 5-10%) rather than sharp drop shadows
- **Elevation hierarchy**: Menus and modals "float" above the writing surface with clear depth cues
- **Parallax hints**: Subtle motion parallax on scroll reinforces spatial depth

#### 1.6 Rounded, Organic Forms
- **Border radius**: Consistently large (16-30px on containers, 12px on inputs, full round on pills/circles)
- **The existing codebase follows this**: Menu container at `borderRadius: 30`, modal at `borderRadius: 20`
- **Button shapes**: Pill-shaped or circular, never sharp rectangles
- **Corner consistency**: All radiuses feel proportional -- larger containers get larger radiuses

#### 1.7 Dark Mode as First-Class
- **Not an afterthought**: Dark mode should feel premium, not just "inverted colors"
- **Dark glass aesthetic**: `rgba(40,40,42,0.5)` backgrounds with white text at 87% opacity
- **Luminance-based hierarchy**: In dark mode, brighter elements are "elevated"
- **Accent glow**: Subtle light emission from interactive elements in dark mode

---

## 2. Google Docs Feature & UX Analysis

### 2.1 Core Feature Set (What Makes It Best-in-Class)

#### Real-Time Collaborative Editing
- **Operational Transformation (OT)**: Conflict-free real-time multi-user editing
- **Presence indicators**: Colored cursors with user names for each collaborator
- **Revision history**: Granular, timestamped history with named versions
- **Suggesting mode**: Track changes equivalent -- suggestions appear as colored annotations
- **Comments & replies**: Threaded comments anchored to text ranges
- **Takeaway**: Collaboration is THE killer feature. Hard to replicate but essential for enterprise/team use.

#### Toolbar & Formatting
- **Persistent top toolbar**: Always-visible formatting bar with common actions
- **Context-sensitive menus**: Right-click and selection-triggered toolbars
- **Keyboard shortcuts**: Full suite of Ctrl/Cmd+B/I/U and advanced shortcuts
- **Format painter**: Copy formatting from one selection to another
- **Styles dropdown**: Heading 1-6, Normal text, Title, Subtitle as quick format presets
- **Font picker**: Extensive font library with preview
- **Takeaway**: Comprehensive formatting but HEAVY UI. Opportunity to simplify.

#### Document Structure
- **Automatic outline**: Generated from headings, shown in left sidebar
- **Page-based layout**: WYSIWYG pagination (print-first mentality)
- **Headers/footers**: Per-page customization
- **Table of contents**: Auto-generated, linked
- **Footnotes/endnotes**: Academic-grade referencing
- **Takeaway**: Page-based model feels dated for digital-first content. Continuous scroll is better for modern editors.

#### Media & Rich Content
- **Image insertion**: Drag-drop, URL, Google Photos, camera
- **Tables**: Full-featured spreadsheet-like tables
- **Charts**: Integration with Google Sheets
- **Drawings**: Built-in vector drawing tool
- **Smart chips**: Dynamic content like dates, people, files, places
- **Takeaway**: Tables and images are table stakes. Smart chips are a differentiator idea.

#### AI Features (Gemini Integration)
- **"Help me write"**: AI text generation within documents
- **Summarization**: Document summary generation
- **Tone adjustment**: Rewrite selections in different tones
- **Grammar/spell check**: Enhanced by AI beyond basic spellcheck
- **Image generation**: AI-generated images (Workspace Labs)
- **Takeaway**: AI writing assistance is now expected. The app's slash-command AI approach is MORE elegant than Google's sidebar model.

### 2.2 Google Docs UX Weaknesses (Opportunities)
- **Cluttered interface**: Toolbar takes significant vertical space
- **No offline-first**: Requires connectivity for core features
- **Poor mobile experience**: Feature-reduced, cramped on small screens
- **No native feel**: Web-based, lacks platform-native interactions
- **Design stagnation**: Material Design but not visually inspiring
- **Export friction**: PDF/Word export can have formatting issues
- **No focus mode**: No distraction-free writing option

---

## 3. Minimal Editor Inspiration

### 3.1 Notion

#### Strengths
- **Block-based architecture**: Every piece of content is a movable, transformable block
- **Slash commands**: Type `/` to access any block type (paragraph, heading, toggle, code, etc.)
- **Databases as documents**: Tables, Kanban boards, calendars, galleries within docs
- **Template system**: Pre-built and custom templates for various use cases
- **Inline embeds**: Seamless embedding of external content
- **Synced blocks**: Reusable content blocks that update everywhere

#### UX Patterns Worth Adopting
- **Slash command paradigm**: Already implemented in Writer via `/` and `//` -- this is a STRONG foundation
- **Hover-reveal toolbars**: Block handles and formatting only appear on hover/focus
- **Breadcrumb navigation**: Shows document hierarchy clearly
- **Toggle blocks**: Collapsible content sections
- **Callout blocks**: Highlighted information boxes with emoji icons

#### Weaknesses to Exploit
- **Performance**: Notorious for slow load times, especially on large documents
- **Complexity creep**: Has become overwhelming -- far from "minimal" origin
- **Offline reliability**: Sync conflicts and data loss concerns
- **Not a true writing tool**: More a productivity/wiki tool than a writing environment
- **Generic design**: Functional but aesthetically unremarkable

### 3.2 Bear

#### Strengths
- **Beautiful typography**: Carefully chosen fonts with excellent readability
- **Tag-based organization**: No folders -- flexible multi-tag system
- **Inline Markdown rendering**: See formatting WHILE typing in Markdown
- **Theme gallery**: Multiple beautiful themes (including frosted/translucent options)
- **Architecture notes**: Nested tags create pseudo-folder structures
- **Focus mode**: Highlights current paragraph, dims the rest

#### UX Patterns Worth Adopting
- **In-place Markdown rendering**: Bold text renders bold without hiding the `**` markers (hybrid approach)
- **Sidebar opacity**: Tag sidebar with translucent background
- **Typewriter scrolling**: Keeps current line centered vertically
- **Info panel**: Word count, character count, reading time as a subtle overlay
- **Editor themes**: Multiple carefully crafted color schemes beyond simple light/dark

#### Relevance to Our App
- Bear is the CLOSEST competitor in philosophy: minimal, beautiful, writing-focused
- Bear is Apple-only (iOS/macOS) -- our app already targets this demographic
- Bear 2 introduced more features but maintained aesthetic discipline
- Pricing: $2.99/month or $29.99/year -- premium positioning works

### 3.3 iA Writer

#### Strengths
- **Extreme focus**: The most disciplined minimal editor -- almost nothing on screen
- **Content blocks**: Embed other files within documents
- **Syntax highlighting for prose**: Highlights adjectives, nouns, verbs, etc. to improve writing
- **Style check**: Built-in writing quality analysis
- **Library management**: Simple file-system-based document management
- **Export excellence**: Best-in-class PDF, Word, HTML export with custom templates

#### UX Patterns Worth Adopting
- **Monospaced writing font**: Custom "iA Writer Duo/Quattro" fonts designed for writing
- **Focus mode (sentence/paragraph)**: Dims everything except current sentence or paragraph
- **Syntax control**: Color-coding parts of speech is a unique AI-adjacent feature
- **Preview pane**: Side-by-side edit/preview for Markdown
- **Minimal toolbar**: Almost no toolbar -- keyboard shortcuts and Markdown for formatting

#### Relevance to Our App
- iA Writer proves that LESS UI can command premium pricing ($49.99 one-time)
- Their "writing as craft" positioning resonates with serious writers
- Syntax highlighting for prose could be an AI-powered feature in our app
- One-time purchase model is attractive to users burned by subscriptions

### 3.4 Typst

#### Strengths
- **Modern typesetting**: LaTeX alternative with cleaner syntax
- **Real-time preview**: Instant compilation and preview
- **Programmable documents**: Scripting within documents for dynamic content
- **Beautiful output**: Publication-quality PDF output
- **Collaborative editing**: Built-in real-time collaboration
- **Version control friendly**: Plain-text source files

#### UX Patterns Worth Adopting
- **Split-pane editing**: Code on left, rendered output on right
- **Error feedback**: Inline error/warning indicators
- **Template system**: Reusable document templates for different formats
- **Bibliography management**: Built-in citation handling

#### Relevance to Our App
- Typst shows demand for beautiful document OUTPUT, not just editing experience
- The academic/professional market values quality typesetting
- Could inspire export features: beautifully typeset PDF output from our editor
- Programmable templates could be a differentiator

---

## 4. Frosted Glass / Glassmorphism Patterns

### 4.1 Design Principles

#### Core Characteristics
1. **Background blur**: `backdrop-filter: blur(10-40px)` -- the defining feature
2. **Semi-transparent backgrounds**: `rgba()` values with 10-40% opacity
3. **Subtle borders**: 1px borders at 10-20% white/black opacity to define edges
4. **Multi-layer depth**: Multiple glass panes at different blur levels create hierarchy
5. **Light-sensitive**: Surfaces respond to background content/color, creating a living feel

#### Implementation Specifications for React Native
```
// Primary glass surface (toolbar, modals)
{
  backgroundColor: 'rgba(255, 255, 255, 0.25)', // Light mode
  // backgroundColor: 'rgba(30, 30, 30, 0.40)', // Dark mode
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: 'rgba(255, 255, 255, 0.18)',
  borderRadius: 20,
  overflow: 'hidden', // Required for BlurView
}

// BlurView settings
<BlurView
  intensity={50}          // 30-60 range for subtle effect
  tint="light"            // or "dark" / "default"
  experimentalBlurMethod="dimezisBlurView" // Android
/>

// Shadow for glass surfaces (light mode)
{
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.06,
  shadowRadius: 24,
  elevation: 8,
}
```

### 4.2 Glassmorphism in Document Editors -- Specific Applications

#### Writing Surface
- The main editor area should NOT be glass -- it should be solid for readability
- Instead, the BACKGROUND behind the editor can have subtle texture/gradient
- The editor "page" floats above the background like a frosted card
- Margin areas (outside the text column) can be translucent

#### Toolbar / Command Palette
- **Frosted toolbar**: Translucent formatting bar at top or bottom
- **Floating command palette**: `/` command menu as a frosted glass popover
- **Context menus**: Selection formatting popup as frosted glass
- **These are the PRIMARY glassmorphism touchpoints**

#### Navigation & Panels
- **Sidebar**: Document list/navigation as a frosted glass panel sliding over content
- **Settings sheet**: Bottom sheet or modal with glass effect
- **The existing FloatingMenu already implements this pattern well**

#### Status & Information
- **Word count overlay**: Small frosted pill showing document stats
- **Save status**: Translucent status indicator
- **Toast notifications**: Glass-effect notification banners

### 4.3 Glassmorphism Anti-Patterns to Avoid
- **No glass on text areas**: Reading through glass degrades readability
- **No excessive blur**: Over-blurred backgrounds look unfocused/broken, not elegant
- **No glass-on-glass stacking**: Multiple translucent layers without solid anchors looks muddy
- **No thin text on glass**: Use medium weight (500+) text on translucent backgrounds
- **No glass in high-contrast-mode**: Provide solid fallbacks for accessibility

### 4.4 Platform Considerations
- **iOS**: `BlurView` from `expo-blur` provides native-quality blur (UIVisualEffectView)
- **Android**: Blur effects are less performant; may need fallback to solid semi-transparent backgrounds
- **Web**: `backdrop-filter` has broad support but GPU-intensive; degrade gracefully
- **Performance**: Limit blurred surfaces to max 3-4 simultaneous layers

---

## 5. Competitive Positioning

### 5.1 Competitive Landscape Map

```
                    FEATURE-RICH
                        |
          Google Docs   |   Notion
          MS Word       |   Craft
                        |
   PROFESSIONAL --------+-------- PERSONAL
                        |
          iA Writer     |   Bear
          Typst         |   Writer (US)
                        |
                    MINIMAL
```

### 5.2 Our Unique Position: "Beautiful Writing, Powered by AI"

#### Primary Differentiators

1. **Frosted Glass Aesthetic**
   - No document editor currently owns this visual language
   - Apple-aligned users (our target demographic) respond to this aesthetic
   - Creates instant visual differentiation in App Store screenshots
   - The "visionOS for writing" angle is timely and compelling

2. **Inline AI via Slash Commands**
   - More natural than Google's sidebar AI or Notion's separate AI block
   - The `/` placeholder + `//` fill paradigm is unique and intuitive
   - AI feels like a writing PARTNER, not a separate tool
   - Lower friction than any competitor's AI integration

3. **Native iOS Performance**
   - React Native + Expo delivers near-native feel
   - Instant launch, smooth animations, native blur effects
   - Offline-first with local storage (AsyncStorage)
   - No web-view wrapper feel -- genuine native experience

4. **Minimal by Design Philosophy**
   - Not "still adding features" -- intentionally restrained
   - Every feature passes a high bar for inclusion
   - The anti-Notion: powerful through simplicity, not through options
   - Writing tool, not a productivity platform

### 5.3 Positioning Statement

> Writer is the most beautiful way to write on iOS. With its frosted glass interface and invisible AI assistance, Writer removes everything between you and your words. No cluttered toolbars. No feature overwhelm. Just you, your thoughts, and an AI co-writer that feels like intuition.

### 5.4 Competitive Comparison Matrix

| Feature | Writer (Ours) | Google Docs | Notion | Bear | iA Writer |
|---------|:---:|:---:|:---:|:---:|:---:|
| **Frosted glass UI** | YES | No | No | Partial | No |
| **Inline AI assist** | YES | Sidebar | Block-based | No | No |
| **Offline-first** | YES | No | Partial | Yes | Yes |
| **Native iOS** | YES | No (web) | Hybrid | Yes | Yes |
| **Real-time collab** | Planned | Yes | Yes | No | No |
| **Focus mode** | YES | No | No | Yes | Yes |
| **Markdown support** | YES | No | Partial | Yes | Yes |
| **Beautiful export** | Planned | Partial | Partial | Yes | Yes |
| **Free tier** | YES | Yes | Yes | No | No |
| **Open source** | YES | No | No | No | No |
| **Block-based** | No | No | Yes | No | No |
| **Tables** | Planned | Yes | Yes | Yes | Yes |
| **Templates** | Planned | Yes | Yes | No | Yes |

### 5.5 Target User Personas

#### Primary: "The Aesthetic Writer"
- Age 22-35, design-conscious, uses Apple products
- Values tools that feel good to use, not just functional
- Writes blogs, journals, creative content, social media drafts
- Currently uses: Bear, Apple Notes, or Notion (unhappily)
- Willing to pay for beauty and experience

#### Secondary: "The AI-Curious Professional"
- Age 28-45, knowledge worker, writes reports/emails/docs
- Interested in AI assistance but finds ChatGPT workflows clunky
- Wants AI integrated into their writing flow, not as a separate step
- Currently uses: Google Docs + ChatGPT in separate tabs
- Willing to pay for productivity gains

#### Tertiary: "The Focused Student/Academic"
- Age 18-28, writing essays, research notes, thesis work
- Needs distraction-free writing + research assistance
- Interested in AI for factual lookups and writing improvement
- Currently uses: Google Docs (forced) + iA Writer (preferred)
- Price-sensitive but responds to student discounts

---

## 6. Monetization Strategy

### 6.1 Recommended Model: Freemium with AI Usage Tiers

#### Free Tier: "Writer"
- Unlimited local notes
- Full editor with formatting
- Light + Dark themes
- 5 AI completions per day (using the `/` and `//` commands)
- Local storage only (on-device)
- Single device
- Basic export (plain text, Markdown)

#### Pro Tier: "Writer Pro" -- $4.99/month or $39.99/year
- Everything in Free
- Unlimited AI completions
- Advanced AI features:
  - Tone adjustment (rewrite in formal/casual/creative voice)
  - Grammar and style suggestions
  - Summarization
  - Translation
  - AI-powered search across notes
- Premium themes (additional glassmorphism color palettes, custom accent colors)
- iCloud sync across devices
- PDF/Word export with custom templates
- Focus mode (sentence/paragraph dimming)
- Document statistics (reading level, word frequency, etc.)
- Priority support

#### Team Tier: "Writer for Teams" -- $8.99/user/month
- Everything in Pro
- Real-time collaborative editing
- Shared workspaces
- Team templates
- Admin controls
- SSO/SAML authentication
- Audit logs
- API access
- Custom branding (enterprise glass theme customization)

### 6.2 Revenue Projections Framework

#### Pricing Rationale
- Bear charges $2.99/mo -- we offer MORE (AI) for slightly more
- iA Writer charges $49.99 one-time -- our annual is comparable
- Notion charges $8/mo -- our Pro is cheaper with writing-focused features
- Google Docs is free but ugly and non-native -- aesthetic premium justified
- The AI tier justifies recurring pricing (actual API costs per user)

#### Cost Considerations
- OpenRouter API costs: ~$0.002-0.01 per AI completion (model dependent)
- At 50 completions/day (power user): ~$0.25-1.25/day = $7.50-37.50/month
- Pro at $4.99/month REQUIRES usage limits or cheaper models for profitability
- Recommendation: Use efficient models (Gemini Flash, Llama) for standard tier, premium models (GPT-4o, Claude) as Pro+ perk

### 6.3 Alternative/Complementary Revenue Streams

#### One-Time Purchases (In-App)
- **Theme packs**: Curated glassmorphism themes ($2.99-4.99 per pack)
- **Font packs**: Premium writing fonts ($1.99-3.99 per pack)
- **Export templates**: Beautiful PDF templates ($1.99-4.99 per template)
- These provide revenue without subscription fatigue

#### Usage-Based AI Add-Ons
- **AI Credits**: Buy additional AI usage beyond daily free limit
  - 50 credits: $1.99
  - 200 credits: $4.99
  - 500 credits: $9.99
- Appeals to occasional users who don't want subscriptions

#### Affiliate/Partnership
- **Font partnerships**: Feature premium fonts with affiliate links
- **Publishing integrations**: One-click publish to Medium, Substack, Ghost
- **Grammarly/writing tool partnerships**: Integration partnerships

### 6.4 Monetization Anti-Patterns to Avoid
- **Don't gate basic editing**: The free editor should always feel complete
- **Don't show ads**: Breaks the aesthetic promise entirely
- **Don't limit note count**: Storage limits, not note limits
- **Don't require account for basic use**: Allow anonymous local usage
- **Don't make free feel bad**: Free should still be beautiful; Pro should feel AMAZING

---

## 7. Feature Prioritization (MVP)

### 7.1 Phase 1: MVP (Months 1-2) -- "Beautiful & Functional"

**MUST HAVE -- Ship these first:**

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P0 | Frosted glass UI overhaul (toolbar, menus, modals) | Medium | High |
| P0 | Refined typography system (heading styles, body fonts) | Low | High |
| P0 | Polished light/dark themes with glassmorphism | Medium | High |
| P0 | Smooth keyboard interactions & editor UX | Low | High |
| P0 | Note list with glassmorphism cards | Medium | High |
| P1 | Markdown inline rendering (bold, italic, headers) | Medium | High |
| P1 | AI completion polish (loading states, error handling) | Low | Medium |
| P1 | Focus mode (dim non-active paragraphs) | Low | Medium |
| P1 | Document stats overlay (word count, reading time) | Low | Low |
| P1 | App Store-ready screenshots and metadata | Low | High |

### 7.2 Phase 2: Growth (Months 3-4) -- "Power + Polish"

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P1 | iCloud sync across devices | High | High |
| P1 | Premium themes (new glassmorphism palettes) | Medium | Medium |
| P1 | PDF export with beautiful templates | Medium | High |
| P1 | In-app subscription (RevenueCat integration) | Medium | High |
| P2 | Advanced AI features (tone, grammar, summarize) | Medium | High |
| P2 | Slash command palette UI (visual `/` command menu) | Medium | High |
| P2 | Image support polish (resize, captions, gallery) | Medium | Medium |
| P2 | Search across notes | Low | Medium |
| P2 | Keyboard shortcuts for formatting | Low | Medium |

### 7.3 Phase 3: Expansion (Months 5-8) -- "Collaboration & Scale"

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| P2 | Real-time collaborative editing (CRDT-based) | Very High | High |
| P2 | Shared workspaces/folders | High | High |
| P2 | Web version (React Native Web) | High | High |
| P3 | Table support | Medium | Medium |
| P3 | Template library | Medium | Medium |
| P3 | Publishing integrations (Medium, Substack) | Medium | Medium |
| P3 | Version history | Medium | Medium |
| P3 | Custom fonts | Low | Low |
| P3 | Widget support (iOS home screen) | Medium | Medium |
| P3 | Apple Watch companion (voice notes) | Medium | Low |

### 7.4 Technical Foundation Requirements

For the MVP aesthetic overhaul, these technical areas need attention:

1. **Unified Glass Component**: Create a reusable `GlassView` component wrapping `BlurView` with consistent styling
2. **Theme System Expansion**: Extend `constants/theme.ts` with glassmorphism tokens (blur intensities, surface opacities, border colors)
3. **Animation Library**: Standardize `react-native-reanimated` usage for glass transition effects (opacity, blur changes)
4. **Typography Scale**: Define a rigid type scale with sizes, weights, and line-heights for all text roles
5. **Haptic Feedback**: Consistent use of `expo-haptics` for tactile glass-surface interactions

---

## 8. Aesthetic Guidelines

### 8.1 Design Tokens

#### Colors -- Light Mode
```
Background (base):        #F0EFF5   (warm off-white with slight violet tint)
Surface (glass):          rgba(255, 255, 255, 0.30)
Surface (elevated):       rgba(255, 255, 255, 0.50)
Surface border:           rgba(255, 255, 255, 0.20)
Text (primary):           #1C1C1E   (near-black)
Text (secondary):         #636366   (medium gray)
Text (tertiary):          #AEAEB2   (light gray)
Accent (interactive):     #007AFF   (system blue, used sparingly)
Accent (AI):              #AF52DE   (purple, signals AI involvement)
Shadow:                   rgba(0, 0, 0, 0.06)
Divider:                  rgba(0, 0, 0, 0.06)
```

#### Colors -- Dark Mode
```
Background (base):        #000000   (true black for OLED)
Surface (glass):          rgba(44, 44, 46, 0.45)
Surface (elevated):       rgba(58, 58, 60, 0.55)
Surface border:           rgba(255, 255, 255, 0.08)
Text (primary):           rgba(255, 255, 255, 0.87)
Text (secondary):         rgba(255, 255, 255, 0.60)
Text (tertiary):          rgba(255, 255, 255, 0.38)
Accent (interactive):     #0A84FF   (system blue, dark variant)
Accent (AI):              #BF5AF2   (purple, dark variant)
Shadow:                   rgba(0, 0, 0, 0.30)
Divider:                  rgba(255, 255, 255, 0.06)
```

#### Blur Specifications
```
Toolbar/Navigation:       intensity: 50,  tint: 'light'/'dark'
Floating Menu:            intensity: 40,  tint: 'light'/'dark'  (current)
Modal/Dialog:             intensity: 60,  tint: 'light'/'dark'
Context Menu:             intensity: 35,  tint: 'light'/'dark'
Background Overlay:       intensity: 25,  tint: 'dark'
```

#### Typography Scale
```
Display (hero):           48px / weight 300 / letterSpacing -1.0 / serif
Title 1:                  34px / weight 400 / letterSpacing -0.5 / serif
Title 2:                  28px / weight 400 / letterSpacing -0.3 / serif
Title 3:                  22px / weight 600 / letterSpacing 0    / sans
Headline:                 17px / weight 600 / letterSpacing 0    / sans
Body:                     17px / weight 400 / letterSpacing 0    / serif   / lineHeight: 28px
Body (secondary):         15px / weight 400 / letterSpacing 0    / sans    / lineHeight: 22px
Caption 1:                12px / weight 500 / letterSpacing 0    / sans
Caption 2:                11px / weight 400 / letterSpacing 0.3  / sans
Code:                     14px / weight 400 / letterSpacing 0    / mono    / lineHeight: 20px
```

#### Spacing Scale
```
2xs:   4px
xs:    8px
sm:    12px
md:    16px
lg:    24px
xl:    32px
2xl:   48px
3xl:   64px
```

#### Border Radius Scale
```
sm:    8px    (small buttons, tags)
md:    12px   (inputs, cards)
lg:    16px   (panels, sheets)
xl:    20px   (modals, toasts)
2xl:   28px   (floating containers)
full:  9999px (pills, avatars)
```

#### Shadow Styles
```
Subtle:    { offset: [0, 1],  blur: 3,   opacity: 0.04, spread: 0 }
Default:   { offset: [0, 2],  blur: 8,   opacity: 0.06, spread: 0 }
Medium:    { offset: [0, 4],  blur: 16,  opacity: 0.08, spread: 0 }
Large:     { offset: [0, 8],  blur: 32,  opacity: 0.10, spread: 0 }
Glass:     { offset: [0, 4],  blur: 24,  opacity: 0.06, spread: 0 }  (for glass surfaces)
```

### 8.2 Component Patterns

#### GlassView (Reusable Component)
```tsx
// Proposed reusable component pattern
<GlassView 
  intensity={50}        // Blur intensity
  elevation="default"   // subtle | default | elevated
  radius="xl"           // Border radius token
  padding="lg"          // Internal padding token
>
  {children}
</GlassView>
```

#### Glass Card (Note List Item)
- Background: glass surface with theme-appropriate blur
- Border: hairline border at 10-18% white opacity
- Corner radius: `xl` (20px)
- Content: Title in Title 3, preview text in Body secondary, date in Caption 2
- Shadow: Glass shadow
- On press: Subtle scale animation (0.98) + haptic feedback

#### Glass Toolbar
- Fixed position at top or floating
- Background: glass surface with `intensity: 50`
- Height: 44px (matches iOS nav bar convention)
- Items: Icon-only with 44x44 tap targets
- Separator: hairline dividers between groups
- Active state: filled icon with subtle glass highlight

#### Glass Modal / Sheet
- Bottom sheet with glass background
- Handle bar: `rgba(0,0,0,0.15)` / `rgba(255,255,255,0.15)` centered pill
- Background: elevated glass surface
- Corner radius: `2xl` (28px) on top corners
- Animation: Spring-based slide up with backdrop blur increase

### 8.3 Interaction Patterns

#### Haptic Feedback
- **Light**: Tapping buttons, toggling options
- **Medium**: Opening/closing menus, switching views
- **Heavy**: Destructive actions (delete), important confirmations
- **Selection**: Scrolling through options (per-item tick)

#### Animations
- **Duration**: 200-350ms for most transitions
- **Easing**: `Easing.bezier(0.4, 0.0, 0.2, 1)` (Material ease-in-out) -- already used in FloatingMenu
- **Spring configs**: `friction: 7, tension: 100` for snappy bounces
- **Glass transitions**: Animate blur intensity when surfaces appear/disappear
- **Text transitions**: Fade in AI-generated text character by character (already implemented)

#### Gestures
- **Swipe up**: Show notes list (already implemented)
- **Swipe down on note**: Dismiss/close note
- **Long press on text**: Select word + show glass formatting popover
- **Pinch to zoom**: Adjust text size
- **Drag menu**: Reposition floating menu (already implemented)

### 8.4 Iconography
- **Style**: SF Symbols (via `@expo/vector-icons/Ionicons`) -- outline weight
- **Size**: 24px default, 20px in compact contexts, 28px in hero contexts
- **Color**: Match `Text (secondary)` by default, `Text (primary)` when active
- **Weight**: Prefer outline variants; filled variants only for active/selected states

### 8.5 Do's and Don'ts

#### DO
- Use generous whitespace -- let the glass breathe
- Keep text on solid or near-solid backgrounds for readability
- Use system fonts for UI, serif fonts for content
- Animate blur intensity changes smoothly
- Provide solid-color fallbacks for accessibility
- Test glass effects on actual content (photos, text, colors as background)
- Use haptics to reinforce the "physical glass surface" metaphor

#### DON'T
- Don't put body text directly on glass surfaces (readability issue)
- Don't use more than 3 glass layers simultaneously (performance + clarity)
- Don't animate blur on every scroll event (performance killer)
- Don't use glass effects on Android without testing performance
- Don't use glass for error/warning states (these need high contrast)
- Don't forget dark mode (every glass token needs a dark variant)
- Don't overuse accent colors -- glassmorphism works best when nearly monochromatic

---

## Appendix A: Existing Codebase Alignment

The current Writer codebase already has strong foundations for the glassmorphism direction:

| Existing Pattern | File | Status |
|-----------------|------|--------|
| BlurView usage | `FloatingMenu.tsx` | Already using `expo-blur` with intensity 40 |
| Translucent backgrounds | `FloatingMenu.tsx` | `rgba(255,255,255,0.3)` patterns present |
| Rounded corners | `styles/index.js` | 20px modal radius, 30px menu container |
| Light/dark theming | `constants/theme.ts` | Two-mode color system in place |
| Haptic feedback | `expo-haptics` in deps | Dependency installed |
| Linear gradients | `expo-linear-gradient` in deps | Dependency installed |
| Serif typography | `styles/index.js` | Serif font family for content |
| Keyboard-aware UI | `FloatingMenu.tsx` | Keyboard animation handling present |
| Shadow styling | `FloatingMenu.tsx` | Subtle shadow with blur 8, opacity 0.1 |
| Animation system | `react-native-reanimated` | Dependency installed, used in gesture handling |

### Changes Needed for MVP Aesthetic Overhaul

1. **Create `components/ui/GlassView.tsx`**: Reusable glass surface component
2. **Expand `constants/theme.ts`**: Add glass tokens (blur, opacity, surface colors)
3. **Create `constants/typography.ts`**: Centralized type scale
4. **Create `constants/spacing.ts`**: Spacing and radius tokens
5. **Refactor `styles/index.js`**: Migrate to token-based styles
6. **Update `FloatingMenu.tsx`**: Apply refined glass tokens
7. **Create glass-styled note list cards**: For `app/index.tsx`
8. **Add background gradient/texture**: Behind main editor
9. **Create `GlassToolbar` component**: For formatting bar
10. **Add focus mode**: Paragraph-level dimming in editor

---

## Appendix B: Key Metrics to Track

| Metric | Why It Matters |
|--------|---------------|
| **App Store rating** | Aesthetic apps live or die by first impressions |
| **Screenshot conversion** | Glass UI should dramatically improve this |
| **Time in editor** | Measures if the writing experience is truly better |
| **AI completions/session** | Measures AI feature stickiness |
| **Free-to-Pro conversion** | Target 3-5% within first 30 days |
| **7-day retention** | Target 40%+ (writing apps average 20-30%) |
| **NPS score** | Target 50+ (design-forward tools score higher) |
| **Export usage** | Indicator of "serious" usage worth paying for |

---

*Document created: Design research for Writer -- a frosted glass aesthetic document editor.*
*This document should be treated as a living reference and updated as user research and market feedback come in.*
