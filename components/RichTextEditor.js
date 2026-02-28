/**
 * RichTextEditor.js
 *
 * A minimal rich text editor component built on react-native-pell-rich-editor.
 * Renders a transparent, full-height editor that integrates with the app's
 * frosted glass aesthetic. Does NOT include a toolbar -- use FormattingToolbar
 * alongside this component to provide formatting controls.
 *
 * Dependencies:
 *   - react-native-pell-rich-editor (RichEditor component)
 *   - react-native (View, StyleSheet)
 *
 * Props:
 *   initialContent  - HTML string to populate the editor on mount. Once set,
 *                      subsequent changes to this prop are ignored by the
 *                      underlying RichEditor (uncontrolled pattern).
 *   onContentChange - Callback fired on every edit with the current HTML string.
 *                      The parent is responsible for debouncing or auto-saving.
 *   theme           - 'light' | 'dark'. Controls text color, placeholder color,
 *                      caret color, and inline-style tints. Defaults to 'light'.
 *   placeholder     - Placeholder text shown when the editor is empty.
 *                      Defaults to 'Start writing...'.
 *   onFocus         - Optional callback fired when the editor gains focus.
 *   onBlur          - Optional callback fired when the editor loses focus.
 *
 * Ref:
 *   Forwards a ref to the underlying RichEditor instance, exposing methods
 *   like sendAction(), insertLink(), insertHTML(), getContentHtml(), etc.
 *   FormattingToolbar expects this ref to dispatch formatting commands.
 *
 * Usage:
 *   const editorRef = useRef(null);
 *   <RichTextEditor
 *     ref={editorRef}
 *     initialContent={note.content}
 *     onContentChange={handleChange}
 *     theme={theme}
 *   />
 *   <FormattingToolbar editorRef={editorRef} theme={theme} visible={focused} />
 */

import React, { forwardRef, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { RichEditor } from 'react-native-pell-rich-editor';

const RichTextEditor = forwardRef(({ initialContent, onContentChange, theme, placeholder, onFocus, onBlur }, ref) => {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#ECEDEE' : '#1C1C1E';
  const placeholderColor = isDark ? '#636366' : '#9ca3af';

  /**
   * CSS injected into the RichEditor's WebView to style the editing surface.
   * Uses system fonts, transparent background, and theme-aware colors.
   * Memoized to avoid re-injecting on every render.
   */
  const editorCSS = useMemo(() => `
    body { 
      font-family: -apple-system, system-ui, sans-serif; 
      font-size: 18px; 
      line-height: 28px; 
      padding: 0 24px;
      color: ${textColor};
      background: transparent;
      -webkit-user-select: text;
      caret-color: ${textColor};
    }
    a { color: #0a7ea4; }
    code { 
      background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'};
      padding: 2px 6px;
      border-radius: 4px;
      font-family: ui-monospace, Menlo, monospace;
      font-size: 15px;
    }
    pre { 
      background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'};
      padding: 12px 16px;
      border-radius: 8px;
      overflow-x: auto;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 3px solid ${isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'};
      margin-left: 0;
      padding-left: 16px;
      color: ${isDark ? '#9BA1A6' : '#636366'};
    }
    h1 { font-size: 28px; font-weight: 600; margin: 16px 0 8px; }
    h2 { font-size: 22px; font-weight: 600; margin: 14px 0 6px; }
    h3 { font-size: 18px; font-weight: 600; margin: 12px 0 4px; }
    ul, ol { padding-left: 24px; }
    img { max-width: 100%; border-radius: 12px; margin: 12px 0; }
  `, [isDark, textColor]);

  /** Forward content changes to parent without managing internal state. */
  const handleChange = useCallback((html) => {
    if (onContentChange) {
      onContentChange(html);
    }
  }, [onContentChange]);

  /** Notify parent when the editor gains focus. */
  const handleFocus = useCallback(() => {
    if (onFocus) {
      onFocus();
    }
  }, [onFocus]);

  /** Notify parent when the editor loses focus. */
  const handleBlur = useCallback(() => {
    if (onBlur) {
      onBlur();
    }
  }, [onBlur]);

  return (
    <View style={styles.container}>
      <RichEditor
        ref={ref}
        style={styles.editor}
        editorStyle={{
          backgroundColor: 'transparent',
          color: textColor,
          placeholderColor: placeholderColor,
          contentCSSText: editorCSS,
          caretColor: textColor,
        }}
        initialContentHTML={initialContent || ''}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder || 'Start writing...'}
        useContainer={false}
        initialFocus={false}
        pasteAsPlainText={false}
        autoCorrect={true}
      />
    </View>
  );
});

RichTextEditor.displayName = 'RichTextEditor';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  editor: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default RichTextEditor;
