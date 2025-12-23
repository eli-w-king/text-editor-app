import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Text, 
  TextInput, 
  View, 
  ScrollView,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Keyboard,
  Alert,
  BackHandler,
  Dimensions,
  Animated,
  PanResponder,
  NativeSyntheticEvent,
  NativeScrollEvent
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SYSTEM_PROMPT } from '@/constants/prompts';
import { Colors } from '@/constants/theme';
import { styles } from '@/styles';
import { streamSingleFill, streamResponse, streamDelete } from '@/utils/animations';
import { useAppContext } from '@/context/AppContext';
import { useNotes, Note } from '@/hooks/useNotes';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Extracts string content regardless of OpenRouter payload shape (string or array chunks).
const coerceMessageContent = (messageContent: any) => {
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
const sanitizeModelContent = (rawInput: any) => {
  if (typeof rawInput !== 'string') {
    return '';
  }

  let cleaned = rawInput;

  // Remove ALL brackets that look like citations (contain TLDs, URLs, or domain-like text).
  cleaned = cleaned
    .replace(/\s*\[[^\]]*\b\w+\.\s*(?:com?|net|org|io|ai|app|news|tv|fm|uk|us|au|de|fr|jp|co)\b[^\]]*\]/gi, '')
    .replace(/\s*\[[^\]]*(?:https?:\/\/|www\.)[^\]]*\]/gis, '')
    .replace(/\s*\[[0-9]+\]/g, '')
    .replace(/\s*\[\s*\]/g, ''); 

  // Remove ALL parentheses that look like citations.
  cleaned = cleaned
    .replace(/\s*\([^)]*\b\w+\.\s*(?:com?|net|org|io|ai|app|news|tv|fm|uk|us|au|de|fr|jp|co)\b[^)]*\)/gi, '')
    .replace(/\s*\([^)]*(?:https?:\/\/|www\.)[^)]*\)/gis, '')
    .replace(/\s*\((?:source|via|according to|reported by)[^)]*\)/gi, '')
    .replace(/\s*\(\s*\)/g, ''); 

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

export default function NoteEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme, apiKey, llmStatus, setOnNotesPress } = useAppContext();
  const { notes, saveNote, deleteNote, loadNotes } = useNotes();
  
  const [text, setText] = useState('');
  const [title, setTitle] = useState('New Note');
  const [lastTitleGenLength, setLastTitleGenLength] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(id === 'new' ? null : id);
  
  // Scroll-based navigation state
  const scrollViewRef = useRef<ScrollView>(null);
  const [showingSavedNotes, setShowingSavedNotes] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current; // 0 = editor, 1 = saved notes
  
  // Pan responder for swipe gesture on title area
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical swipes
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Swiping up (negative dy) should show saved notes
        if (gestureState.dy < -30 && !showingSavedNotes) {
          // User is swiping up - animate to saved notes
          showSavedNotesView();
        }
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  // Show saved notes with animation
  const showSavedNotesView = async () => {
    Keyboard.dismiss();
    await saveCurrentNote();
    await loadNotes();
    setShowingSavedNotes(true);
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 10,
    }).start();
  };

  // Show editor with animation
  const showEditorView = () => {
    setShowingSavedNotes(false);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 10,
    }).start();
  };

  // Pan responder for saved notes view (swipe down to go back)
  const savedNotesPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > Math.abs(gestureState.dx) && Math.abs(gestureState.dy) > 10;
      },
      onPanResponderMove: (_, gestureState) => {
        // Swiping down (positive dy) should go back to editor
        if (gestureState.dy > 30 && showingSavedNotes) {
          showEditorView();
        }
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  // Register the showSavedNotesView callback with the context
  useEffect(() => {
    setOnNotesPress(() => showSavedNotesView);
    return () => {
      setOnNotesPress(null);
    };
  }, [setOnNotesPress]);

  // Load note
  useEffect(() => {
    if (id && id !== 'new' && notes.length > 0) {
      const note = notes.find(n => n.id === id);
      if (note) {
        setText(note.content);
        setTitle(note.title);
        setCurrentNoteId(id);
      }
    }
    setIsLoaded(true);
  }, [id, notes]);

  // Auto-save logic - only save if there's content
  const saveCurrentNote = useCallback(async () => {
    if (!isLoaded) return;
    
    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      // Don't save empty notes - delete if it was an existing note
      if (currentNoteId) {
        await deleteNote(currentNoteId);
      }
      return;
    }

    const noteId = currentNoteId || Date.now().toString();
    if (!currentNoteId) {
      setCurrentNoteId(noteId);
    }
    
    const newNote: Note = {
      id: noteId,
      title: title,
      content: text,
      updatedAt: Date.now(),
    };
    await saveNote(newNote);
  }, [text, title, currentNoteId, isLoaded, saveNote, deleteNote]);

  // Save on unmount or back
  useEffect(() => {
    const onBackPress = () => {
      saveCurrentNote().then(() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/');
        }
      });
      return true; // Prevent default behavior
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    return () => {
      saveCurrentNote();
      subscription.remove();
    };
  }, [saveCurrentNote, router]);

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

  // Open a saved note
  const openNote = async (note: Note) => {
    // Load the selected note
    setText(note.content);
    setTitle(note.title);
    setCurrentNoteId(note.id);
    setLastTitleGenLength(0);
    
    // Go back to editor view
    showEditorView();
  };

  // Create a new note
  const createNewNote = async () => {
    // Save current note first
    await saveCurrentNote();
    
    // Reset to new note
    setText('');
    setTitle('New Note');
    setCurrentNoteId(null);
    setLastTitleGenLength(0);
    
    // Go back to editor view
    showEditorView();
  };

  // Render saved note item
  const renderSavedNote = (note: Note) => (
    <TouchableOpacity 
      key={note.id}
      style={[savedNotesStyles.noteItem, { backgroundColor: theme === 'dark' ? '#2C2C2E' : '#FFFFFF' }]}
      onPress={() => openNote(note)}
    >
      <Text style={[savedNotesStyles.noteTitle, { color: Colors[theme].text }]} numberOfLines={1}>
        {note.title || 'Untitled Note'}
      </Text>
      <Text style={[savedNotesStyles.notePreview, { color: theme === 'dark' ? '#8E8E93' : '#666' }]} numberOfLines={2}>
        {note.content}
      </Text>
      <Text style={[savedNotesStyles.noteDate, { color: theme === 'dark' ? '#636366' : '#999' }]}>
        {new Date(note.updatedAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );

  const handleTextChange = (newText: string) => {
    // Check for // trigger (batch fill after punctuation/newline, or inline fill mid-sentence)
    const doubleTriggerRegex = /(?<!:)\/\//;
    const doubleMatch = newText.match(doubleTriggerRegex);

    if (doubleMatch) {
       const index = doubleMatch.index!;
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
  const findSingleSlash = (text: string) => {
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
  const triggerBatchFill = async (prefix: string, suffix: string) => {
    if (llmStatus !== 'connected') {
      Alert.alert('Not Connected', 'Tap the status dot to connect OpenRouter.');
      setText(prefix + '//' + suffix);
      return;
    }

    let currentPrefix = prefix;
    let currentSuffix = suffix;

    const processSegment = async (segment: string, otherSegmentContext: string, otherSegmentDisplay: string, isPrefix: boolean) => {
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

  const triggerLLM = async (prefix: string, suffix: string) => {
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

  // Filter out current note from saved notes list (don't show the note being edited)
  const savedNotes = notes.filter(n => n.id !== currentNoteId);

  // Animation interpolations
  const editorTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_HEIGHT],
  });

  const savedNotesTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_HEIGHT, 0],
  });

  return (
    <View style={[styles.container, { backgroundColor: Colors[theme].background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ flex: 1 }}>
        
        {/* ===== SAVED NOTES OVERLAY (slides down from top) ===== */}
        <Animated.View 
          style={[
            savedNotesStyles.savedNotesContainer,
            { 
              backgroundColor: Colors[theme].background,
              transform: [{ translateY: savedNotesTranslateY }],
            }
          ]}
          {...savedNotesPanResponder.panHandlers}
        >
          {/* Header */}
          <View style={savedNotesStyles.header}>
            <Text style={[savedNotesStyles.headerTitle, { color: Colors[theme].text }]}>
              Saved Notes
            </Text>
            <Text style={[savedNotesStyles.headerSubtitle, { color: theme === 'dark' ? '#8E8E93' : '#666' }]}>
              Swipe down or tap to go back
            </Text>
          </View>

          {/* Notes List */}
          <ScrollView 
            style={savedNotesStyles.notesList}
            contentContainerStyle={savedNotesStyles.notesListContent}
            showsVerticalScrollIndicator={true}
          >
            {/* New Note Button */}
            <TouchableOpacity 
              style={[savedNotesStyles.newNoteButton, { borderColor: Colors[theme].text }]}
              onPress={createNewNote}
            >
              <Text style={[savedNotesStyles.newNoteText, { color: Colors[theme].text }]}>+ New Note</Text>
            </TouchableOpacity>

            {savedNotes.length === 0 ? (
              <View style={savedNotesStyles.emptyState}>
                <Text style={[savedNotesStyles.emptyText, { color: theme === 'dark' ? '#8E8E93' : '#999' }]}>
                  No saved notes yet
                </Text>
              </View>
            ) : (
              savedNotes.map(note => renderSavedNote(note))
            )}
          </ScrollView>

          {/* Pull down indicator */}
          <TouchableOpacity style={savedNotesStyles.pullIndicator} onPress={showEditorView}>
            <View style={[savedNotesStyles.pullBar, { backgroundColor: theme === 'dark' ? '#48484A' : '#D1D1D6' }]} />
            <Text style={[savedNotesStyles.pullText, { color: theme === 'dark' ? '#8E8E93' : '#999' }]}>
              ↓ Swipe down to go back
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ===== EDITOR (main view) ===== */}
        <Animated.View 
          style={[
            { flex: 1 },
            { transform: [{ translateY: editorTranslateY }] }
          ]}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={{ flex: 1 }}>
              {/* Header/Title */}
              <Text style={[styles.headerTitle, { color: Colors[theme].text, marginTop: 20 }]}>{title}</Text>

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
        </Animated.View>

      </SafeAreaView>
    </View>
  );
}

// Styles for saved notes section
import { StyleSheet } from 'react-native';

const savedNotesStyles = StyleSheet.create({
  savedNotesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  emptyText: {
    fontSize: 16,
  },
  pullIndicator: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingBottom: 30,
  },
  pullBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  pullText: {
    fontSize: 12,
  },
  pullUpArea: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 10,
  },
});
