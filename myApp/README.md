# Writer

A minimal, AI-powered note-taking app for iOS built with React Native and Expo. Writer uses intelligent inline autocomplete to help you write faster—just type `/` to mark blanks and `//` to fill them with context-aware suggestions.

## Features

### AI-Powered Inline Autocomplete
- **Single slash (`/`)** — Mark placeholder positions in your text
- **Double slash (`//`)** — Trigger AI to fill all placeholders contextually
- Uses surrounding text (before AND after cursor) to generate accurate completions
- Web search enabled for factual queries (dates, names, facts)
- Streaming text animation for a natural typing feel

### Smart Note Management
- Auto-save as you type
- Auto-generated titles based on content (supports multiple languages)
- Swipe-up gesture to access saved notes
- Empty notes are automatically discarded

### Minimal, Distraction-Free UI
- Clean, focused writing environment
- Light and dark theme support
- Floating menu with drag-to-reposition
- Keyboard-aware interface that adapts smoothly

## How It Works

1. **Write naturally** — Start typing your note
2. **Mark blanks** — Use `/` where you want AI suggestions
   ```
   The capital of France is /. It's known for the /.
   ```
3. **Trigger fill** — Type `//` at the end to fill all blanks
   ```
   The capital of France is Paris. It's known for the Eiffel Tower.
   ```

The AI considers both the text before AND after each placeholder to generate contextually appropriate completions.

### Inline Fill
Type `//` mid-sentence for immediate inline completion at that exact position.

## Setup

### Prerequisites
- Node.js 18+
- Expo CLI
- iOS device with Expo Go (or iOS Simulator)

### Installation

```bash
# Clone the repository
git clone https://github.com/eli-w-king/text-editor-app.git
cd text-editor-app/myApp

# Install dependencies
npm install

# Start the development server
npm start
```

### API Configuration
Writer uses [OpenRouter](https://openrouter.ai) for AI completions:

1. Get an API key from [openrouter.ai](https://openrouter.ai)
2. Tap the floating menu → **API**
3. Enter your OpenRouter API key
4. The status indicator turns green when connected

**Model:** `google/gemini-2.5-flash-lite-preview-09-2025`

## Project Structure

```
myApp/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout with providers
│   ├── index.tsx           # Home screen (notes list)
│   └── note/[id].tsx       # Note editor
├── components/
│   └── FloatingMenu.tsx    # Draggable floating action menu
├── constants/
│   ├── prompts.ts          # LLM system prompts
│   └── theme.ts            # Color definitions
├── context/
│   └── AppContext.tsx      # Global state (theme, API, settings)
├── hooks/
│   ├── useLLM.js           # LLM operations hook
│   └── useNotes.ts         # Notes CRUD operations
├── styles/
│   └── index.js            # Shared styles
└── utils/
    ├── animations.js       # Text streaming animations
    └── textProcessing.js   # Content sanitization utilities
```

## Themes

Toggle between light and dark themes via the floating menu:
- **Light** — Clean white background
- **Dark** — Easy on the eyes for nighttime writing

## Dev Mode

Dev mode enables a Debug panel in the floating menu for inspecting LLM requests and responses.

**To enable:** Type `dev mode boing boing` anywhere in a note.

**To disable:** Type `dev mode boing boing hide` anywhere in a note.

Once enabled, a **Debug** option appears in the floating menu. The debug panel shows:
- Current LLM connection status
- Active theme
- Raw messages sent to the model
- Raw API responses

The panel also includes a **Reset** button to clear all app settings and API keys.

## Tech Stack

- **React Native** + **Expo** (SDK 54)
- **Expo Router** — File-based navigation
- **AsyncStorage** — Local data persistence
- **OpenRouter API** — LLM completions with web search
- **React Native Reanimated** — Smooth animations
- **Expo Blur** — Native blur effects

## License

MIT

