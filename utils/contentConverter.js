/**
 * contentConverter.js
 *
 * Content conversion utilities for backward compatibility between the legacy
 * plain text note format (used in App.js) and the rich text HTML format
 * (used by the RichTextEditor component).
 *
 * The legacy format uses [IMG||url||alt] inline markers for images and stores
 * everything as flat strings. The new format is standard HTML produced by
 * react-native-pell-rich-editor's RichEditor component.
 *
 * Functions:
 *   isHtmlContent(content)          - Detect whether a string is HTML or plain text.
 *   plainTextToHtml(text)           - Convert plain text (with image markers) to HTML.
 *   htmlToPlainText(html)           - Convert HTML back to plain text (with image markers).
 *   stripImagesFromContent(content) - Remove all images for titles/previews.
 *   escapeHtml(text)                - Escape HTML special characters.
 *   decodeHtmlEntities(text)        - Decode common HTML entities.
 *
 * All functions are safe to call with null, undefined, or non-string input --
 * they return '' (empty string) or false without throwing.
 */

/**
 * Image marker regex matching the [IMG||url||alt] format used in App.js.
 * Captures url in group 1, alt text in group 2.
 * Note: This regex does NOT use the 'g' flag. A global version is created
 * via new RegExp() per function call to avoid stale lastIndex issues.
 * @type {RegExp}
 */
const IMAGE_MARKER_PATTERN = /\[IMG\|\|(.*?)\|\|(.*?)\]/;

/**
 * Image loading placeholder regex matching __IMG_LOADING_<number>__ markers
 * that appear while images are being fetched by the app.
 * @type {RegExp}
 */
const IMAGE_LOADING_PLACEHOLDER_PATTERN = /__IMG_LOADING_\d+__/;

/**
 * Check if content is already HTML.
 * Uses a heuristic: if the string contains common HTML block/inline tags
 * that would not appear in plain text, treat it as HTML.
 *
 * @param {*} content - The content to check. Non-string values return false.
 * @returns {boolean} True if the content appears to be HTML.
 */
export const isHtmlContent = (content) => {
  if (!content || typeof content !== 'string') return false;
  return /<(?:p|div|br|h[1-6]|ul|ol|li|strong|em|a|code|pre|blockquote|img)\b/i.test(content);
};

/**
 * Convert legacy plain text content (with [IMG||url||alt] markers) to HTML.
 * Preserves line breaks as paragraphs and converts image markers to <img> tags.
 *
 * If the input is already HTML (detected by isHtmlContent), it is returned as-is
 * to avoid double-encoding.
 *
 * @param {*} text - Plain text to convert. Non-string values return ''.
 * @returns {string} HTML string with <p> and <img> tags.
 */
export const plainTextToHtml = (text) => {
  if (!text || typeof text !== 'string') return '';

  // If already HTML, return as-is to avoid double-encoding
  if (isHtmlContent(text)) return text;

  const imageMarkerGlobal = new RegExp(IMAGE_MARKER_PATTERN.source, 'g');
  const loadingPlaceholderGlobal = new RegExp(IMAGE_LOADING_PLACEHOLDER_PATTERN.source, 'g');

  let html = '';
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Convert [IMG||url||alt] markers to <img> tags.
    // URL and alt text are escaped to prevent XSS via crafted content.
    line = line.replace(imageMarkerGlobal, (_match, url, alt) => {
      return '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(alt) + '" />';
    });

    // Remove image loading placeholders (transient state, not real content)
    line = line.replace(loadingPlaceholderGlobal, '');

    // Escape HTML entities in non-tag parts of the line.
    // Split on <img> tags to preserve them, and only escape remaining text.
    const parts = line.split(/(<img[^>]*>)/);
    const processedParts = parts.map(part => {
      if (part.startsWith('<img')) return part;
      return escapeHtml(part);
    });
    line = processedParts.join('');

    // Wrap in paragraph tag (empty lines become empty paragraphs for spacing)
    if (line.trim() === '') {
      html += '<p><br></p>';
    } else {
      html += '<p>' + line + '</p>';
    }
  }

  return html;
};

/**
 * Convert HTML content back to plain text.
 * Useful for features that need plain text input (AI triggers, word count,
 * search indexing). Converts <img> tags back to [IMG||url||alt] markers
 * to preserve image references.
 *
 * @param {*} html - HTML string to convert. Non-string values return ''.
 * @returns {string} Plain text with image markers preserved.
 */
export const htmlToPlainText = (html) => {
  if (!html || typeof html !== 'string') return '';

  let text = html;

  // Convert <img> tags back to [IMG||url||alt] markers.
  // Handles both self-closing (<img />) and unclosed (<img>) variants,
  // and both src-first and alt-first attribute orderings.
  text = text.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '[IMG||$1||$2]');
  text = text.replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*\/?>/gi, '[IMG||$2||$1]');

  // Convert block-level closing tags to newlines
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/blockquote>/gi, '\n');

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // Decode HTML entities back to characters
  text = decodeHtmlEntities(text);

  // Collapse 3+ consecutive newlines down to 2 (double newline = paragraph break)
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
};

/**
 * Strip all image references from content for titles and previews.
 * Removes both HTML <img> tags and plain text [IMG||url||alt] markers,
 * as well as loading placeholders. Also strips any remaining HTML tags
 * and decodes entities for clean plain text output.
 *
 * @param {*} content - Content string (HTML or plain text). Non-string values return ''.
 * @returns {string} Clean plain text with no images or HTML.
 */
export const stripImagesFromContent = (content) => {
  if (!content || typeof content !== 'string') return '';

  let text = content;
  // Strip HTML img tags
  text = text.replace(/<img[^>]*>/gi, '');
  // Strip plain text image markers
  text = text.replace(new RegExp(IMAGE_MARKER_PATTERN.source, 'g'), '');
  // Strip image loading placeholders
  text = text.replace(new RegExp(IMAGE_LOADING_PLACEHOLDER_PATTERN.source, 'g'), '');
  // Strip all remaining HTML tags for preview
  text = text.replace(/<[^>]*>/g, '');
  // Decode entities
  text = decodeHtmlEntities(text);
  return text.trim();
};

/**
 * Escape HTML special characters to prevent XSS.
 * Handles the five characters that have special meaning in HTML:
 * & < > " '
 *
 * @param {*} text - String to escape. Non-string values return ''.
 * @returns {string} Escaped string safe for insertion into HTML.
 */
export const escapeHtml = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Decode common HTML entities back to their character equivalents.
 * Handles the standard five named entities plus &nbsp;.
 *
 * @param {*} text - String with HTML entities. Non-string values return ''.
 * @returns {string} String with entities decoded.
 */
export const decodeHtmlEntities = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
};
