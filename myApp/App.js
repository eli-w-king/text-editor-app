import AsyncStorage from '@react-native-async-storage/async-storage';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Dimensions,
    Easing,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    PanResponder,
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

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const STORAGE_KEY_API = 'llm_api_key';
const NOTES_STORAGE_KEY = 'notes_data';

// Helper to make API calls - works with both proxy and direct mode
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

const coerceMessageContent = (messageContent) => {
  if (typeof messageContent === 'string') return messageContent;
  if (Array.isArray(messageContent)) {
    return messageContent.map((segment) => {
      if (!segment) return '';
      if (typeof segment === 'string') return segment;
      if (typeof segment === 'object') return segment.text ?? segment.content ?? '';
      return '';
    }).join(' ');
  }
  if (messageContent && typeof messageContent === 'object' && 'content' in messageContent) {
    const value = messageContent.content;
    return typeof value === 'string' ? value : '';
  }
  return '';
};

const sanitizeModelContent = (rawInput) => {
  if (typeof rawInput !== 'string') return '';
  let cleaned = rawInput;
  cleaned = cleaned
    .replace(/^\s*(?:according to|based on|from|per|via|as per|the answer is|it is|this is|that is|it's|that's|here is|here's|the)[,:\s]*/gi, '')
    .replace(/^\s*(?:search results?|sources?|web search|results? show|i found|looking up)[,:\s]*/gi, '')
    .replace(/^\s*(?:the (?:acts?|artists?|bands?|members?|names?|answer) (?:under|include|is|are|would be))[,:\s]*/gi, '')
    .replace(/[:,]\s*\d+\s*$/g, '')
    .replace(/^[\s:,.-]+/, '')
    .replace(/[\s:,.]+$/, '');
  if (/^[^,]+,\s*(?:the|according|based|include|are|is)/i.test(cleaned)) {
    const match = cleaned.match(/(?:include|are|is)\s+(.+)/i);
    if (match) cleaned = match[1].trim();
  }
  cleaned = cleaned
    .replace(/\s*\[[^\]]*\b\w+\.\s*(?:com?|net|org|io|ai|app|news|tv|fm|uk|us|au|de|fr|jp|co)\b[^\]]*\]/gi, '')
    .replace(/\s*\[[^\]]*(?:https?:\/\/|www\.)[^\]]*\]/gis, '')
    .replace(/\s*\[[0-9]+\]/g, '')
    .replace(/\s*\[\s*\]/g, '');
  cleaned = cleaned
    .replace(/\s*\([^)]*\b\w+\.\s*(?:com?|net|org|io|ai|app|news|tv|fm|uk|us|au|de|fr|jp|co)\b[^)]*\)/gi, '')
    .replace(/\s*\([^)]*(?:https?:\/\/|www\.)[^)]*\)/gis, '')
    .replace(/\s*\((?:source|via|according to|reported by)[^)]*\)/gi, '')
    .replace(/\s*\(\s*\)/g, '');
  cleaned = cleaned
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/www\.[^\s)]+/gi, '');
  cleaned = cleaned
    .replace(/\s+([,.;!?])/g, '$1')
    .replace(/([,.;!?])(?!\s|$)/g, '$1 ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{2,}/g, '\n');
  cleaned = cleaned.trim();
  cleaned = cleaned.replace(/^[\[\](){}<>\-_:,*]+\s*/g, '');
  cleaned = cleaned.replace(/[\[\]()]+\s*$/g, '');
  cleaned = cleaned.replace(/\(\s*$/g, '').replace(/\[\s*$/g, '').replace(/^\s*\)/g, '').replace(/^\s*\]/g, '');
  return cleaned.trim();
};

// ─── Swipeable Note Row ────────────────────────────────────────────────────────
function SwipeableNoteRow({ note, theme, onPress, onDelete }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const DELETE_THRESHOLD = -80;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) translateX.setValue(Math.max(g.dx, -120));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < DELETE_THRESHOLD) {
          // Snap open to reveal delete
          Animated.spring(translateX, { toValue: -80, useNativeDriver: true }).start();
        } else {
          // Snap back
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const handleDelete = () => {
    Alert.alert('Delete Note', 'Are you sure you want to delete this note?', [
      { text: 'Cancel', style: 'cancel', onPress: () => Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start() },
      { text: 'Delete', style: 'destructive', onPress: () => {
        Animated.timing(translateX, { toValue: -SCREEN_WIDTH, duration: 250, useNativeDriver: true }).start(() => onDelete(note.id));
      }},
    ]);
  };

  return (
    <View style={{ overflow: 'hidden' }}>
      {/* Delete button underneath */}
      <View style={swipeStyles.deleteBackground}>
        <TouchableOpacity onPress={handleDelete} style={swipeStyles.deleteButton}>
          <Text style={swipeStyles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable row */}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        <TouchableOpacity
          style={{
            paddingVertical: 16,
            paddingHorizontal: 20,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme === 'light' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)',
            backgroundColor: theme === 'light' ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
          }}
          onPress={() => {
            // If swiped open, close it; otherwise open note
            translateX._value !== 0
              ? Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start()
              : onPress(note);
          }}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text
              style={{ fontSize: 17, fontWeight: '500', color: Colors[theme].text, flex: 1, marginRight: 12 }}
              numberOfLines={1}
            >
              {note.title || 'Untitled'}
            </Text>
            <Text style={{ fontSize: 15, color: Colors[theme].text, opacity: 0.7 }}>
              {new Date(note.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </Text>
          </View>
          <Text style={{ fontSize: 15, color: Colors[theme].text, opacity: 0.7, marginTop: 4 }} numberOfLines={1}>
            {note.content || 'No content'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
// ──────────────────────────────────────────────────────────────────────────────

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
  const [llmStatus, setLlmStatus] = useState('disconnected');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [debugMode, setDebugMode] = useState(false);
  const [debugData, setDebugData] = useState({ sentMessages: null, rawResponse: null });
  const [theme, setTheme] = useState('light');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingPrefix, setThinkingPrefix] = useState('');
  const [thinkingSuffix, setThinkingSuffix] = useState('');
  const [thinkingPositions, setThinkingPositions] = useState([]);
  const [thinkingBaseText, setThinkingBaseText] = useState('');
  
  useEffect(() => {
    if (!isThinking) return;
    const waveFrames = ['⠁⠄','⠁⠂','⠂⠁','⠄⠁','⠄⠂','⠂⠄'];
    let frameIndex = 0;
    const updatePlaceholder = () => {
      if (thinkingPositions.length > 0 && thinkingBaseText) {
        let result = '';
        let lastPos = 0;
        for (let i = 0; i < thinkingPositions.length; i++) {
          const pos = thinkingPositions[i];
          let before = thinkingBaseText.slice(lastPos, pos);
          let after = thinkingBaseText.slice(pos);
          const hasSpaceBefore = before.endsWith(' ');
          const hasSpaceAfter = after.startsWith(' ');
          result += before + (hasSpaceBefore ? '' : ' ') + waveFrames[frameIndex] + (hasSpaceAfter ? '' : ' ');
          lastPos = pos;
        }
        result += thinkingBaseText.slice(lastPos);
        setText(result);
      } else {
        const hasSpaceBefore = thinkingPrefix.endsWith(' ');
        const hasSpaceAfter = thinkingSuffix.startsWith(' ');
        setText(thinkingPrefix + (hasSpaceBefore ? '' : ' ') + waveFrames[frameIndex] + (hasSpaceAfter ? '' : ' ') + thinkingSuffix);
      }
      frameIndex = (frameIndex + 1) % waveFrames.length;
    };
    updatePlaceholder();
    const interval = setInterval(updatePlaceholder, 100);
    return () => clearInterval(interval);
  }, [isThinking, thinkingPrefix, thinkingSuffix, thinkingPositions, thinkingBaseText]);
  
  const [notesPageTitle, setNotesPageTitle] = useState('0 Notes');
  const [notes, setNotes] = useState([]);
  const [currentNoteId, setCurrentNoteId] = useState(null);
  const currentNoteIdRef = useRef(null);
  const [showingSavedNotes, setShowingSavedNotes] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const isSaving = useRef(false);
  const scrollViewRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const gradientAnim = useRef(new Animated.Value(0)).current;
  const [colorDots, setColorDots] = useState([]);
  const [colorFamily, setColorFamily] = useState(null);
  const screenDimensions = Dimensions.get('window');
  
  const colorFamilies = {
    burntOrange: ['#8B4513','#A0522D','#B7410E','#CC5500','#D2691E','#964B00','#8B3A00','#A45A2A'],
    darkBlue: ['#191970','#000080','#1B1B6A','#1C2951','#002147','#1D3461','#1A237E','#0D1B2A'],
    bloodRed: ['#660000','#8B0000','#800000','#6B0F1A','#722F37','#7B3B3B','#701C1C','#5C0A0A'],
    deepPurple: ['#301934','#4A0E4E','#2E0854','#3C1361','#4B0082','#371E4E','#2D1B3D','#432C6B'],
  };
  const colorFamilyNames = Object.keys(colorFamilies);
  const getRandomColorFamily = () => colorFamilyNames[Math.floor(Math.random() * colorFamilyNames.length)];
  
  const getColorFromTokens = (tokens) => {
    const family = colorFamily || getRandomColorFamily();
    const familyColors = colorFamilies[family] || colorFamilies.burntOrange;
    const normalized = Math.max(0, Math.min(1, (tokens - 5) / 50));
    if (normalized < 0.3) {
      const range = Math.floor(familyColors.length / 3) || 1;
      return familyColors[Math.floor(Math.random() * range)];
    } else if (normalized > 0.7) {
      const range = Math.floor(familyColors.length / 3) || 1;
      return familyColors[familyColors.length - range + Math.floor(Math.random() * range)];
    } else {
      const third = Math.floor(familyColors.length / 3) || 1;
      return familyColors[third + Math.floor(Math.random() * (familyColors.length - 2 * third || 1))];
    }
  };
  
  const addColorDot = (latencyMs = 500, tokens = 20) => {
    const clampedLatency = Math.max(200, Math.min(latencyMs, 2500));
    const targetSize = 80 + ((clampedLatency - 200) / 2300) * 120;
    const riseDistance = 20 + Math.random() * 30;
    const baseColor = getColorFromTokens(tokens);
    const family = colorFamily || getRandomColorFamily();
    const familyColors = colorFamilies[family] || colorFamilies.burntOrange;
    const blotShapes = Array.from({ length: 5 + Math.floor(Math.random() * 4) }, () => ({
      offsetX: (Math.random() - 0.5) * targetSize * 0.7,
      offsetY: (Math.random() - 0.5) * targetSize * 0.7,
      scale: 0.25 + Math.random() * 0.75,
      opacity: 0.15 + Math.random() * 0.35,
      rotation: Math.random() * 360,
      scaleX: 0.6 + Math.random() * 0.8,
      scaleY: 0.6 + Math.random() * 0.8,
      color: Math.random() > 0.4 ? baseColor : familyColors[Math.floor(Math.random() * familyColors.length)],
    }));
    const newDot = {
      id: Date.now() + Math.random(),
      x: Math.random() * screenDimensions.width,
      y: Math.random() * screenDimensions.height,
      color: baseColor,
      size: targetSize,
      blotShapes,
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0.3),
      translateX: new Animated.Value(0),
      translateY: new Animated.Value(riseDistance),
      driftX: (Math.random() - 0.5) * 30,
      driftY: (Math.random() - 0.5) * 20,
    };
    setColorDots(prev => [...prev, newDot]);
    const targetOpacity = 0.05 + Math.random() * 0.10;
    const duration = 5000 + Math.random() * 3000;
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(newDot.opacity, { toValue: targetOpacity, duration, useNativeDriver: true, easing: Easing.out(Easing.sin) }),
        Animated.timing(newDot.scale, { toValue: 1, duration: duration * 1.3, useNativeDriver: true, easing: Easing.out(Easing.sin) }),
        Animated.timing(newDot.translateY, { toValue: 0, duration: duration * 1.5, useNativeDriver: true, easing: Easing.out(Easing.sin) }),
      ]).start(() => {
        const wanderDrift = () => {
          const d = 8000 + Math.random() * 12000;
          Animated.parallel([
            Animated.timing(newDot.translateX, { toValue: (Math.random() - 0.5) * 30, duration: d, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
            Animated.timing(newDot.translateY, { toValue: (Math.random() - 0.5) * 20, duration: d * (0.7 + Math.random() * 0.6), useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
          ]).start(() => wanderDrift());
        };
        wanderDrift();
      });
    }, Math.random() * 500);
  };
  
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(gradientAnim, { toValue: 1, duration: 8000, useNativeDriver: false }),
      Animated.timing(gradientAnim, { toValue: 0, duration: 8000, useNativeDriver: false }),
    ])).start();
  }, []);

  useEffect(() => { currentNoteIdRef.current = currentNoteId; }, [currentNoteId]);

  const notesAnimating = useRef(false);
  const notesAnimationTimeout = useRef(null);
  const getNotesCountTitle = () => `${notes.length} ${notes.length === 1 ? 'Note' : 'Notes'}`;
  
  const animateNotesTitle = async (from, to) => {
    if (notesAnimating.current) return;
    notesAnimating.current = true;
    for (let i = from.length; i >= 0; i--) { setNotesPageTitle(from.slice(0, i)); await new Promise(r => setTimeout(r, 50)); }
    await new Promise(r => setTimeout(r, 200));
    for (let i = 0; i <= to.length; i++) { setNotesPageTitle(to.slice(0, i)); await new Promise(r => setTimeout(r, 80)); }
    notesAnimating.current = false;
  };
  
  const handleNotesTitleTap = async () => {
    if (notesAnimating.current) return;
    if (notesAnimationTimeout.current) clearTimeout(notesAnimationTimeout.current);
    const countTitle = getNotesCountTitle();
    if (notesPageTitle === '//') {
      await animateNotesTitle('//', countTitle);
      notesAnimationTimeout.current = setTimeout(async () => { await animateNotesTitle(getNotesCountTitle(), '//'); }, 3000);
    } else {
      await animateNotesTitle(notesPageTitle, '//');
    }
  };
  
  useEffect(() => {
    if (!showingSavedNotes) {
      setNotesPageTitle(getNotesCountTitle());
      if (notesAnimationTimeout.current) clearTimeout(notesAnimationTimeout.current);
      return;
    }
    const timeout = setTimeout(async () => { await animateNotesTitle(getNotesCountTitle(), '//'); }, 2000);
    return () => clearTimeout(timeout);
  }, [showingSavedNotes, notes.length]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const loadNotes = async () => {
    try {
      const storedNotes = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
      if (storedNotes) setNotes(JSON.parse(storedNotes));
    } catch (e) { console.error('Failed to load notes', e); }
  };

  const saveCurrentNote = async () => {
    if (isSaving.current) return;
    const trimmedText = text.trim();
    if (trimmedText.length === 0) return;
    isSaving.current = true;
    try {
      let noteId = currentNoteIdRef.current;
      if (!noteId) {
        noteId = Date.now().toString();
        currentNoteIdRef.current = noteId;
        setCurrentNoteId(noteId);
      }
      const newNote = {
        id: noteId, title, content: trimmedText, updatedAt: Date.now(),
        colorFamily: colorFamily || getRandomColorFamily(),
        colorDots: colorDots.map(dot => ({
          id: dot.id, x: dot.x, y: dot.y, color: dot.color, size: dot.size,
          blotShapes: dot.blotShapes || [],
          opacityValue: typeof dot.opacity === 'object' ? (dot.opacity._value || 0.8) : (dot.opacity || 0.8),
        })),
      };
      const storedNotes = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
      let currentNotes = storedNotes ? JSON.parse(storedNotes) : [];
      const existingIndex = currentNotes.findIndex(n => n.id === noteId);
      if (existingIndex >= 0) currentNotes[existingIndex] = newNote;
      else currentNotes.unshift(newNote);
      currentNotes.sort((a, b) => b.updatedAt - a.updatedAt);
      await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(currentNotes));
      setNotes(currentNotes);
    } catch (e) { console.error('Failed to save note', e); }
    finally { isSaving.current = false; }
  };

  // ─── Delete note ───────────────────────────────────────────────────────────
  const deleteNote = async (id) => {
    try {
      const storedNotes = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
      if (storedNotes) {
        let currentNotes = JSON.parse(storedNotes).filter(n => n.id !== id);
        await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(currentNotes));
        setNotes(currentNotes);
        // If we deleted the currently-open note, reset editor
        if (id === currentNoteIdRef.current) {
          setText('');
          setTitle('New Note');
          setCurrentNoteId(null);
          currentNoteIdRef.current = null;
          setLastTitleGenLength(0);
          setCurrentDate(new Date());
          setColorDots([]);
          setColorFamily(getRandomColorFamily());
        }
      }
    } catch (e) { console.error('Failed to delete note', e); }
  };
  // ──────────────────────────────────────────────────────────────────────────

  const showSavedNotesView = async () => {
    Keyboard.dismiss();
    await saveCurrentNote();
    await loadNotes();
    setShowingSavedNotes(true);
    Animated.timing(slideAnim, { toValue: 1, duration: 250, useNativeDriver: false }).start();
  };

  const hideSavedNotesView = () => {
    Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: false }).start(() => setShowingSavedNotes(false));
  };

  const openNote = (note) => {
    const savedDots = note.colorDots || [];
    const family = note.colorFamily || 'burntOrange';
    const familyColors = colorFamilies[family] || colorFamilies.burntOrange;
    const restoredDots = savedDots.map(dot => {
      let blotShapes = dot.blotShapes;
      if (!blotShapes || blotShapes.length === 0) {
        blotShapes = Array.from({ length: 5 + Math.floor(Math.random() * 4) }, () => ({
          offsetX: (Math.random() - 0.5) * dot.size * 0.7,
          offsetY: (Math.random() - 0.5) * dot.size * 0.7,
          scale: 0.25 + Math.random() * 0.75,
          opacity: 0.15 + Math.random() * 0.35,
          rotation: Math.random() * 360,
          scaleX: 0.6 + Math.random() * 0.8,
          scaleY: 0.6 + Math.random() * 0.8,
          color: Math.random() > 0.4 ? dot.color : familyColors[Math.floor(Math.random() * familyColors.length)],
        }));
      }
      return { ...dot, blotShapes, opacity: new Animated.Value(dot.opacityValue || 0.1) };
    });
    setColorDots(restoredDots);
    setColorFamily(note.colorFamily || null);
    setText(note.content);
    setTitle(note.title);
    setCurrentNoteId(note.id);
    currentNoteIdRef.current = note.id;
    setLastTitleGenLength(0);
    setCurrentDate(new Date(note.updatedAt));
    hideSavedNotesView();
  };

  const createNewNote = async () => {
    await saveCurrentNote();
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

  const clearAllNotes = async () => {
    try {
      await AsyncStorage.removeItem(NOTES_STORAGE_KEY);
      setNotes([]);
      setText('');
      setTitle('New Note');
      setCurrentNoteId(null);
      currentNoteIdRef.current = null;
      Alert.alert('Done', 'All notes cleared');
    } catch (e) { console.error('Failed to clear notes', e); }
  };

  useEffect(() => {
    loadSettings();
    loadNotes();
    setCurrentDate(new Date());
    setColorFamily(getRandomColorFamily());
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (llmStatus === 'connected' && text.length > 20 && Math.abs(text.length - lastTitleGenLength) > 50) generateTitle();
    }, 3000);
    return () => clearTimeout(timeout);
  }, [text, llmStatus, lastTitleGenLength]);

  const generateTitle = async () => {
    if (!apiKey) return;
    try {
      const data = await makeApiCall('/chat/completions', {
        model: 'claude-haiku-4-5',
        messages: [
          { role: 'system', content: "You are a helpful assistant. Summarize the user's text into a short, concise title (3-5 words max). Do not use quotes. IMPORTANT: The title MUST be in the same language as the user's text." },
          { role: 'user', content: text.slice(0, 1000) }
        ],
        temperature: 0.3,
        max_tokens: 10,
      }, apiKey);
      if (data.content && data.content[0]) {
        const newTitle = data.content[0].text.trim().replace(/^["']|["']$/g, '');
        if (newTitle && newTitle !== title) {
          setLastTitleGenLength(text.length);
          await streamDelete(setTitle, title, { speed: 20 });
          await streamSingleFill(setTitle, '', newTitle, '', { speed: 40 });
        }
      }
    } catch (error) { console.error('Title generation error:', error); }
  };

  const loadSettings = async () => {
    try {
      if (isProxyMode()) { validateProxyConnection(); return; }
      const storedKey = await AsyncStorage.getItem(STORAGE_KEY_API);
      if (storedKey) { setApiKey(storedKey); validateConnection(storedKey); }
    } catch (e) { console.error('Failed to load settings', e); }
  };

  const validateProxyConnection = async () => {
    setLlmStatus('connecting');
    try {
      const response = await fetch(`${getApiBaseUrl()}/validate`);
      if (response.ok) {
        const data = await response.json();
        if (data.valid) { setApiKey('proxy'); setLlmStatus('connected'); }
        else setLlmStatus('error');
      } else setLlmStatus('error');
    } catch { setLlmStatus('error'); }
  };

  const validateConnection = async (key) => {
    setLlmStatus('connecting');
    try {
      const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { 'Authorization': `Bearer ${key}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.data) setLlmStatus('connected');
        else setLlmStatus('error');
      } else setLlmStatus('error');
    } catch { setLlmStatus('error'); }
  };

  const saveApiKey = async (keyToSave) => {
    const key = typeof keyToSave === 'string' ? keyToSave : tempKey;
    try {
      await AsyncStorage.setItem(STORAGE_KEY_API, key);
      setApiKey(key);
      setShowKeyModal(false);
      validateConnection(key);
    } catch { Alert.alert('Error', 'Could not save API key'); }
  };

  const handleConnectPress = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt('Enter OpenRouter API Key', null,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Save & Connect', onPress: (key) => saveApiKey(key) }],
        'secure-text', apiKey);
    } else setShowKeyModal(true);
  };

  const resetApp = async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_API);
      setApiKey(''); setTempKey(''); setLlmStatus('disconnected');
      setText(''); setTitle('New Note'); setLastTitleGenLength(0);
      setDebugData({ sentMessages: null, rawResponse: null });
      Alert.alert('Reset', 'App state and settings cleared.');
    } catch { Alert.alert('Error', 'Could not reset app'); }
  };

  const handleTextChange = (newText) => {
    const doubleMatch = newText.match(/(?<!:)\/\//);
    if (doubleMatch) {
      const index = doubleMatch.index;
      const prefix = newText.slice(0, index);
      const suffix = newText.slice(index + 2);
      if (prefix.trim() === '') {
        if (llmStatus !== 'connected') { Alert.alert('LLM API Not Connected', 'Tap the Cloud button to connect.'); setText(prefix + '//' + suffix); return; }
        const message = 'Boing boing!';
        streamSingleFill(setText, '', message, '', { speed: 50 }).then(() => {
          setTimeout(() => { streamDelete(setText, message, { speed: 30 }); }, 250);
        });
        return;
      }
      const fullText = prefix + suffix;
      const slashPositions = findAllSlashPlaceholders(fullText);
      const allFillPositions = [...slashPositions, prefix.length].sort((a, b) => a - b);
      triggerBatchFill(fullText, allFillPositions);
    } else {
      setText(newText);
    }
  };

  const findAllSlashPlaceholders = (text) => {
    const positions = [];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '/') {
        const prevChar = i > 0 ? text[i - 1] : ' ';
        const nextChar = i < text.length - 1 ? text[i + 1] : ' ';
        if (prevChar !== ':' && prevChar !== '/' && nextChar !== '/') {
          if (prevChar === ' ' || prevChar === '\n' || prevChar === '\t' || i === 0) positions.push(i);
        }
      }
    }
    return positions;
  };

  const triggerBatchFill = async (fullText, fillPositions) => {
    if (llmStatus !== 'connected') {
      Alert.alert('LLM API Not Connected', 'Tap the Cloud button to connect.');
      setText(fullText);
      return;
    }
    let markedText = '';
    let lastPos = 0;
    for (let i = 0; i < fillPositions.length; i++) {
      markedText += fullText.slice(lastPos, fillPositions[i]) + `[FILL_${i + 1}]`;
      lastPos = fillPositions[i] + 1;
    }
    markedText += fullText.slice(lastPos);

    let baseText = '';
    lastPos = 0;
    const animPositions = [];
    for (let i = 0; i < fillPositions.length; i++) {
      baseText += fullText.slice(lastPos, fillPositions[i]);
      animPositions.push(baseText.length);
      lastPos = fillPositions[i] + 1;
    }
    baseText += fullText.slice(lastPos);

    setThinkingBaseText(baseText);
    setThinkingPositions(animPositions);
    setIsThinking(true);

    const today = new Date().toDateString();
    const startTime = Date.now();

    try {
      const data = await makeApiCall('/chat/completions', {
        model: 'claude-haiku-4-5',
        messages: [
          { role: 'system', content: BATCH_FILL_PROMPT + `\nToday's date is ${today}.` },
          { role: 'user', content: markedText }
        ],
        temperature: 0.1,
        max_tokens: 256,
      }, apiKey);

      const latencyMs = Date.now() - startTime;
      setIsThinking(false);
      setThinkingPositions([]);
      setThinkingBaseText('');

      // Handle both OpenRouter and Anthropic API response shapes
      let rawContent = '';
      if (data.choices && data.choices.length > 0) {
        rawContent = coerceMessageContent(data.choices[0].message.content);
      } else if (data.content && data.content.length > 0) {
        rawContent = data.content[0].text || '';
      }

      if (rawContent) {
        let answers = [];
        try {
          const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
          if (jsonMatch) answers = JSON.parse(jsonMatch[0]);
        } catch {
          answers = rawContent.split(/[,\n]/).map(s => s.replace(/["'\[\]]/g, '').trim()).filter(Boolean);
        }
        while (answers.length < fillPositions.length) answers.push('');
        answers = answers.map(a => sanitizeModelContent(String(a)));
        const tokensUsed = data.usage?.output_tokens || data.usage?.completion_tokens || rawContent.length / 4;
        addColorDot(latencyMs, tokensUsed);
        await animateBatchFills(baseText, animPositions, answers);
      } else {
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

  const animateBatchFills = async (baseText, positions, answers) => {
    let currentText = baseText;
    let cumulativeOffset = 0;
    for (let i = 0; i < positions.length; i++) {
      const answer = answers[i];
      if (!answer) continue;
      const insertPos = positions[i] + cumulativeOffset;
      const rawBefore = currentText.slice(0, insertPos);
      const rawAfter = currentText.slice(insertPos);
      const trimmedBefore = rawBefore.replace(/\s+$/, '');
      const trimmedAfter = rawAfter.replace(/^\s+/, '');
      let spacedAnswer = answer.trim();
      if (trimmedBefore.length > 0 && !/[\n([{]$/.test(trimmedBefore)) spacedAnswer = ' ' + spacedAnswer;
      if (trimmedAfter.length > 0 && !/^[\n.,!?;:'"\-—–)\]}]/.test(trimmedAfter)) spacedAnswer = spacedAnswer + ' ';
      await streamSingleFill(setText, trimmedBefore, spacedAnswer, trimmedAfter, { speed: 30 });
      currentText = trimmedBefore + spacedAnswer + trimmedAfter;
      cumulativeOffset = currentText.length - baseText.length;
    }
    return currentText;
  };

  const savedNotes = notes;

  const savedNotesOpacity = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const editorOpacity = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });

  const getGradientColors = () => {
    switch (theme) {
      case 'light': return { start: ['#E8E8ED','#D8D8DD','#E8E8ED'], end: ['#D8D8DD','#E8E8ED','#D8D8DD'] };
      case 'dark': return { start: ['#000000','#0a0a0a','#000000'], end: ['#0a0a0a','#000000','#0a0a0a'] };
      default: return { start: ['#E8E8ED','#E8E8ED','#E8E8ED'], end: ['#E8E8ED','#E8E8ED','#E8E8ED'] };
    }
  };
  const gradientColors = getGradientColors();

  return (
    <View style={[styles.container, { backgroundColor: Colors[theme].background }]}>
      <Animated.View style={[StyleSheet.absoluteFill]} pointerEvents="none">
        <LinearGradient colors={gradientColors.start} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      
      <View style={[StyleSheet.absoluteFill]} pointerEvents="none">
        {colorDots.map(dot => (
          <Animated.View key={dot.id} style={{ position: 'absolute', left: dot.x, top: dot.y, opacity: dot.opacity, transform: [{ scale: dot.scale || 1 }, { translateX: dot.translateX || 0 }, { translateY: dot.translateY || 0 }] }}>
            {(dot.blotShapes || []).map((shape, i) => (
              <View key={i} style={{ position: 'absolute', left: shape.offsetX - (dot.size * shape.scale) / 2, top: shape.offsetY - (dot.size * shape.scale) / 2, width: dot.size * shape.scale, height: dot.size * shape.scale, borderRadius: (dot.size * shape.scale) / 2, backgroundColor: shape.color || dot.color, opacity: shape.opacity, transform: [{ rotate: `${shape.rotation}deg` }, { scaleX: shape.scaleX }, { scaleY: shape.scaleY }] }} />
            ))}
          </Animated.View>
        ))}
      </View>
      
      <BlurView intensity={100} tint={theme === 'light' ? 'light' : 'dark'} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <BlurView intensity={60} tint={theme === 'light' ? 'light' : 'dark'} style={StyleSheet.absoluteFill} pointerEvents="none" />
      
      <SafeAreaView style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, opacity: editorOpacity }}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={{ flex: 1 }}>
              <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
              <Animated.View style={{ position: 'absolute', top: 0, right: 0, left: 0, zIndex: 100 }} pointerEvents="none">
                <Animated.View style={{ position: 'absolute', top: -50, left: 0, right: 0, height: 190, opacity: scrollY.interpolate({ inputRange: [0, 80, 140], outputRange: [0, 0.3, 1], extrapolate: 'clamp' }) }}>
                  {[130,140,150,160,170,180,190].map((h, i) => (
                    <BlurView key={i} intensity={[30,25,20,15,10,5,2][i]} tint={theme === 'light' ? 'light' : 'dark'} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: h }} />
                  ))}
                </Animated.View>
                <Animated.Text numberOfLines={2} style={{ color: Colors[theme].text, paddingHorizontal: 24, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif', paddingTop: scrollY.interpolate({ inputRange: [0, 120], outputRange: [140, 54], extrapolate: 'clamp' }), paddingBottom: 4, fontSize: scrollY.interpolate({ inputRange: [0, 120], outputRange: [42, 17], extrapolate: 'clamp' }), fontWeight: '400', letterSpacing: -0.5 }}>
                  {title}
                </Animated.Text>
                <Animated.Text style={{ paddingHorizontal: 24, fontSize: 12, color: theme === 'light' ? '#687076' : '#9BA1A6', fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif', marginBottom: 16, opacity: scrollY.interpolate({ inputRange: [0, 60, 100], outputRange: [1, 0.3, 0], extrapolate: 'clamp' }) }}>
                  {currentDate.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </Animated.Text>
              </Animated.View>
              <ScrollView ref={scrollViewRef} style={styles.editorWrapper} contentContainerStyle={{ flexGrow: 1, paddingTop: 280, paddingBottom: 300 }} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true} onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })} scrollEventThrottle={16}>
                <TextInput style={[styles.editor, { minHeight: '100%', color: Colors[theme].text, marginTop: 16 }]} multiline scrollEnabled={false} value={text} onChangeText={handleTextChange} placeholder="Type / for blanks, // to fill them" placeholderTextColor="#9ca3af" textAlignVertical="top" />
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* ── Saved Notes Overlay ── */}
        <Animated.View
          style={[savedNotesOverlayStyles.container, { opacity: savedNotesOpacity, backgroundColor: theme === 'light' ? 'rgba(255,255,255,0.3)' : 'rgba(21,23,24,0.3)' }]}
          pointerEvents={showingSavedNotes ? 'auto' : 'none'}
        >
          <BlurView intensity={25} tint={theme === 'light' ? 'light' : 'dark'} style={StyleSheet.absoluteFill} />
          <SafeAreaView style={{ flex: 1 }}>
            <View style={{ position: 'absolute', top: 0, right: 0, left: 0, zIndex: 100 }} pointerEvents="box-none">
              <View style={{ position: 'absolute', top: -50, left: 0, right: 0, height: 190 }}>
                {[130,140,150,160,170,180,190].map((h, i) => (
                  <BlurView key={i} intensity={[30,25,20,15,10,5,2][i]} tint={theme === 'light' ? 'light' : 'dark'} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: h }} />
                ))}
              </View>
              <TouchableOpacity onPress={handleNotesTitleTap} activeOpacity={0.7} style={{ paddingHorizontal: 20, paddingTop: 100, paddingBottom: 4 }}>
                <Text style={{ color: Colors[theme].text, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif', fontSize: 22, fontWeight: '400', letterSpacing: 0.5 }}>
                  {notesPageTitle}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={savedNotesOverlayStyles.notesList} contentContainerStyle={[savedNotesOverlayStyles.notesListContent, { paddingTop: 146 }]}>
              {savedNotes.length === 0 ? (
                <View style={savedNotesOverlayStyles.emptyState}>
                  <Text style={{ color: theme === 'light' ? '#999' : '#8E8E93', fontSize: 16 }}>No saved notes yet</Text>
                </View>
              ) : (
                savedNotes.slice(0, 50).map(note => (
                  <SwipeableNoteRow
                    key={note.id}
                    note={note}
                    theme={theme}
                    onPress={openNote}
                    onDelete={deleteNote}
                  />
                ))
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
        <Modal visible={showKeyModal} transparent animationType="slide" onRequestClose={() => setShowKeyModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Enter OpenRouter API Key</Text>
              <TextInput style={styles.modalInput} value={tempKey} onChangeText={setTempKey} placeholder="sk-or-..." autoCapitalize="none" secureTextEntry />
              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowKeyModal(false)}><Text style={styles.buttonText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={saveApiKey}><Text style={[styles.buttonText, { color: '#fff' }]}>Save & Connect</Text></TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

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

const savedNotesOverlayStyles = StyleSheet.create({
  container: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100 },
  notesList: { flex: 1, paddingHorizontal: 0 },
  notesListContent: { paddingBottom: 100 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 50 },
});