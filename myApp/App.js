import { StatusBar } from 'expo-status-bar';
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SYSTEM_PROMPT } from './constants/prompts';
import { Colors } from './constants/theme';
import { styles } from './styles';
import { streamSingleFill, streamResponse, streamDelete } from './utils/animations';
import FloatingMenu from './components/FloatingMenu';


const STORAGE_KEY_API = 'llm_api_key';

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

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Load API Key on mount
  useEffect(() => {
    loadSettings();
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);
    return () => clearInterval(timer);
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

  const saveApiKey = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_API, tempKey);
      setApiKey(tempKey);
      setShowKeyModal(false);
      validateConnection(tempKey);
    } catch (e) {
      Alert.alert('Error', 'Could not save API key');
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

  return (
    <View style={[styles.container, { backgroundColor: Colors[theme].background }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={{ flex: 1 }}>
            <StatusBar style={(theme === 'dark' || theme === 'ultramarine' || theme === 'orange' || theme === 'plum') ? 'light' : 'dark'} />
            
            {/* Navigation Pills */}
            <View style={styles.navContainer}>
              <View style={[styles.navPill, { backgroundColor: '#000000' }]}>
                <Text style={[styles.navPillText, { color: '#FFFFFF' }]}>Note Taker</Text>
              </View>
            </View>

            {/* Header */}
            <Text style={[styles.headerTitle, { color: Colors[theme].text, marginBottom: 4 }]}>{title}</Text>
            <Text style={{ 
              paddingHorizontal: 24, 
              fontSize: 12, 
              color: theme === 'light' ? '#687076' : '#9BA1A6',
              marginBottom: 16,
              fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif'
            }}>
              {currentDate.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
            </Text>

            {/* Editor */}
            <ScrollView 
              style={styles.editorWrapper}
              contentContainerStyle={{ flexGrow: 1 }}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                style={[styles.editor, { minHeight: '100%', color: Colors[theme].text }]}
                multiline
                scrollEnabled={false}
                value={text}
                onChangeText={handleTextChange}
                placeholder="Type / for blanks, // to fill them"
                placeholderTextColor="#9ca3af"
                textAlignVertical="top"
              />
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>

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

        {/* Debug Overlay */}
        {debugMode && (
          <TouchableOpacity 
            style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 10 }} 
            activeOpacity={1} 
            onPress={() => setDebugMode(false)} 
          />
        )}

        {/* Debug Panel */}
        {debugMode && (
          <View style={styles.debugPanel}>
            <View style={styles.debugActions}>
              <TouchableOpacity style={styles.resetButton} onPress={resetApp}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.debugScroll}>
              <Text style={styles.debugLabel}>Sent to Model:</Text>
              <Text style={styles.debugText} selectable>
                {debugData.sentMessages ? JSON.stringify(debugData.sentMessages, null, 2) : 'No request yet'}
              </Text>
              <Text style={[styles.debugLabel, { marginTop: 12 }]}>Raw Response:</Text>
              <Text style={styles.debugText} selectable>
                {debugData.rawResponse ? JSON.stringify(debugData.rawResponse, null, 2) : 'No response yet'}
              </Text>
            </ScrollView>
          </View>
        )}

        <FloatingMenu 
          debugMode={debugMode}
          toggleDebug={() => setDebugMode(!debugMode)}
          llmStatus={llmStatus}
          onConnectPress={() => setShowKeyModal(true)}
          theme={theme}
          setTheme={setTheme}
          toggleTheme={toggleTheme}
        />

      </SafeAreaView>
    </View>
  );
}
