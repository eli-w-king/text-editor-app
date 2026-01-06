// Animation utilities for text streaming effects

/**
 * Stream a single fill with character-by-character animation
 * @param {Function} setText - State setter for the text
 * @param {string} before - Text before the insertion point
 * @param {string} content - Content to stream in
 * @param {string} after - Text after the insertion point
 * @param {Object} options - Animation options
 * @returns {Promise} Resolves when animation completes
 */
export const streamSingleFill = (setText, before, content, after, options = {}) => {
  const { chunkSize = 1, speed = 40 } = options;
  
  return new Promise((resolve) => {
    const marker = '\u200B'; // Zero-width space
    let i = 0;

    const interval = setInterval(() => {
      if (i >= content.length) {
        clearInterval(interval);
        setText(before + content + after);
        resolve();
        return;
      }

      const partial = content.slice(0, i + chunkSize);
      setText(before + partial + marker + after);
      i += chunkSize;
    }, speed);
  });
};

/**
 * Stream multiple fills simultaneously - all placeholders animate at once
 * @param {Function} setText - State setter for the text
 * @param {Array<{before: string, content: string, after: string}>} segments - Ordered segments with fills
 * @param {Object} options - Animation options
 * @returns {Promise} Resolves when animation completes
 */
export const streamParallelFills = (setText, segments, options = {}) => {
  const { chunkSize = 1, speed = 40 } = options;
  
  return new Promise((resolve) => {
    // Track progress for each content piece
    const progress = segments.map(() => 0);
    const maxLength = Math.max(...segments.map(s => s.content.length));
    
    if (maxLength === 0) {
      // No content to stream, just join segments
      const finalText = segments.map((s, i) => 
        (i === 0 ? s.before : '') + s.content + (i === segments.length - 1 ? s.after : '')
      ).join('');
      setText(finalText);
      resolve();
      return;
    }

    const marker = '\u200B'; // Zero-width space as cursor marker

    const interval = setInterval(() => {
      // Check if all segments are complete
      const allDone = progress.every((p, i) => p >= segments[i].content.length);
      
      if (allDone) {
        clearInterval(interval);
        // Build final text without markers
        let finalText = '';
        for (let i = 0; i < segments.length; i++) {
          if (i === 0) finalText += segments[i].before;
          finalText += segments[i].content;
          if (i < segments.length - 1) {
            // Add inter-segment text (the "after" of current becomes visible)
            finalText += segments[i].after;
          } else {
            finalText += segments[i].after;
          }
        }
        setText(finalText);
        resolve();
        return;
      }

      // Build current text with all partial contents + markers
      let currentText = '';
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (i === 0) currentText += seg.before;
        
        const partial = seg.content.slice(0, progress[i] + chunkSize);
        const stillStreaming = progress[i] < seg.content.length;
        
        currentText += partial;
        if (stillStreaming) currentText += marker;
        
        // Add inter-segment separator or final after
        if (i < segments.length - 1) {
          currentText += seg.after;
        } else {
          currentText += seg.after;
        }
        
        // Advance progress
        if (progress[i] < seg.content.length) {
          progress[i] = Math.min(progress[i] + chunkSize, seg.content.length);
        }
      }
      
      // Remove markers for cleaner display
      setText(currentText.replace(new RegExp(marker, 'g'), ''));
    }, speed);
  });
};

/**
 * Stream response with placeholder replacement
 * @param {Function} setText - State setter for the text
 * @param {string} fullContent - Full content to stream
 * @param {string} placeholderToReplace - Placeholder character to replace
 * @param {Object} options - Animation options
 */
export const streamResponse = (setText, fullContent, placeholderToReplace, options = {}) => {
  const { chunkSize = 1, speed = 50 } = options;
  const marker = '\u200B'; // Zero-width space
  
  setText(prev => prev.replace(placeholderToReplace, marker));

  let i = 0;

  const interval = setInterval(() => {
    if (i >= fullContent.length) {
      clearInterval(interval);
      // Remove marker at the end
      setText(prev => prev.replace(marker, ''));
      return;
    }

    const chunk = fullContent.slice(i, i + chunkSize);
    
    setText(prev => {
      const markerIndex = prev.indexOf(marker);
      if (markerIndex === -1) {
        return prev;
      }

      let before = prev.slice(0, markerIndex);
      const after = prev.slice(markerIndex + marker.length);

      // Remove trailing space before punctuation
      if (/^[,.;!?]/.test(chunk)) {
        before = before.replace(/[ \t]+$/g, '');
      }

      return before + chunk + marker + after;
    });

    i += chunkSize;
  }, speed);
};

/**
 * Stream deletion of text from the end
 * @param {Function} setText - State setter for the text
 * @param {string} text - The text to delete
 * @param {Object} options - Animation options
 * @returns {Promise} Resolves when animation completes
 */
export const streamDelete = (setText, text, options = {}) => {
  const { chunkSize = 1, speed = 30 } = options;
  
  return new Promise((resolve) => {
    let currentLength = text.length;

    const interval = setInterval(() => {
      if (currentLength <= 0) {
        clearInterval(interval);
        setText('');
        resolve();
        return;
      }

      currentLength -= chunkSize;
      setText(text.slice(0, currentLength));
    }, speed);
  });
};
