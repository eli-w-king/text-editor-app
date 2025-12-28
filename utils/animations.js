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
