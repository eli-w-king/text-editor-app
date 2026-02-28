/**
 * Content conversion utilities for backward compatibility
 * Converts between plain text (legacy) and HTML (rich text) formats
 */

// Image marker regex from the main app
const IMAGE_MARKER_REGEX = /\[IMG\|\|(.*?)\|\|(.*?)\]/g;

/**
 * Check if content is already HTML
 * Simple heuristic: if it contains common HTML tags, treat as HTML
 */
export const isHtmlContent = (content) => {
  if (!content || typeof content !== 'string') return false;
  // Check for common HTML tags that wouldn't appear in plain text
  return /<(?:p|div|br|h[1-6]|ul|ol|li|strong|em|a|code|pre|blockquote|img)\b/i.test(content);
};

/**
 * Convert legacy plain text content (with [IMG||url||alt] markers) to HTML
 * Preserves line breaks and image markers
 */
export const plainTextToHtml = (text) => {
  if (!text || typeof text !== 'string') return '';
  
  // If already HTML, return as-is
  if (isHtmlContent(text)) return text;

  let html = '';
  const lines = text.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Process image markers in the line
    line = line.replace(IMAGE_MARKER_REGEX, (match, url, alt) => {
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" />`;
    });
    
    // Remove image loading placeholders
    line = line.replace(/__IMG_LOADING_\d+__/g, '');
    
    // Escape remaining HTML entities in the line (but not the img tags we just created)
    // We need to be careful here - only escape the non-tag parts
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
      html += `<p>${line}</p>`;
    }
  }
  
  return html;
};

/**
 * Convert HTML content back to plain text (for features that need plain text like AI triggers)
 * Strips HTML tags but preserves image markers
 */
export const htmlToPlainText = (html) => {
  if (!html || typeof html !== 'string') return '';
  
  let text = html;
  
  // Convert img tags back to image markers
  text = text.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '[IMG||$1||$2]');
  
  // Convert block elements to newlines
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/blockquote>/gi, '\n');
  
  // Strip all remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  text = decodeHtmlEntities(text);
  
  // Clean up multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();
  
  return text;
};

/**
 * Strip image markers from text (for titles, previews)
 * Works with both plain text markers and HTML img tags
 */
export const stripImagesFromContent = (content) => {
  if (!content) return '';
  let text = content;
  // Strip HTML img tags
  text = text.replace(/<img[^>]*>/gi, '');
  // Strip plain text markers
  text = text.replace(/\[IMG\|\|.*?\|\|.*?\]/g, '');
  text = text.replace(/__IMG_LOADING_\d+__/g, '');
  // Strip HTML tags for preview
  text = text.replace(/<[^>]*>/g, '');
  text = decodeHtmlEntities(text);
  return text.trim();
};

/**
 * Escape HTML special characters
 */
const escapeHtml = (text) => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Decode common HTML entities
 */
const decodeHtmlEntities = (text) => {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
};
