import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Easing,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import FloatingMenu from './components/FloatingMenu';
import { getApiBaseUrl, isProxyMode, OPENROUTER_URL } from './constants/api';
import { BATCH_FILL_PROMPT, SYSTEM_PROMPT } from './constants/prompts';
import { Colors } from './constants/theme';
import { styles } from './styles';
import { streamDelete, streamSingleFill } from './utils/animations';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORAGE_KEY_API = 'llm_api_key';
const NOTES_STORAGE_KEY = 'notes_data';

// Helper to make API calls - works with both proxy and direct mode
const makeApiCall = async (endpoint, body, apiKey) => {
  const baseUrl = getApiBaseUrl();
  const usingProxy = isProxyMode();
  
  // For proxy mode, we don't need auth headers (proxy handles it)
  // For direct mode, we need the user's API key
  const headers = {
    'Content-Type': 'application/json',
    ...(usingProxy ? {} : {
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://github.com/elijahking/text-editor-app',
      'X-Title': 'Writer App',
    }),
  };
  
  const url = usingProxy 
    ? `${baseUrl}${endpoint}` 
    : `${OPENROUTER_URL}${endpoint}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  
  return response.json();
};

// Extracts string content regardless of OpenRouter payload shape (string or array chunks).
const coerceMessageContent = (messageContent) => {
  if (typeof messageContent === 'string') {
    return messageContent;
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .map((segment) => {
        if (!segment) {
          return '';
        }
        if (typeof segment === 'string') {
          return segment;
        }
        if (typeof segment === 'object') {
          return segment.text ?? segment.content ?? '';
        }
        return '';
      })
      .join(' ');
  }

  if (messageContent && typeof messageContent === 'object' && 'content' in messageContent) {
    const value = messageContent.content;
    return typeof value === 'string' ? value : '';
  }

  return '';
};

// Normalizes raw LLM output to strip URLs/citations and tidy punctuation artifacts.
const sanitizeModelContent = (rawInput) => {
  if (typeof rawInput !== 'string') {
    return '';
  }

  let cleaned = rawInput;

  // Remove common explanation prefixes - be aggressive
  cleaned = cleaned
    .replace(/^\s*(?:according to|based on|from|per|via|as per|the answer is|it is|this is|that is|it's|that's|here is|here's|the)[,:\s]*/gi, '')
    .replace(/^\s*(?:search results?|sources?|web search|results? show|i found|looking up)[,:\s]*/gi, '')
    .replace(/^\s*(?:the (?:acts?|artists?|bands?|members?|names?|answer) (?:under|include|is|are|would be))[,:\s]*/gi, '')
    .replace(/[:,]\s*\d+\s*$/g, '') // Remove trailing ": 3" type artifacts
    .replace(/^[\s:,.-]+/, '') // Remove leading punctuation
    .replace(/[\s:,.]+$/, ''); // Remove trailing punctuation
  
  // If it still starts with explanation-like text after a comma, take only what's after
  if (/^[^,]+,\s*(?:the|according|based|include|are|is)/i.test(cleaned)) {
    // This looks like "Something, the acts include X" - probably bad output
    // Try to extract just the useful part or return empty
    const match = cleaned.match(/(?:include|are|is)\s+(.+)/i);
    if (match) {
      cleaned = match[1].trim();
    }
  }

  // Remove ALL brackets that look like citations (contain TLDs, URLs, or domain-like text).
  // Catches [theblock.co], [example.com/path], [1], [Source: ...], etc.
  cleaned = cleaned
    .replace(/\s*\[[^\]]*\b\w+\.\s*(?:com?|net|org|io|ai|app|news|tv|fm|uk|us|au|de|fr|jp|co)\b[^\]]*\]/gi, '')
    .replace(/\s*\[[^\]]*(?:https?:\/\/|www\.)[^\]]*\]/gis, '')
    .replace(/\s*\[[0-9]+\]/g, '')
    .replace(/\s*\[\s*\]/g, ''); // Remove empty []

  // Remove ALL parentheses that look like citations.
  cleaned = cleaned
    .replace(/\s*\([^)]*\b\w+\.\s*(?:com?|net|org|io|ai|app|news|tv|fm|uk|us|au|de|fr|jp|co)\b[^)]*\)/gi, '')
    .replace(/\s*\([^)]*(?:https?:\/\/|www\.)[^)]*\)/gis, '')
    .replace(/\s*\((?:source|via|according to|reported by)[^)]*\)/gi, '')
    .replace(/\s*\(\s*\)/g, ''); // Remove empty ()

  // Remove bare URLs and www references anywhere.
  cleaned = cleaned
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/www\.[^\s)]+/gi, '');

  // Normalize whitespace and punctuation spacing.
  cleaned = cleaned
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/([,.;!?])(?!\s|$)/g, '$1 ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n');

  cleaned = cleaned.trim();

  // If the response starts with special wrapper characters, drop them entirely.
  cleaned = cleaned.replace(/^[\[\](){}<>\-_:,*]+\s*/g, '');

  // Remove any trailing stray brackets/parens left over from stripped citations.
  cleaned = cleaned.replace(/[\[\]()]+\s*$/g, '');

  // Also strip lone orphan opening/closing brackets anywhere (unmatched).
  cleaned = cleaned
    .replace(/\(\s*$/g, '')
    .replace(/\[\s*$/g, '')
    .replace(/^\s*\)/g, '')
    .replace(/^\s*\]/g, '');

  return cleaned.trim();
};

// Ensures proper spacing around filled content so words don't mash together
const ensureSpacing = (prefix, content, suffix) => {
  let spacedContent = content.trim();
  
  // Trim trailing space from prefix and leading space from suffix
  // We'll add our own consistent spacing
  const trimmedPrefix = prefix.replace(/\s+$/, '');
  const trimmedSuffix = suffix.replace(/^\s+/, '');
  
  // Always add space before content if prefix exists and doesn't end with newline or opening bracket
  if (trimmedPrefix.length > 0) {
    const lastChar = trimmedPrefix[trimmedPrefix.length - 1];
    if (!/[\n([{]/.test(lastChar)) {
      spacedContent = ' ' + spacedContent;
    }
  }
  
  // Always add space after content if suffix exists and doesn't start with punctuation or newline
  if (trimmedSuffix.length > 0) {
    const firstChar = trimmedSuffix[0];
    if (!/^[\n.,!?;:'"\-—–)\]}]/.test(firstChar)) {
      spacedContent = spacedContent + ' ';
    }
  }
  
  return spacedContent;
};

// Helper to rebuild text with trimmed prefix/suffix for consistent spacing
const rebuildWithSpacing = (prefix, content, suffix) => {
  const trimmedPrefix = prefix.replace(/\s+$/, '');
  const trimmedSuffix = suffix.replace(/^\s+/, '');
  const spacedContent = ensureSpacing(prefix, content, suffix);
  return { prefix: trimmedPrefix, content: spacedContent, suffix: trimmedSuffix };
};

// --- Image support utilities ---

const IMAGE_MARKER_REGEX = /\[IMG\|\|(.*?)\|\|(.*?)\]/g;

// Parse text with [IMG||url||alt] markers into content blocks for rendering
const IMAGE_LOADING_PLACEHOLDER_REGEX = /__IMG_LOADING_\d+__/;

const textToBlocks = (text) => {
  const blocks = [];
  // Combined regex for both image markers and loading placeholders
  const combinedRegex = new RegExp(`(${IMAGE_MARKER_REGEX.source})|(${IMAGE_LOADING_PLACEHOLDER_REGEX.source})`, 'g');
  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    if (match[1]) {
      // Image marker: [IMG||url||alt]
      blocks.push({ type: 'image', uri: match[2], alt: match[3] });
    } else {
      // Loading placeholder - store the raw placeholder string for serialization
      blocks.push({ type: 'image_loading', placeholder: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    blocks.push({ type: 'text', content: text.slice(lastIndex) });
  }

  // Always ensure there's a text block at the end so the user can type after images
  if (blocks.length === 0 || blocks[blocks.length - 1].type !== 'text') {
    blocks.push({ type: 'text', content: '' });
  }

  return blocks;
};

// Serialize content blocks back to text string with [IMG||url||alt] markers
const blocksToText = (blocks) => {
  return blocks.map(b => {
    if (b.type === 'image') return `[IMG||${b.uri}||${b.alt}]`;
    if (b.type === 'image_loading') return b.placeholder || '';
    return b.content;
  }).join('');
};

// Strip image markers and loading placeholders from text (for title generation, previews, etc.)
// Handles both new [IMG||...||...] and old [IMG:...] formats
const stripImageMarkers = (text) => {
  return text
    .replace(new RegExp(IMAGE_MARKER_REGEX.source, 'g'), '')
    .replace(/\[IMG:[^\]]*\]?/g, '')
    .replace(/__IMG_LOADING_\d+__/g, '')
    .trim();
};

// Search for images using Gemini with Google Search grounding via the Cloudflare Worker
const searchGoogleImages = async (query) => {
  try {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return null;

    const response = await fetch(`${baseUrl}/search-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();
    if (data.error || !data.images || data.images.length === 0) {
      console.log('Image search returned no results:', data.error);
      return null;
    }

    // Worker already validated the URL server-side
    console.log('Gemini Search image found:', data.images[0].url);
    return data.images[0].url;
  } catch (error) {
    console.error('Gemini Search error:', error);
    return null;
  }
};

// Search for a real image URL using OpenRouter + web search plugin
// Generate an image using Gemini via the Cloudflare Worker proxy
const generateImageWithGemini = async (query) => {
  try {
    const baseUrl = getApiBaseUrl();
    if (!baseUrl) return null;

    const response = await fetch(`${baseUrl}/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: query }),
    });

    const data = await response.json();
    if (data.error || !data.imageData) {
      console.error('Image generation failed:', data.error);
      return null;
    }

    // Return as data URI — works with expo-image and the || delimiter won't break on colons
    const mimeType = data.mimeType || 'image/png';
    return `data:${mimeType};base64,${data.imageData}`;
  } catch (error) {
    console.error('Image generation error:', error);
    return null;
  }
};

// Ambient image loading shimmer component
function ImageLoadingShimmer({ theme }) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();
    glow.start();
    return () => { pulse.stop(); glow.stop(); };
  }, []);

  const opacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.0, 0.6] });

  const isDark = theme === 'dark';
  const bgColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const gradientColors = isDark
    ? ['rgba(255,255,255,0.0)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.0)']
    : ['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.0)'];
  const glowColors = isDark
    ? ['rgba(120,140,255,0.0)', 'rgba(120,140,255,0.12)', 'rgba(120,140,255,0.0)']
    : ['rgba(100,120,200,0.0)', 'rgba(100,120,200,0.10)', 'rgba(100,120,200,0.0)'];

  return (
    <View style={{
      height: 220,
      marginVertical: 12,
      marginHorizontal: 24,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: bgColor,
    }}>
      <Animated.View style={{ ...StyleSheet.absoluteFillObject, opacity }}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={{ ...StyleSheet.absoluteFillObject, opacity: glowOpacity }}>
        <LinearGradient
          colors={glowColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <BlurView
        intensity={40}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <EditorScreen />
    </SafeAreaProvider>
  );
}

function EditorScreen() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('New Note');
  const [lastTitleGenLength, setLastTitleGenLength] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [llmStatus, setLlmStatus] = useState('disconnected'); // disconnected, connecting, connected, error
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [debugMode, setDebugMode] = useState(false);
  const [debugData, setDebugData] = useState({ sentMessages: null, rawResponse: null });
  const [theme, setTheme] = useState('light');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Thinking animation state
  const [isThinking, setIsThinking] = useState(false);
  
  // Update text with animated placeholder while thinking
  const [thinkingPrefix, setThinkingPrefix] = useState('');
  const [thinkingSuffix, setThinkingSuffix] = useState('');
  
  // For multi-position thinking animation (batch fill with multiple /)
  const [thinkingPositions, setThinkingPositions] = useState([]); // Array of positions to animate
  const [thinkingBaseText, setThinkingBaseText] = useState(''); // Original text with / removed

  // Image support state
  const [contentBlocks, setContentBlocks] = useState([{ type: 'text', content: '' }]);
  const [imageLoading, setImageLoading] = useState(false); // true while searching/generating an image
  const textInputRefs = useRef([]); // refs for each text block's TextInput
  
  useEffect(() => {
    if (!isThinking) return;
    
    // Fluid wave - 2 braille dots with smooth height transitions
    // ⠁ = top, ⠂ = mid, ⠄ = bottom
    const waveFrames = [
      '⠁⠄',
      '⠁⠂',
      '⠂⠁',
      '⠄⠁',
      '⠄⠂',
      '⠂⠄',
    ];
    let frameIndex = 0;
    
    const updatePlaceholder = () => {
      if (thinkingPositions.length > 0 && thinkingBaseText) {
        // Multi-position animation: insert wave frames at each position
        let result = '';
        let lastPos = 0;
        for (let i = 0; i < thinkingPositions.length; i++) {
          const pos = thinkingPositions[i];
          let before = thinkingBaseText.slice(lastPos, pos);
          let after = thinkingBaseText.slice(pos);
          
          // Check if there's already a space before/after
          const hasSpaceBefore = before.endsWith(' ');
          const hasSpaceAfter = after.startsWith(' ');
          
          // Only add space if not already present
          const spaceBefore = hasSpaceBefore ? '' : ' ';
          const spaceAfter = hasSpaceAfter ? '' : ' ';
          
          result += before + spaceBefore + waveFrames[frameIndex] + spaceAfter;
          lastPos = pos;
        }
        result += thinkingBaseText.slice(lastPos);
        setText(result);
      } else {
        // Single position animation (original behavior)
        const hasSpaceBefore = thinkingPrefix.endsWith(' ');
        const hasSpaceAfter = thinkingSuffix.startsWith(' ');
        const spaceBefore = hasSpaceBefore ? '' : ' ';
        const spaceAfter = hasSpaceAfter ? '' : ' ';
        setText(thinkingPrefix + spaceBefore + waveFrames[frameIndex] + spaceAfter + thinkingSuffix);
      }
      frameIndex = (frameIndex + 1) % waveFrames.length;
    };
    
    updatePlaceholder();
    const interval = setInterval(updatePlaceholder, 100);
    return () => clearInterval(interval);
  }, [isThinking, thinkingPrefix, thinkingSuffix, thinkingPositions, thinkingBaseText]);
  
  // Animated notes page title
  const [notesPageTitle, setNotesPageTitle] = useState('0 Notes');
  
  // Saved notes state
  const [notes, setNotes] = useState([]);
  const [currentNoteId, setCurrentNoteId] = useState(null);
  const currentNoteIdRef = useRef(null); // Use ref to avoid stale closure issues
  const [showingSavedNotes, setShowingSavedNotes] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isSaving = useRef(false); // Prevent concurrent saves
  const scrollViewRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current; // Track scroll position for mini title
  
  // Gradient animation
  const gradientAnim = useRef(new Animated.Value(0)).current;
  
  // LLM trigger color dots - stored per note
  const [colorDots, setColorDots] = useState([]);
  const [colorFamily, setColorFamily] = useState(null); // Color family for current note
  const screenDimensions = Dimensions.get('window');
  
  // Color families - each note gets one randomly assigned (mature colors only)
  const colorFamilies = {
    burntOrange: [
      '#8B4513', // Saddle brown
      '#A0522D', // Sienna
      '#B7410E', // Rust
      '#CC5500', // Burnt orange
      '#D2691E', // Chocolate
      '#964B00', // Brown
      '#8B3A00', // Dark burnt orange
      '#A45A2A', // Windsor tan
    ],
    darkBlue: [
      '#191970', // Midnight blue
      '#000080', // Navy
      '#1B1B6A', // Dark royal blue
      '#1C2951', // Space cadet
      '#002147', // Oxford blue
      '#1D3461', // Prussian blue
      '#1A237E', // Indigo dye
      '#0D1B2A', // Rich black
    ],
    bloodRed: [
      '#660000', // Blood red dark
      '#8B0000', // Dark red
      '#800000', // Maroon
      '#6B0F1A', // Rosewood
      '#722F37', // Wine
      '#7B3B3B', // Roast coffee
      '#701C1C', // Persian plum
      '#5C0A0A', // Sangria
    ],
    deepPurple: [
      '#301934', // Dark purple
      '#4A0E4E', // Byzantium purple
      '#2E0854', // Russian violet
      '#3C1361', // Persian indigo
      '#4B0082', // Indigo
      '#371E4E', // English violet
      '#2D1B3D', // Dark byzantium
      '#432C6B', // Spanish violet
    ],
  };
  
  const colorFamilyNames = Object.keys(colorFamilies);
  
  // Get a random color family name
  const getRandomColorFamily = () => {
    return colorFamilyNames[Math.floor(Math.random() * colorFamilyNames.length)];
  };
  
  // Get color based on token count within the note's color family
  // Few tokens = lighter shades, many tokens = more saturated shades
  const getColorFromTokens = (tokens) => {
    // Get current family, or pick one if not set
    const family = colorFamily || getRandomColorFamily();
    
    const familyColors = colorFamilies[family] || colorFamilies.burntOrange;
    
    // Normalize tokens to pick from different parts of the family palette
    // Lower tokens = earlier colors (typically lighter/cooler within family)
    // Higher tokens = later colors (typically more saturated)
    const normalized = Math.max(0, Math.min(1, (tokens - 5) / 50));
    
    // Weight towards different parts of the palette based on tokens
    if (normalized < 0.3) {
      // Low tokens: pick from first third of palette
      const range = Math.floor(familyColors.length / 3) || 1;
      return familyColors[Math.floor(Math.random() * range)];
    } else if (normalized > 0.7) {
      // High tokens: pick from last third of palette
      const range = Math.floor(familyColors.length / 3) || 1;
      const startIdx = familyColors.length - range;
      return familyColors[startIdx + Math.floor(Math.random() * range)];
    } else {
      // Middle range - pick from middle of palette
      const third = Math.floor(familyColors.length / 3) || 1;
      const startIdx = third;
      const endIdx = familyColors.length - third;
      const range = endIdx - startIdx || 1;
      return familyColors[startIdx + Math.floor(Math.random() * range)];
    }
  };
  
  // Add a new color dot - size from latency, color from tokens
  const addColorDot = (latencyMs = 500, tokens = 20) => {
    // Latency-based size: larger for better glow diffusion
    const minLatency = 200;
    const maxLatency = 2500;
    const clampedLatency = Math.max(minLatency, Math.min(latencyMs, maxLatency));
    const normalized = (clampedLatency - minLatency) / (maxLatency - minLatency);
    const targetSize = 80 + normalized * 120; // 80-200px (larger for softer glow)
    
    // Gentler drift for smoother movement
    const driftX = (Math.random() - 0.5) * 30; // -15 to +15
    const driftY = (Math.random() - 0.5) * 20; // -10 to +10
    
    // Start position below where it will end up (bubbling up effect)
    const riseDistance = 20 + Math.random() * 30; // 20-50px rise
    
    // Generate watercolor blot shapes - multiple overlapping irregular circles
    const blotShapes = [];
    const numShapes = 5 + Math.floor(Math.random() * 4); // 5-8 shapes per blot
    const baseColor = getColorFromTokens(tokens);
    const family = colorFamily || getRandomColorFamily();
    const familyColors = colorFamilies[family] || colorFamilies.burntOrange;
    
    for (let i = 0; i < numShapes; i++) {
      // Pick a slightly different color from the family for variation
      const shapeColor = Math.random() > 0.4 
        ? baseColor 
        : familyColors[Math.floor(Math.random() * familyColors.length)];
      
      blotShapes.push({
        offsetX: (Math.random() - 0.5) * targetSize * 0.7,
        offsetY: (Math.random() - 0.5) * targetSize * 0.7,
        scale: 0.25 + Math.random() * 0.75, // 25-100% of main size
        opacity: 0.15 + Math.random() * 0.35, // 15-50% opacity (softer)
        rotation: Math.random() * 360,
        scaleX: 0.6 + Math.random() * 0.8,
        scaleY: 0.6 + Math.random() * 0.8,
        color: shapeColor, // Each shape can have slightly different color
      });
    }
    
    const newDot = {
      id: Date.now() + Math.random(),
      x: Math.random() * screenDimensions.width,
      y: Math.random() * screenDimensions.height,
      color: getColorFromTokens(tokens),
      size: targetSize,
      blotShapes, // Watercolor blot shapes
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.3), // Start very small for graceful bloom
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(riseDistance), // Start below
      driftX,
      driftY,
    };
    
    setColorDots(prev => [...prev, newDot]);
    
    // Ultra graceful fade in - like watercolor bleeding into paper
    const targetOpacity = 0.05 + Math.random() * 0.10; // 0.05-0.15 opacity
    const duration = 5000 + Math.random() * 3000; // 5-8 seconds (very slow bloom)
    
    // Stagger the animation start slightly for organic feel
    const delay = Math.random() * 500;
    
    setTimeout(() => {
      Animated.parallel([
        // Very slow fade in with gentle sine easing
        Animated.timing(newDot.opacity, {
          toValue: targetOpacity,
          duration: duration,
          useNativeDriver: true,
          easing: Easing.out(Easing.sin),
        }),
        // Start smaller, grow very slowly
        Animated.timing(newDot.scale, {
          toValue: 1,
          duration: duration * 1.3,
          useNativeDriver: true,
          easing: Easing.out(Easing.sin),
        }),
        // Gentle rise from below
        Animated.timing(newDot.translateY, {
          toValue: 0,
          duration: duration * 1.5,
          useNativeDriver: true,
          easing: Easing.out(Easing.sin),
        }),
      ]).start(() => {
        // Organic free-floating drift - wanders to random positions continuously
        const wanderDrift = () => {
          const nextX = (Math.random() - 0.5) * 30; // Random target within ±15px
          const nextY = (Math.random() - 0.5) * 20; // Random target within ±10px
          const duration = 8000 + Math.random() * 12000; // 8-20 seconds to next position
          
          Animated.parallel([
            Animated.timing(newDot.translateX, {
              toValue: nextX,
              duration: duration,
              useNativeDriver: true,
              easing: Easing.inOut(Easing.sin),
            }),
            Animated.timing(newDot.translateY, {
              toValue: nextY,
              duration: duration * (0.7 + Math.random() * 0.6), // Slightly different Y timing
              useNativeDriver: true,
              easing: Easing.inOut(Easing.sin),
            }),
        ]).start(() => wanderDrift()); // Pick a new random destination when done
      };
      wanderDrift();
    });
    }, delay);
  };
  
  // Start gradient animation loop
  useEffect(() => {
    const animateGradient = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(gradientAnim, {
            toValue: 1,
            duration: 8000,
            useNativeDriver: false,
          }),
          Animated.timing(gradientAnim, {
            toValue: 0,
            duration: 8000,
            useNativeDriver: false,
          }),
        ])
      ).start();
    };
    animateGradient();
  }, []);

  // Keep ref in sync with state
  useEffect(() => {
    currentNoteIdRef.current = currentNoteId;
  }, [currentNoteId]);

  // Animated notes page title - animates when opening saved notes
  const notesAnimating = useRef(false);
  const notesAnimationTimeout = useRef(null);
  
  const getNotesCountTitle = () => `${notes.length} ${notes.length === 1 ? 'Note' : 'Notes'}`;
  
  const animateNotesTitle = async (from, to) => {
    if (notesAnimating.current) return;
    notesAnimating.current = true;
    
    // Delete current title character by character
    for (let i = from.length; i >= 0; i--) {
      setNotesPageTitle(from.slice(0, i));
      await new Promise(r => setTimeout(r, 50));
    }
    
    // Small pause
    await new Promise(r => setTimeout(r, 200));
    
    // Type new title character by character
    for (let i = 0; i <= to.length; i++) {
      setNotesPageTitle(to.slice(0, i));
      await new Promise(r => setTimeout(r, 80));
    }
    
    notesAnimating.current = false;
  };
  
  const handleNotesTitleTap = async () => {
    if (notesAnimating.current) return;
    
    // Clear any pending auto-return timeout
    if (notesAnimationTimeout.current) {
      clearTimeout(notesAnimationTimeout.current);
    }
    
    const countTitle = getNotesCountTitle();
    
    if (notesPageTitle === '//') {
      // Show count, then return to // after 3 seconds
      await animateNotesTitle('//', countTitle);
      notesAnimationTimeout.current = setTimeout(async () => {
        await animateNotesTitle(getNotesCountTitle(), '//');
      }, 3000);
    } else {
      // Go to //
      await animateNotesTitle(notesPageTitle, '//');
    }
  };
  
  useEffect(() => {
    if (!showingSavedNotes) {
      // Reset when closing
      setNotesPageTitle(getNotesCountTitle());
      if (notesAnimationTimeout.current) {
        clearTimeout(notesAnimationTimeout.current);
      }
      return;
    }
    
    // Start animation after 2 seconds of opening
    const timeout = setTimeout(async () => {
      await animateNotesTitle(getNotesCountTitle(), '//');
    }, 2000);
    
    return () => clearTimeout(timeout);
  }, [showingSavedNotes, notes.length]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Load notes from storage
  const loadNotes = async () => {
    try {
      const storedNotes = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
      if (storedNotes) {
        setNotes(JSON.parse(storedNotes));
      }
    } catch (e) {
      console.error('Failed to load notes', e);
    }
  };

  // Save current note - only called explicitly, not automatically
  const saveCurrentNote = async () => {
    // Prevent concurrent saves
    if (isSaving.current) {
      return;
    }
    
    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      // Don't save empty notes
      return;
    }

    isSaving.current = true;

    try {
      // Use ref for the current note ID to avoid stale closures
      let noteId = currentNoteIdRef.current;
      if (!noteId) {
        noteId = Date.now().toString();
        currentNoteIdRef.current = noteId;
        setCurrentNoteId(noteId);
      }

      const newNote = {
        id: noteId,
        title: title,
        content: trimmedText,
        updatedAt: Date.now(),
        colorFamily: colorFamily || getRandomColorFamily(), // Save the note's color family
        colorDots: colorDots.map(dot => ({
          id: dot.id,
          x: dot.x,
          y: dot.y,
          color: dot.color,
          size: dot.size,
          blotShapes: dot.blotShapes || [], // Save watercolor shapes
          opacityValue: typeof dot.opacity === 'object' ? (dot.opacity._value || 0.8) : (dot.opacity || 0.8),
        })),
      };

      const storedNotes = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
      let currentNotes = storedNotes ? JSON.parse(storedNotes) : [];
      
      const existingIndex = currentNotes.findIndex(n => n.id === noteId);
      if (existingIndex >= 0) {
        currentNotes[existingIndex] = newNote;
      } else {
        currentNotes.unshift(newNote);
      }
      
      currentNotes.sort((a, b) => b.updatedAt - a.updatedAt);
      await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(currentNotes));
      setNotes(currentNotes);
    } catch (e) {
      console.error('Failed to save note', e);
    } finally {
      isSaving.current = false;
    }
  };

  // Delete a note
  const deleteNote = async (id) => {
    try {
      const storedNotes = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
      if (storedNotes) {
        let currentNotes = JSON.parse(storedNotes);
        currentNotes = currentNotes.filter(n => n.id !== id);
        await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(currentNotes));
        setNotes(currentNotes);
      }
    } catch (e) {
      console.error('Failed to delete note', e);
    }
  };

  // Show saved notes overlay
  const showSavedNotesView = async () => {
    Keyboard.dismiss();
    await saveCurrentNote();
    await loadNotes();
    setShowingSavedNotes(true);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  // Hide saved notes overlay
  const hideSavedNotesView = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      setShowingSavedNotes(false);
    });
  };

  // Open a saved note
  const openNote = (note) => {
    // Load the note's saved dots
    const savedDots = note.colorDots || [];
    const family = note.colorFamily || 'ocean';
    const familyColors = colorFamilies[family] || colorFamilies.ocean;
    
    const restoredDots = savedDots.map(dot => {
      // Generate blotShapes for old dots that don't have them
      let blotShapes = dot.blotShapes;
      if (!blotShapes || blotShapes.length === 0) {
        blotShapes = [];
        const numShapes = 5 + Math.floor(Math.random() * 4);
        for (let i = 0; i < numShapes; i++) {
          // Pick varied colors from the family
          const shapeColor = Math.random() > 0.4 
            ? dot.color 
            : familyColors[Math.floor(Math.random() * familyColors.length)];
          
          blotShapes.push({
            offsetX: (Math.random() - 0.5) * dot.size * 0.7,
            offsetY: (Math.random() - 0.5) * dot.size * 0.7,
            scale: 0.25 + Math.random() * 0.75,
            opacity: 0.15 + Math.random() * 0.35,
            rotation: Math.random() * 360,
            scaleX: 0.6 + Math.random() * 0.8,
            scaleY: 0.6 + Math.random() * 0.8,
            color: shapeColor,
          });
        }
      }
      return {
        ...dot,
        blotShapes,
        opacity: new Animated.Value(dot.opacityValue || 0.1),
      };
    });
    setColorDots(restoredDots);
    setColorFamily(note.colorFamily || null); // Restore the note's color family
    
    setText(note.content);
    setTitle(note.title);
    setCurrentNoteId(note.id);
    currentNoteIdRef.current = note.id;
    setLastTitleGenLength(0);
    setCurrentDate(new Date(note.updatedAt));
    hideSavedNotesView();
  };

  // Create a new note
  const createNewNote = async () => {
    await saveCurrentNote();
    
    // Clear dots and assign new color family for new note
    setColorDots([]);
    setColorFamily(getRandomColorFamily());
    
    setText('');
    setTitle('New Note');
    setCurrentNoteId(null);
    currentNoteIdRef.current = null;
    setLastTitleGenLength(0);
    setCurrentDate(new Date());
    hideSavedNotesView();
  };

  // Clear all notes (for fixing corrupted data)
  const clearAllNotes = async () => {
    try {
      await AsyncStorage.removeItem(NOTES_STORAGE_KEY);
      setNotes([]);
      setText('');
      setTitle('New Note');
      setCurrentNoteId(null);
      currentNoteIdRef.current = null;
      Alert.alert('Done', 'All notes cleared');
    } catch (e) {
      console.error('Failed to clear notes', e);
    }
  };

  // Load API Key on mount
  useEffect(() => {
    loadSettings();
    loadNotes();
    // Set initial date and random color family for new notes
    setCurrentDate(new Date());
    setColorFamily(getRandomColorFamily());
  }, []);

  // Auto-generate title when text changes significantly
  useEffect(() => {
    const textOnly = stripImageMarkers(text);
    const timeout = setTimeout(() => {
      if (llmStatus === 'connected' && textOnly.length > 20 && Math.abs(textOnly.length - lastTitleGenLength) > 50) {
        generateTitle();
      }
    }, 3000); // Debounce 3s
    return () => clearTimeout(timeout);
  }, [text, llmStatus, lastTitleGenLength]);

  const generateTitle = async () => {
    if (!apiKey) return;
    
    try {
      const data = await makeApiCall('/chat/completions', {
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: "You are a helpful assistant. Summarize the user's text into a short, concise title (3-5 words max). Do not use quotes. IMPORTANT: The title MUST be in the same language as the user's text. If they write in Spanish, title in Spanish. If French, title in French. Match their language exactly." },
          { role: 'user', content: stripImageMarkers(text.slice(0, 1000)) } // Limit context, strip image markers
        ],
        temperature: 0.3,
        max_tokens: 10,
      }, apiKey);

      if (data.choices && data.choices.length > 0) {
        const newTitle = data.choices[0].message.content.trim().replace(/^["']|["']$/g, '');
        if (newTitle && newTitle !== title) {
          setLastTitleGenLength(text.length);
          // Animate title change: delete old, stream new
          await streamDelete(setTitle, title, { speed: 20 });
          await streamSingleFill(setTitle, '', newTitle, '', { speed: 40 });
        }
      }
    } catch (error) {
      console.error('Title generation error:', error);
    }
  };


  const loadSettings = async () => {
    try {
      // If using proxy mode, validate the proxy instead of requiring user API key
      if (isProxyMode()) {
        validateProxyConnection();
        return;
      }
      
      const storedKey = await AsyncStorage.getItem(STORAGE_KEY_API);
      if (storedKey) {
        setApiKey(storedKey);
        validateConnection(storedKey);
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  };

  // Validate proxy backend connection (no API key needed from user)
  const validateProxyConnection = async () => {
    setLlmStatus('connecting');
    try {
      const response = await fetch(`${getApiBaseUrl()}/validate`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.valid) {
          setApiKey('proxy'); // Marker that we're using proxy mode
          setLlmStatus('connected');
        } else {
          setLlmStatus('error');
        }
      } else {
        setLlmStatus('error');
      }
    } catch (error) {
      setLlmStatus('error');
    }
  };

  const validateConnection = async (key) => {
    setLlmStatus('connecting');
    try {
      // Use OpenRouter's auth/key endpoint to actually validate the API key
      const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${key}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        // Check if we got valid key data back (has a label or usage info)
        if (data && data.data) {
          setLlmStatus('connected');
        } else {
          setLlmStatus('error');
        }
      } else {
        setLlmStatus('error');
      }
    } catch (error) {
      setLlmStatus('error');
    }
  };

  const saveApiKey = async (keyToSave) => {
    const key = typeof keyToSave === 'string' ? keyToSave : tempKey;
    try {
      await AsyncStorage.setItem(STORAGE_KEY_API, key);
      setApiKey(key);
      setShowKeyModal(false);
      validateConnection(key);
    } catch (e) {
      Alert.alert('Error', 'Could not save API key');
    }
  };

  const handleConnectPress = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Enter OpenRouter API Key',
        null,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Save & Connect',
            onPress: (key) => saveApiKey(key),
          },
        ],
        'secure-text',
        apiKey
      );
    } else {
      setShowKeyModal(true);
    }
  };

  const resetApp = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_API);
      setApiKey('');
      setTempKey('');
      setLlmStatus('disconnected');
      setText('');
      setTitle('New Note');
      setLastTitleGenLength(0);
      setDebugData({ sentMessages: null, rawResponse: null });
      Alert.alert('Reset', 'App state and settings cleared.');
    } catch (error) {
      Alert.alert('Error', 'Could not reset app');
    }
  };

  const handleTextChange = (newText) => {
    // Clean up any old-format [IMG:...] markers (with or without closing bracket)
    const cleanedText = newText.replace(/\[IMG:[^\]]*\]?/g, '');
    if (cleanedText !== newText) {
      setText(cleanedText);
      return;
    }

    // Check for /image query/ command FIRST (before // trigger)
    // Require the / to be preceded by whitespace or start-of-string to avoid matching inside URLs/markers
    const imageMatch = newText.match(/(?:^|[\s\n])\/image\s+(.+?)\//i);
    if (imageMatch) {
      const query = imageMatch[1].trim();
      // Guard: skip if the captured query contains marker fragments
      if (query.length > 0 && !query.includes('[IMG')) {
        // Calculate the actual /image position (the match may include a leading space)
        const fullMatch = imageMatch[0];
        const leadingChars = fullMatch.length - fullMatch.trimStart().length;
        const matchIndex = imageMatch.index + leadingChars;
        const matchLength = fullMatch.trimStart().length;
        const before = newText.slice(0, matchIndex);
        const after = newText.slice(matchIndex + matchLength);
        // Insert a loading placeholder into text and trigger image search
        const placeholderId = `__IMG_LOADING_${Date.now()}__`;
        const cleanText = before + placeholderId + after;
        setText(cleanText);
        triggerImageCommand(query, placeholderId);
        return;
      }
    }

    // Check for // trigger (double slash to fill all blanks)
    const doubleTriggerRegex = /(?<!:)\/\//;
    const doubleMatch = newText.match(doubleTriggerRegex);

    if (doubleMatch) {
      const index = doubleMatch.index;
      const prefix = newText.slice(0, index);
      const suffix = newText.slice(index + 2);

      // Easter egg: if editor is effectively empty, show Boing boing!
      if (prefix.trim() === '') {
        if (llmStatus !== 'connected') {
          Alert.alert('LLM API Not Connected', 'Tap the Cloud button in the menu to add your OpenRouter API key.');
          setText(prefix + '//' + suffix);
          return;
        }

        const message = 'Boing boing!';
        streamSingleFill(setText, '', message, '', { speed: 50 }).then(() => {
          setTimeout(() => {
            streamDelete(setText, message, { speed: 30 });
          }, 250);
        });
        return;
      }

      // Combine prefix + suffix to check for all / placeholders
      const fullText = prefix + suffix;
      const slashPositions = findAllSlashPlaceholders(fullText);
      
      // The // position itself is also a fill position (at prefix.length in fullText)
      // Add it to the list of positions to fill
      const doubleTriggerPos = prefix.length;
      const allFillPositions = [...slashPositions, doubleTriggerPos].sort((a, b) => a - b);
      
      // Always use batch fill - it handles all positions including the //
      triggerBatchFill(fullText, allFillPositions);
    } else {
      setText(newText);
    }
  };

  // Orchestrate image search + fallback generation
  const triggerImageCommand = async (query, placeholderId) => {
    if (llmStatus !== 'connected') {
      Alert.alert('LLM API Not Connected', 'Tap the Cloud button in the menu to add your OpenRouter API key.');
      return;
    }

    setImageLoading(true);

    try {
      // Resolve pronouns/references using note context
      const noteContext = stripImageMarkers(text.replace(placeholderId, '').trim()).slice(0, 500);
      let resolvedQuery = query;

      if (noteContext.length > 0 && /\b(he|she|her|him|his|they|them|it|this|that)\b/i.test(query)) {
        try {
          const data = await makeApiCall('/chat/completions', {
            model: 'anthropic/claude-haiku-4.5',
            messages: [
              { role: 'system', content: 'The user is writing a note and wants to insert an image. Resolve any pronouns or vague references in their image request using the note context. Return ONLY the resolved description (e.g. "Sam Altman smiling"). No explanation.' },
              { role: 'user', content: `Note context: "${noteContext}"\n\nImage request: "${query}"` },
            ],
            temperature: 0.1,
            max_tokens: 50,
          }, apiKey);
          const resolved = coerceMessageContent(data.choices?.[0]?.message?.content || '').trim();
          if (resolved.length > 0) resolvedQuery = resolved;
        } catch (e) {
          // If resolution fails, use original query
        }
      }

      // Step 1: Try Gemini with Google Search grounding (most accurate)
      let imageUri = await searchGoogleImages(resolvedQuery);

      // Step 2: Fall back to Gemini generation as last resort
      if (!imageUri) {
        console.log('Image search returned no results, falling back to Gemini image generation...');
        imageUri = await generateImageWithGemini(resolvedQuery);
      }

      if (imageUri) {
        // Replace the placeholder with the real image marker in current text
        const marker = `[IMG||${imageUri}||${query}]`;
        setText(prev => prev.replace(placeholderId, marker));
      } else {
        // Remove the placeholder if search failed
        setText(prev => prev.replace(placeholderId, ''));
        Alert.alert('Image Not Found', `Could not find or generate an image for "${query}".`);
      }
    } catch (error) {
      console.error('Image command error:', error);
      Alert.alert('Error', 'Something went wrong while fetching the image.');
    } finally {
      setImageLoading(false);
    }
  };

  // Handle text change within a specific content block
  const handleBlockTextChange = (blockIndex, newBlockText) => {
    const newBlocks = [...contentBlocks];
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], content: newBlockText };

    // Serialize back to text and run through normal handleTextChange
    const serialized = blocksToText(newBlocks);
    handleTextChange(serialized);
  };

  // Sync contentBlocks from text whenever text changes
  useEffect(() => {
    setContentBlocks(textToBlocks(text));
  }, [text]);

  // Find all standalone / placeholders: preceded by space/start, not part of // or ://
  // Also skips slashes inside [IMG:...] markers
  const findAllSlashPlaceholders = (text) => {
    // Build set of index ranges occupied by [IMG:...] markers
    const imgRanges = [];
    const imgRegex = new RegExp(IMAGE_MARKER_REGEX.source, 'g');
    let imgMatch;
    while ((imgMatch = imgRegex.exec(text)) !== null) {
      imgRanges.push([imgMatch.index, imgMatch.index + imgMatch[0].length]);
    }
    const isInsideImgMarker = (idx) => imgRanges.some(([start, end]) => idx >= start && idx < end);

    const positions = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '/') {
        if (isInsideImgMarker(i)) continue;

        const prevChar = i > 0 ? text[i - 1] : ' ';
        const nextChar = i < text.length - 1 ? text[i + 1] : ' ';

        // Must not be part of // or ://
        if (prevChar !== ':' && prevChar !== '/' && nextChar !== '/') {
          // Must have space-like character before (or be at start)
          if (prevChar === ' ' || prevChar === '\n' || prevChar === '\t' || i === 0) {
            positions.push(i);
          }
        }
      }
    }
    return positions;
  };

  // Batch fill: process all fill positions (/ and //) with a single API call
  const triggerBatchFill = async (fullText, fillPositions) => {
    if (llmStatus !== 'connected') {
      Alert.alert('LLM API Not Connected', 'Tap the Cloud button in the menu to add your OpenRouter API key.');
      setText(fullText);
      return;
    }

    // Build text with numbered [FILL_N] markers for each position
    let markedText = '';
    let lastPos = 0;
    for (let i = 0; i < fillPositions.length; i++) {
      const pos = fillPositions[i];
      markedText += fullText.slice(lastPos, pos);
      markedText += `[FILL_${i + 1}]`;
      lastPos = pos + 1; // Skip the / (or first char of //)
    }
    markedText += fullText.slice(lastPos);

    // Build base text - just remove the / characters, keep spacing natural
    // The wave animation will appear where the / was
    let baseText = '';
    lastPos = 0;
    const animPositions = [];
    for (let i = 0; i < fillPositions.length; i++) {
      const pos = fillPositions[i];
      // Get text before this position (keep spacing intact)
      baseText += fullText.slice(lastPos, pos);
      animPositions.push(baseText.length);
      // Skip just the / character
      lastPos = pos + 1;
    }
    // Add remaining text
    baseText += fullText.slice(lastPos);

    // Start multi-position thinking animation
    setThinkingBaseText(baseText);
    setThinkingPositions(animPositions);
    setIsThinking(true);

    const today = new Date().toDateString();
    const startTime = Date.now();

    try {
      const data = await makeApiCall('/chat/completions', {
        model: 'anthropic/claude-haiku-4.5',
        plugins: [{ id: 'web', max_results: 3 }],
        messages: [
          { role: 'system', content: BATCH_FILL_PROMPT + `\nToday's date is ${today}.` },
          { role: 'user', content: markedText }
        ],
        temperature: 0.1,
        max_tokens: 256,
      }, apiKey);

      const latencyMs = Date.now() - startTime;
      
      // Debug logging
      console.log('Batch fill API response:', JSON.stringify(data, null, 2));

      // Stop thinking animation
      setIsThinking(false);
      setThinkingPositions([]);
      setThinkingBaseText('');

      if (data.choices && data.choices.length > 0) {
        const rawContent = coerceMessageContent(data.choices[0].message.content);
        console.log('Batch fill raw content:', rawContent);
        
        // Parse JSON array response
        let answers = [];
        try {
          // Try to extract JSON array from response
          const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            answers = JSON.parse(jsonMatch[0]);
          }
        } catch (parseError) {
          console.error('Failed to parse batch response:', parseError);
          // Fallback: split by common delimiters
          answers = rawContent.split(/[,\n]/).map(s => s.replace(/["'\[\]]/g, '').trim()).filter(Boolean);
        }

        // Ensure we have the right number of answers
        while (answers.length < fillPositions.length) {
          answers.push('');
        }

        // Sanitize each answer
        answers = answers.map(a => sanitizeModelContent(String(a)));

        // Add color dot for the batch fill
        const tokensUsed = data.usage?.completion_tokens || data.usage?.total_tokens || rawContent.length / 4;
        addColorDot(latencyMs, tokensUsed);

        // Animate each fill sequentially
        await animateBatchFills(baseText, animPositions, answers);
      } else {
        // Failed - just show text without slashes
        setText(baseText);
      }
    } catch (error) {
      console.error('Batch fill error:', error);
      setIsThinking(false);
      setThinkingPositions([]);
      setThinkingBaseText('');
      setText(baseText);
    }
  };

  // Animate batch fills one by one with typing animation
  // Returns the final filled text
  const animateBatchFills = async (baseText, positions, answers) => {
    let currentText = baseText;
    
    // Process each fill, tracking cumulative offset
    let cumulativeOffset = 0;
    
    for (let i = 0; i < positions.length; i++) {
      const answer = answers[i];
      if (!answer) continue;
      
      // Calculate current insert position with offset
      const insertPos = positions[i] + cumulativeOffset;
      const rawBefore = currentText.slice(0, insertPos);
      const rawAfter = currentText.slice(insertPos);
      
      // Trim whitespace and add consistent spacing
      const trimmedBefore = rawBefore.replace(/\s+$/, '');
      const trimmedAfter = rawAfter.replace(/^\s+/, '');
      
      // Build spaced answer
      let spacedAnswer = answer.trim();
      
      // Add space before if needed
      if (trimmedBefore.length > 0 && !/[\n([{]$/.test(trimmedBefore)) {
        spacedAnswer = ' ' + spacedAnswer;
      }
      
      // Add space after if needed  
      if (trimmedAfter.length > 0 && !/^[\n.,!?;:'"\-—–)\]}]/.test(trimmedAfter)) {
        spacedAnswer = spacedAnswer + ' ';
      }
      
      // Animate this fill
      await streamSingleFill(setText, trimmedBefore, spacedAnswer, trimmedAfter, { speed: 30 });
      
      // Update currentText
      currentText = trimmedBefore + spacedAnswer + trimmedAfter;
      
      // Update cumulative offset for next iteration
      // Original: we had some chars at position, now we have spacedAnswer there
      // The difference affects all subsequent positions
      const originalLength = rawBefore.length + rawAfter.length;
      const newLength = currentText.length;
      cumulativeOffset = newLength - baseText.length;
    }
    
    return currentText;
  };

  // Inline fill at // position (no / placeholders, just generate continuation)
  const triggerInlineFill = async (prefix, suffix) => {
    if (llmStatus !== 'connected') {
      const message = isProxyMode() 
        ? 'LLM API Not Connected. The backend service may be unavailable.'
        : 'LLM API Not Connected. Tap the Cloud button in the menu to add your OpenRouter API key.';
      Alert.alert('Not Connected', message);
      setText(prefix + '//' + suffix);
      return;
    }

    // Start animated thinking indicator
    setThinkingPrefix(prefix);
    setThinkingSuffix(suffix);
    setIsThinking(true);

    // Build context with [FILL] marker
    const limitedPrefix = prefix.slice(-1500);
    const limitedSuffix = suffix.slice(0, 500);
    const fullContext = limitedPrefix + '[FILL]' + limitedSuffix;
    const today = new Date().toDateString();

    try {
      const startTime = Date.now();
      const data = await makeApiCall('/chat/completions', {
        model: 'anthropic/claude-haiku-4.5',
        plugins: [{ id: 'web', max_results: 3 }],
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + `\nToday's date is ${today}.` },
          { role: 'user', content: fullContext }
        ],
        temperature: 0.2,
        max_tokens: 64,
      }, apiKey);
      const latencyMs = Date.now() - startTime;
      
      // Debug logging
      console.log('Inline fill API response:', JSON.stringify(data, null, 2));
      
      // Stop thinking animation
      setIsThinking(false);

      // Store debug info
      setDebugData({
        sentMessages: [
          { role: 'system', content: SYSTEM_PROMPT + `\nToday's date is ${today}.` },
          { role: 'user', content: fullContext }
        ],
        rawResponse: data
      });
      
      if (data.choices && data.choices.length > 0) {
        const rawContent = coerceMessageContent(data.choices[0].message.content);
        console.log('Inline fill raw content:', rawContent);
        let cleanedContent = sanitizeModelContent(rawContent);

        if (!cleanedContent) {
          setText(prefix + suffix);
          return;
        }

        // Trim whitespace and add consistent spacing
        const trimmedPrefix = prefix.replace(/\s+$/, '');
        const trimmedSuffix = suffix.replace(/^\s+/, '');
        
        let spacedContent = cleanedContent.trim();
        
        // Add space before if needed
        if (trimmedPrefix.length > 0 && !/[\n([{]$/.test(trimmedPrefix)) {
          spacedContent = ' ' + spacedContent;
        }
        
        // Add space after if needed  
        if (trimmedSuffix.length > 0 && !/^[\n.,!?;:'"\-—–)\]}]/.test(trimmedSuffix)) {
          spacedContent = spacedContent + ' ';
        }

        // Add color dot
        const tokensUsed = data.usage?.completion_tokens || data.usage?.total_tokens || spacedContent.length / 4;
        addColorDot(latencyMs, tokensUsed);

        // Animate the fill with typing effect
        await streamSingleFill(setText, trimmedPrefix, spacedContent, trimmedSuffix, { speed: 30 });
      } else {
        setText(prefix + suffix);
      }

    } catch (error) {
      setIsThinking(false);
      setText(prefix + suffix);
    }
  };

  // Show all notes (don't filter out current note)
  const savedNotes = notes;

  // Animation interpolation for saved notes overlay (fade in/out)
  const savedNotesOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  // Editor content fades out when notes overlay opens
  const editorOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  // Get gradient colors based on theme
  const getGradientColors = () => {
    const base = Colors[theme].background;
    switch (theme) {
      case 'light':
        return {
          start: ['#E8E8ED', '#D8D8DD', '#E8E8ED'],
          end: ['#D8D8DD', '#E8E8ED', '#D8D8DD'],
        };
      case 'dark':
        return {
          start: ['#000000', '#0a0a0a', '#000000'],
          end: ['#0a0a0a', '#000000', '#0a0a0a'],
        };
      default:
        return {
          start: [base, base, base],
          end: [base, base, base],
        };
    }
  };

  const gradientColors = getGradientColors();
  
  // Interpolate gradient position
  const gradientStart = gradientAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.3],
  });
  const gradientEnd = gradientAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.7],
  });

  return (
    <View style={[styles.container, { backgroundColor: Colors[theme].background }]}>
      {/* Animated Gradient Background */}
      <Animated.View style={[StyleSheet.absoluteFill]} pointerEvents="none">
        <LinearGradient
          colors={gradientColors.start}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      
      {/* LLM Trigger Color Dots - watercolor ink blot effect */}
      <View style={[StyleSheet.absoluteFill]} pointerEvents="none">
        {colorDots.map(dot => (
          <Animated.View
            key={dot.id}
            style={{
              position: 'absolute',
              left: dot.x,
              top: dot.y,
              opacity: dot.opacity,
              transform: [
                { scale: dot.scale || 1 },
                { translateX: dot.translateX || 0 },
                { translateY: dot.translateY || 0 },
              ],
            }}
          >
            {/* Render multiple overlapping shapes for watercolor effect */}
            {(dot.blotShapes || []).map((shape, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: shape.offsetX - (dot.size * shape.scale) / 2,
                  top: shape.offsetY - (dot.size * shape.scale) / 2,
                  width: dot.size * shape.scale,
                  height: dot.size * shape.scale,
                  borderRadius: (dot.size * shape.scale) / 2,
                  backgroundColor: shape.color || dot.color,
                  opacity: shape.opacity,
                  transform: [
                    { rotate: `${shape.rotation}deg` },
                    { scaleX: shape.scaleX },
                    { scaleY: shape.scaleY },
                  ],
                }}
              />
            ))}
          </Animated.View>
        ))}
      </View>
      
      {/* Heavy Blur Layer - makes dots look like soft glowing orbs */}
      <BlurView
        intensity={100}
        tint={theme === 'light' ? 'light' : 'dark'}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      
      {/* Second blur pass for extra smoothness */}
      <BlurView
        intensity={60}
        tint={theme === 'light' ? 'light' : 'dark'}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      
      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, opacity: editorOpacity }}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View style={{ flex: 1 }}>
                <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />

              {/* Sticky header - contains the single animated title */}
              <Animated.View
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  left: 0,
                  zIndex: 100,
                }}
                pointerEvents="none"
              >
                {/* Ambient blur background - heavily overlapped for seamless falloff */}
                <Animated.View
                  style={{
                    position: 'absolute',
                    top: -50,
                    left: 0,
                    right: 0,
                    height: 190,
                    opacity: scrollY.interpolate({
                      inputRange: [0, 80, 140],
                      outputRange: [0, 0.3, 1],
                      extrapolate: 'clamp',
                    }),
                  }}
                >
                  {/* Layers heavily overlap to blend seamlessly */}
                  <BlurView
                    intensity={30}
                    tint={theme === 'light' ? 'light' : 'dark'}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130 }}
                  />
                  <BlurView
                    intensity={25}
                    tint={theme === 'light' ? 'light' : 'dark'}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 140 }}
                  />
                  <BlurView
                    intensity={20}
                    tint={theme === 'light' ? 'light' : 'dark'}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 150 }}
                  />
                  <BlurView
                    intensity={15}
                    tint={theme === 'light' ? 'light' : 'dark'}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 160 }}
                  />
                  <BlurView
                    intensity={10}
                    tint={theme === 'light' ? 'light' : 'dark'}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 170 }}
                  />
                  <BlurView
                    intensity={5}
                    tint={theme === 'light' ? 'light' : 'dark'}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180 }}
                  />
                  <BlurView
                    intensity={2}
                    tint={theme === 'light' ? 'light' : 'dark'}
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 190 }}
                  />
                </Animated.View>
                
                {/* Single animated title */}
                <Animated.Text 
                  numberOfLines={2}
                  style={[
                    { 
                      color: Colors[theme].text,
                      paddingHorizontal: 24,
                      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
                      paddingTop: scrollY.interpolate({
                        inputRange: [0, 120],
                        outputRange: [140, 54],
                        extrapolate: 'clamp',
                      }),
                      paddingBottom: 4,
                      fontSize: scrollY.interpolate({
                        inputRange: [0, 120],
                        outputRange: [42, 17],
                        extrapolate: 'clamp',
                      }),
                      fontWeight: '400',
                      letterSpacing: -0.5,
                    }
                  ]}
                >
                  {title}
                </Animated.Text>
                
                {/* Date - just fades out naturally */}
                <Animated.Text style={{ 
                  paddingHorizontal: 24, 
                  fontSize: 12, 
                  color: theme === 'light' ? '#687076' : '#9BA1A6',
                  fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
                  marginBottom: 16,
                  opacity: scrollY.interpolate({
                    inputRange: [0, 60, 100],
                    outputRange: [1, 0.3, 0],
                    extrapolate: 'clamp',
                  }),
                }}>
                  {currentDate.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </Animated.Text>
              </Animated.View>

              {/* Editor */}
              <ScrollView
                ref={scrollViewRef}
                style={styles.editorWrapper}
                contentContainerStyle={{ flexGrow: 1, paddingTop: 280, paddingBottom: 300 }}
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
                automaticallyAdjustKeyboardInsets={true}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                  { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
              >
                {contentBlocks.map((block, index) => {
                  if (block.type === 'image') {
                    return (
                      <View key={`img-${index}`} style={styles.imageBlock}>
                        <ExpoImage
                          source={{ uri: block.uri }}
                          style={styles.imageContent}
                          contentFit="cover"
                          transition={200}
                          onError={() => console.log('Image failed to load:', block.uri?.slice(0, 100))}
                        />
                      </View>
                    );
                  }
                  if (block.type === 'image_loading') {
                    return (
                      <ImageLoadingShimmer key={`loading-${index}`} theme={theme} />
                    );
                  }
                  // Ensure text blocks after images/loading have minimum height so they're tappable
                  const prevBlock = index > 0 ? contentBlocks[index - 1] : null;
                  const isAfterImage = prevBlock?.type === 'image' || prevBlock?.type === 'image_loading';
                  return (
                    <TextInput
                      key={`text-${index}`}
                      ref={(ref) => { textInputRefs.current[index] = ref; }}
                      style={[
                        styles.editor,
                        { color: Colors[theme].text, marginTop: index === 0 ? 16 : 0 },
                        isAfterImage ? { minHeight: 120 } : null,
                      ]}
                      multiline
                      scrollEnabled={false}
                      value={block.content}
                      onChangeText={(newText) => handleBlockTextChange(index, newText)}
                      placeholder={index === 0 && contentBlocks.length === 1 ? "Type / for blanks, // to fill them, /image query/" : isAfterImage ? "Keep typing..." : undefined}
                      placeholderTextColor="#9ca3af"
                      textAlignVertical="top"
                    />
                  );
                })}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* Saved Notes Overlay */}
        <Animated.View 
          style={[
            savedNotesOverlayStyles.container,
            { 
              opacity: savedNotesOpacity,
              backgroundColor: theme === 'light' ? 'rgba(255,255,255,0.3)' 
                : theme === 'dark' ? 'rgba(21,23,24,0.3)'
                : theme === 'ultramarine' ? 'rgba(0,32,128,0.3)'
                : theme === 'orange' ? 'rgba(179,71,0,0.3)'
                : 'rgba(74,44,56,0.3)',
            }
          ]}
          pointerEvents={showingSavedNotes ? 'auto' : 'none'}
        >
          <BlurView
            intensity={25}
            tint={theme === 'light' ? 'light' : 'dark'}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView style={{ flex: 1 }}>
            {/* Fixed header with tiered blur - matches collapsed note title style */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                left: 0,
                zIndex: 100,
              }}
              pointerEvents="box-none"
            >
              {/* Tiered blur background */}
              <View
                style={{
                  position: 'absolute',
                  top: -50,
                  left: 0,
                  right: 0,
                  height: 190,
                }}
              >
                <BlurView
                  intensity={30}
                  tint={theme === 'light' ? 'light' : 'dark'}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130 }}
                />
                <BlurView
                  intensity={25}
                  tint={theme === 'light' ? 'light' : 'dark'}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 140 }}
                />
                <BlurView
                  intensity={20}
                  tint={theme === 'light' ? 'light' : 'dark'}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 150 }}
                />
                <BlurView
                  intensity={15}
                  tint={theme === 'light' ? 'light' : 'dark'}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 160 }}
                />
                <BlurView
                  intensity={10}
                  tint={theme === 'light' ? 'light' : 'dark'}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 170 }}
                />
                <BlurView
                  intensity={5}
                  tint={theme === 'light' ? 'light' : 'dark'}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 180 }}
                />
                <BlurView
                  intensity={2}
                  tint={theme === 'light' ? 'light' : 'dark'}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 190 }}
                />
              </View>
              
              {/* Small title - tappable */}
              <TouchableOpacity 
                onPress={handleNotesTitleTap}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: 20,
                  paddingTop: 100,
                  paddingBottom: 4,
                }}
              >
                <Text 
                  style={{ 
                    color: Colors[theme].text,
                    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
                    fontSize: 22,
                    fontWeight: '400',
                    letterSpacing: 0.5,
                  }}
                >
                  {notesPageTitle}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={savedNotesOverlayStyles.notesList}
              contentContainerStyle={[savedNotesOverlayStyles.notesListContent, { paddingTop: 146 }]}
            >

            {savedNotes.length === 0 ? (
              <View style={savedNotesOverlayStyles.emptyState}>
                <Text style={{ color: theme === 'light' ? '#999' : '#8E8E93', fontSize: 16 }}>
                  No saved notes yet
                </Text>
              </View>
            ) : (
              savedNotes.slice(0, 50).map(note => {
                return (
                  <TouchableOpacity 
                    key={note.id}
                    style={{ 
                      paddingVertical: 16,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: theme === 'light' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)',
                    }}
                    onPress={() => openNote(note)}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={[{ 
                        fontSize: 17, 
                        fontWeight: '500',
                        color: Colors[theme].text,
                        flex: 1,
                        marginRight: 12,
                      }]} numberOfLines={1}>
                        {note.title || 'Untitled'}
                      </Text>
                      <Text style={{ fontSize: 15, color: Colors[theme].text, opacity: 0.7 }}>
                        {new Date(note.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>
                    <Text style={{ 
                      fontSize: 15, 
                      color: Colors[theme].text,
                      opacity: 0.7,
                      marginTop: 4,
                    }} numberOfLines={1}>
                      {note.content ? stripImageMarkers(note.content).replace(/\[IMG\|\|.*?\|\|.*?\]/g, '').trim() || '(image)' : 'No content'}
                    </Text>
                  </TouchableOpacity>
                );
              })
            )}
            {savedNotes.length > 50 && (
              <Text style={{ textAlign: 'center', color: '#999', marginTop: 10 }}>
                Showing 50 of {savedNotes.length} notes
              </Text>
            )}
          </ScrollView>
          </SafeAreaView>
        </Animated.View>

        {/* API Key Modal */}
        <Modal
          visible={showKeyModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowKeyModal(false)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Enter OpenRouter API Key</Text>
              <TextInput
                style={styles.modalInput}
                value={tempKey}
                onChangeText={setTempKey}
                placeholder="sk-or-..."
                autoCapitalize="none"
                secureTextEntry
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowKeyModal(false)}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={saveApiKey}>
                  <Text style={[styles.buttonText, { color: '#fff' }]}>Save & Connect</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Debug Overlay - Removed */}
        
        {/* Debug Panel - Removed */}

        <FloatingMenu 
          debugMode={debugMode}
          toggleDebug={() => setDebugMode(!debugMode)}
          llmStatus={llmStatus}
          onConnectPress={handleConnectPress}
          theme={theme}
          setTheme={setTheme}
          toggleTheme={toggleTheme}
          resetApp={resetApp}
          debugData={debugData}
          onNotesPress={showingSavedNotes ? createNewNote : showSavedNotesView}
          notesButtonLabel={showingSavedNotes ? 'New' : 'Notes'}
          noteText={text}
          onNewNote={createNewNote}
          hideApiButton={isProxyMode()}
        />

      </SafeAreaView>
    </View>
  );
}

// Styles for saved notes overlay
const savedNotesOverlayStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
  },
  notesList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  notesListContent: {
    paddingBottom: 100,
  },
  newNoteButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    marginBottom: 16,
    alignItems: 'center',
  },
  newNoteText: {
    fontSize: 16,
    fontWeight: '600',
  },
  noteItem: {
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  notePreview: {
    fontSize: 14,
    marginBottom: 8,
  },
  noteDate: {
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 50,
  },
  closeButton: {
    backgroundColor: '#000',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignSelf: 'center',
    marginBottom: 40,
  },
});
