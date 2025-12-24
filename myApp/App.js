import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Text, 
  TextInput, 
  View, 
  TouchableOpacity, 
  Modal, 
  Platform, 
  KeyboardAvoidingView, 
  Alert,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Dimensions,
  StyleSheet,
  Easing,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SYSTEM_PROMPT } from './constants/prompts';
import { Colors } from './constants/theme';
import { styles } from './styles';
import { streamSingleFill, streamResponse, streamDelete } from './utils/animations';
import FloatingMenu from './components/FloatingMenu';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORAGE_KEY_API = 'llm_api_key';
const NOTES_STORAGE_KEY = 'notes_data';

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
  const blotCounter = useRef(0); // Track blots for occasional contrast color
  const screenDimensions = Dimensions.get('window');
  
  // Complementary color families - opposites on the color wheel
  const complementaryFamilies = {
    ocean: 'sunset',   // blue ↔ orange
    sunset: 'ocean',   // orange ↔ blue
    forest: 'bloom',   // green ↔ pink
    bloom: 'forest',   // pink ↔ green
  };
  
  // Color families - each note gets one randomly assigned
  const colorFamilies = {
    ocean: [
      '#40E0D0', // Turquoise
      '#5BC0DE', // Soft sky blue
      '#6BB3D9', // Medium blue
      '#48D1CC', // Medium turquoise
      '#66CDAA', // Medium aquamarine
      '#7EC8E3', // Light cerulean
      '#5DADE2', // Soft dodger blue
      '#73C6B6', // Soft teal
    ],
    forest: [
      '#66CDAA', // Medium aquamarine
      '#7FD67F', // Medium spring green
      '#8FBC8F', // Dark sea green
      '#77DD77', // Pastel green
      '#90EE90', // Light green
      '#98D98E', // Soft lime
      '#7CCD7C', // Medium lime
      '#88D498', // Soft mint
    ],
    sunset: [
      '#FF9966', // Atomic tangerine
      '#FFAB76', // Soft coral
      '#FFB347', // Pastel orange
      '#FFCC80', // Light orange
      '#FFA07A', // Light salmon
      '#FFB088', // Soft peach
      '#FFBE76', // Warm honey
      '#FFC299', // Apricot
    ],
    bloom: [
      '#FF85A2', // Soft hot pink
      '#E88FD0', // Medium orchid
      '#DA70D6', // Orchid
      '#DDA0DD', // Plum
      '#FF99CC', // Light pink
      '#E6A8D7', // Soft mauve
      '#F49AC2', // Pastel magenta
      '#D291BC', // Soft lavender pink
    ],
  };
  
  const colorFamilyNames = Object.keys(colorFamilies);
  
  // Get a random color family name
  const getRandomColorFamily = () => {
    return colorFamilyNames[Math.floor(Math.random() * colorFamilyNames.length)];
  };
  
  // Get color based on token count within the note's color family
  // Few tokens = lighter/cooler shades, many tokens = more saturated/warmer shades
  const getColorFromTokens = (tokens, useComplementary = false) => {
    // Get current family, or pick one if not set
    let family = colorFamily || getRandomColorFamily();
    
    // Use complementary family if requested (for accent blots)
    if (useComplementary) {
      family = complementaryFamilies[family] || 'ocean';
    }
    
    const familyColors = colorFamilies[family] || colorFamilies.ocean;
    
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
    // Increment blot counter
    blotCounter.current += 1;
    
    // Every 8-12 blots, add a complementary accent color
    const isAccentBlot = blotCounter.current >= 8 && blotCounter.current % (8 + Math.floor(Math.random() * 5)) === 0;
    
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
    const baseColor = getColorFromTokens(tokens, isAccentBlot);
    const family = isAccentBlot 
      ? complementaryFamilies[colorFamily || 'ocean'] 
      : (colorFamily || getRandomColorFamily());
    const familyColors = colorFamilies[family] || colorFamilies.ocean;
    
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
    blotCounter.current = 0; // Reset blot counter for new note
    
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
    const timeout = setTimeout(() => {
      if (llmStatus === 'connected' && text.length > 20 && Math.abs(text.length - lastTitleGenLength) > 50) {
        generateTitle();
      }
    }, 3000); // Debounce 3s
    return () => clearTimeout(timeout);
  }, [text, llmStatus, lastTitleGenLength]);

  const generateTitle = async () => {
    if (!apiKey) return;
    
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://github.com/elijahking/text-editor-app',
          'X-Title': 'Writer App',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite-preview-09-2025',
          messages: [
            { role: 'system', content: "You are a helpful assistant. Summarize the user's text into a short, concise title (3-5 words max). Do not use quotes." },
            { role: 'user', content: text.slice(0, 1000) } // Limit context
          ],
          temperature: 0.3,
          max_tokens: 10,
        }),
      });

      const data = await response.json();
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
      const storedKey = await AsyncStorage.getItem(STORAGE_KEY_API);
      if (storedKey) {
        setApiKey(storedKey);
        validateConnection(storedKey);
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
  };

  const validateConnection = async (key) => {
    setLlmStatus('connecting');
    try {
      // Check OpenRouter models endpoint
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${key}`,
        },
      });
      
      if (response.ok) {
        setLlmStatus('connected');
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
    // Check for // trigger (batch fill after punctuation/newline, or inline fill mid-sentence)
    const doubleTriggerRegex = /(?<!:)\/\//;
    const doubleMatch = newText.match(doubleTriggerRegex);

    if (doubleMatch) {
       const index = doubleMatch.index;
       const prefix = newText.slice(0, index);
       const suffix = newText.slice(index + 2);

      // Easter egg: if editor is effectively empty, show Boing boing!
      if (prefix.trim() === '') {
        if (llmStatus !== 'connected') {
          Alert.alert('Not Connected', 'Tap the status dot to connect OpenRouter.');
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
       
       // Determine if this is a "batch fill" trigger (// after punctuation or on new line)
       // vs an inline trigger (// in middle of sentence)
       const trimmedPrefix = prefix.trimEnd();
       const endsWithPunctuation = /[.!?]$/.test(trimmedPrefix);
       const endsWithNewline = prefix.endsWith('\n') || prefix.trimEnd() === '';
       const hasPendingPlaceholders = findSingleSlash(prefix) !== -1;
       const isBatchFill = endsWithPunctuation || endsWithNewline || hasPendingPlaceholders;
       
       if (isBatchFill) {
         // Batch fill: find all / placeholders and fill them one by one
         triggerBatchFill(prefix, suffix);
       } else {
         // Inline trigger: immediate fill at cursor
         triggerLLM(prefix, suffix);
       }
    } else {
       setText(newText);
    }
  };

  // Find standalone / placeholder: space before, space/punctuation after, not part of URL
  const findSingleSlash = (text) => {
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '/') {
        // Check it's not part of // or ://
        const prevChar = i > 0 ? text[i - 1] : ' ';
        const nextChar = i < text.length - 1 ? text[i + 1] : ' ';
        
        // Must be: space before (or start), and not followed by /
        // Also not preceded by : (URL)
        if (prevChar !== ':' && prevChar !== '/' && nextChar !== '/') {
          // Check prev is space-like or start
          if (prevChar === ' ' || prevChar === '\n' || prevChar === '\t' || i === 0) {
            return i;
          }
        }
      }
    }
    return -1;
  };

  // Batch fill: process each standalone / one at a time, sequentially
  const triggerBatchFill = async (prefix, suffix) => {
    if (llmStatus !== 'connected') {
      Alert.alert('Not Connected', 'Tap the status dot to connect OpenRouter.');
      setText(prefix + '//' + suffix);
      return;
    }

    let currentPrefix = prefix;
    let currentSuffix = suffix;

    const processSegment = async (segment, otherSegmentContext, otherSegmentDisplay, isPrefix) => {
      let currentSegment = segment;
      
      while (true) {
        const slashIndex = findSingleSlash(currentSegment);
        if (slashIndex === -1) break;
        
        const beforeSlash = currentSegment.slice(0, slashIndex);
        const afterSlash = currentSegment.slice(slashIndex + 1);
        
        // Show loading placeholder
        const beforeAnim = isPrefix ? beforeSlash : otherSegmentDisplay + beforeSlash;
        const afterAnim = isPrefix ? afterSlash + otherSegmentDisplay : afterSlash;
        setText(beforeAnim + '…' + afterAnim);
        
        // Build context: replace ONLY THIS / with [CURSOR], keep other / as is
        const cursorMarker = '[CURSOR]';
        const fullContext = isPrefix 
          ? beforeSlash + cursorMarker + afterSlash + otherSegmentContext
          : otherSegmentContext + beforeSlash + cursorMarker + afterSlash;
          
        const today = new Date().toDateString();

        try {
          const startTime = Date.now();
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'HTTP-Referer': 'https://github.com/elijahking/text-editor-app',
              'X-Title': 'Writer App',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash-lite-preview-09-2025',
              plugins: [{ id: "web", max_results: 3 }],
              messages: [
                { role: 'system', content: SYSTEM_PROMPT + ` Today's date is ${today}.` },
                { role: 'user', content: fullContext }
              ],
              temperature: 0.2,
              max_tokens: 64,
            }),
          });

          const data = await response.json();
          const latencyMs = Date.now() - startTime;
          
          // Store debug info
          setDebugData({
            sentMessages: [
              { role: 'system', content: SYSTEM_PROMPT + ` Today's date is ${today}.` },
              { role: 'user', content: fullContext }
            ],
            rawResponse: data
          });
          
          let filledContent = '';
          if (data.choices && data.choices.length > 0) {
            const rawContent = coerceMessageContent(data.choices[0].message.content);
            filledContent = sanitizeModelContent(rawContent);
            
            // Add color dot - size from latency, color from tokens
            const tokensUsed = data.usage?.completion_tokens || data.usage?.total_tokens || filledContent.length / 4;
            addColorDot(latencyMs, tokensUsed);
          }
          
          if (filledContent) {
            // Stream this answer in
            await streamSingleFill(setText, beforeAnim, filledContent, afterAnim);
            // Update currentText with the filled answer for next iteration
            currentSegment = beforeSlash + filledContent + afterSlash;
          } else {
            // No result, just remove the /
            currentSegment = beforeSlash + afterSlash;
            setText(isPrefix ? currentSegment + otherSegmentDisplay : otherSegmentDisplay + currentSegment);
          }

        } catch (error) {
          console.error('Batch fill error:', error);
          currentSegment = beforeSlash + afterSlash;
          setText(isPrefix ? currentSegment + otherSegmentDisplay : otherSegmentDisplay + currentSegment);
          break;
        }
      }
      return currentSegment;
    };

    // Process prefix then suffix
    // We use '…' as a visual placeholder for the pending // trigger
    const separator = '…';
    currentPrefix = await processSegment(currentPrefix, currentSuffix, separator + currentSuffix, true);
    currentSuffix = await processSegment(currentSuffix, currentPrefix, currentPrefix + separator, false);
    
    // Finally, trigger immediate fill at the junction
    triggerLLM(currentPrefix, currentSuffix);
  };

  const triggerLLM = async (prefix, suffix) => {
    if (llmStatus !== 'connected') {
      Alert.alert('Not Connected', 'Tap the status dot to connect OpenRouter.');
      setText(prefix + '//' + suffix);
      return;
    }

    // Use a distinct placeholder character (Ellipsis) to avoid replacing wrong text
    const placeholder = '…'; 
    setText(prefix + placeholder + suffix);

    // Build full context with cursor marker so model understands insertion point
    const cursorMarker = '[CURSOR]';
    const limitedPrefix = prefix.slice(-1500);
    const limitedSuffix = suffix.slice(0, 500);
    const fullContext = limitedPrefix + cursorMarker + limitedSuffix;
    const today = new Date().toDateString();

    try {
      const startTime = Date.now();
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://github.com/elijahking/text-editor-app',
          'X-Title': 'Writer App',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite-preview-09-2025',
          plugins: [
            {
              id: "web",
              max_results: 3,
            }
          ],
          messages: [
            { role: 'system', content: SYSTEM_PROMPT + ` Today's date is ${today}.` },
            { role: 'user', content: fullContext }
          ],
          temperature: 0.2,
          max_tokens: 64,
        }),
      });

      const data = await response.json();
      const latencyMs = Date.now() - startTime;

      // Store debug info
      setDebugData({
        sentMessages: [
          { role: 'system', content: SYSTEM_PROMPT + ` Today's date is ${today}.` },
          { role: 'user', content: fullContext }
        ],
        rawResponse: data
      });
      
      if (data.choices && data.choices.length > 0) {
        const rawContent = coerceMessageContent(data.choices[0].message.content);
        const cleanedContent = sanitizeModelContent(rawContent);

        if (!cleanedContent) {
          setText(prev => prev.replace(placeholder, ''));
          return;
        }

        // Add color dot - size from latency, color from tokens
        const tokensUsed = data.usage?.completion_tokens || data.usage?.total_tokens || cleanedContent.length / 4;
        addColorDot(latencyMs, tokensUsed);

        // Start streaming effect
              await streamResponse(setText, cleanedContent, placeholder);
      } else {
        // Fail silently for better UX
        setText(prev => prev.replace(placeholder, ''));
      }

    } catch (error) {
      // Fail silently for better UX
      setText(prev => prev.replace(placeholder, ''));
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
          start: ['#151718', '#1a1d1e', '#151718'],
          end: ['#1a1d1e', '#151718', '#1a1d1e'],
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
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={0}
          >
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
                contentContainerStyle={{ flexGrow: 1, paddingTop: 280, paddingBottom: 100 }}
                keyboardDismissMode="interactive"
                keyboardShouldPersistTaps="handled"
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                  { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
              >
                <TextInput
                  style={[styles.editor, { minHeight: '100%', color: Colors[theme].text, marginTop: 16 }]}
                  multiline
                  scrollEnabled={false}
                  value={text}
                  onChangeText={handleTextChange}
                  onSelectionChange={() => {
                    // Scroll to keep cursor visible
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                  }}
                  placeholder="Type / for blanks, // to fill them"
                  placeholderTextColor="#9ca3af"
                  textAlignVertical="top"
                />
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
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
            <ScrollView 
              style={savedNotesOverlayStyles.notesList}
              contentContainerStyle={[savedNotesOverlayStyles.notesListContent, { paddingTop: '15%' }]}
            >
              {/* Header */}
              <Text style={[styles.headerTitle, { color: Colors[theme].text, marginBottom: 24, paddingHorizontal: 0 }]}>
                Notes
              </Text>

            {/* Clear All Button - only show if there are many notes */}
            {notes.length > 10 && (
              <TouchableOpacity 
                style={{ paddingVertical: 12, marginBottom: 8 }}
                onPress={() => {
                  Alert.alert(
                    'Clear All Notes?',
                    `This will delete all ${notes.length} notes. This cannot be undone.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete All', style: 'destructive', onPress: clearAllNotes },
                    ]
                  );
                }}
              >
                <Text style={{ color: '#FF3B30', fontSize: 15 }}>Clear All Notes</Text>
              </TouchableOpacity>
            )}

            {savedNotes.length === 0 ? (
              <View style={savedNotesOverlayStyles.emptyState}>
                <Text style={{ color: theme === 'light' ? '#999' : '#8E8E93', fontSize: 16 }}>
                  No saved notes yet
                </Text>
              </View>
            ) : (
              savedNotes.slice(0, 50).map(note => {
                const isCurrentNote = note.id === currentNoteId;
                return (
                  <TouchableOpacity 
                    key={note.id}
                    style={[
                      { 
                        paddingVertical: 16,
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: 'rgba(255,255,255,0.2)',
                      },
                      isCurrentNote && { opacity: 0.5 }
                    ]}
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
                      {note.content || 'No content'}
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
