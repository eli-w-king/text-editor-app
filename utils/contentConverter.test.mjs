/**
 * Tests for utils/contentConverter.js
 *
 * Run with: node utils/contentConverter.test.mjs
 */

import {
  isHtmlContent,
  plainTextToHtml,
  htmlToPlainText,
  stripImagesFromContent,
  escapeHtml,
  decodeHtmlEntities,
} from './contentConverter.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error('FAIL:', message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error('FAIL:', message);
    console.error('  Expected:', JSON.stringify(expected));
    console.error('  Actual:  ', JSON.stringify(actual));
  }
}

// --- isHtmlContent ---

assert(isHtmlContent('<p>hello</p>'), 'isHtmlContent: detects <p> tag');
assert(isHtmlContent('<div>test</div>'), 'isHtmlContent: detects <div> tag');
assert(isHtmlContent('<br>'), 'isHtmlContent: detects <br> tag');
assert(isHtmlContent('<h1>Title</h1>'), 'isHtmlContent: detects <h1> tag');
assert(isHtmlContent('<img src="x">'), 'isHtmlContent: detects <img> tag');
assert(isHtmlContent('<strong>bold</strong>'), 'isHtmlContent: detects <strong> tag');
assert(isHtmlContent('<em>italic</em>'), 'isHtmlContent: detects <em> tag');
assert(isHtmlContent('<a href="x">link</a>'), 'isHtmlContent: detects <a> tag');
assert(isHtmlContent('<blockquote>quote</blockquote>'), 'isHtmlContent: detects <blockquote>');
assert(!isHtmlContent('Hello world'), 'isHtmlContent: plain text returns false');
assert(!isHtmlContent('2 < 3 and 5 > 1'), 'isHtmlContent: math comparison returns false');
assert(!isHtmlContent(''), 'isHtmlContent: empty string returns false');
assert(!isHtmlContent(null), 'isHtmlContent: null returns false');
assert(!isHtmlContent(undefined), 'isHtmlContent: undefined returns false');
assert(!isHtmlContent(42), 'isHtmlContent: number returns false');
assert(!isHtmlContent('<span>not detected</span>'), 'isHtmlContent: <span> not in detection list');

// --- escapeHtml ---

assertEqual(escapeHtml('Hello & World'), 'Hello &amp; World', 'escapeHtml: escapes ampersand');
assertEqual(escapeHtml('<script>'), '&lt;script&gt;', 'escapeHtml: escapes angle brackets');
assertEqual(escapeHtml('"quotes"'), '&quot;quotes&quot;', 'escapeHtml: escapes double quotes');
assertEqual(escapeHtml("it's"), "it&#039;s", 'escapeHtml: escapes single quotes');
assertEqual(escapeHtml(''), '', 'escapeHtml: empty string');
assertEqual(escapeHtml(null), '', 'escapeHtml: null');
assertEqual(escapeHtml(undefined), '', 'escapeHtml: undefined');
assertEqual(escapeHtml(123), '', 'escapeHtml: number');

// --- decodeHtmlEntities ---

assertEqual(decodeHtmlEntities('&amp;'), '&', 'decodeHtmlEntities: decodes &amp;');
assertEqual(decodeHtmlEntities('&lt;'), '<', 'decodeHtmlEntities: decodes &lt;');
assertEqual(decodeHtmlEntities('&gt;'), '>', 'decodeHtmlEntities: decodes &gt;');
assertEqual(decodeHtmlEntities('&quot;'), '"', 'decodeHtmlEntities: decodes &quot;');
assertEqual(decodeHtmlEntities('&#039;'), "'", 'decodeHtmlEntities: decodes &#039;');
assertEqual(decodeHtmlEntities('&nbsp;'), ' ', 'decodeHtmlEntities: decodes &nbsp;');
assertEqual(decodeHtmlEntities(''), '', 'decodeHtmlEntities: empty string');
assertEqual(decodeHtmlEntities(null), '', 'decodeHtmlEntities: null');

// --- plainTextToHtml ---

assertEqual(plainTextToHtml('Hello'), '<p>Hello</p>', 'plainTextToHtml: simple text');
assertEqual(
  plainTextToHtml('Line 1\nLine 2'),
  '<p>Line 1</p><p>Line 2</p>',
  'plainTextToHtml: newlines become paragraphs'
);
assertEqual(
  plainTextToHtml('Before\n\nAfter'),
  '<p>Before</p><p><br></p><p>After</p>',
  'plainTextToHtml: empty lines become empty paragraphs'
);
assertEqual(plainTextToHtml(''), '', 'plainTextToHtml: empty string');
assertEqual(plainTextToHtml(null), '', 'plainTextToHtml: null');
assertEqual(plainTextToHtml(undefined), '', 'plainTextToHtml: undefined');
assertEqual(plainTextToHtml(42), '', 'plainTextToHtml: number');

// Image marker conversion
const imgResult = plainTextToHtml('See [IMG||https://example.com/img.jpg||A photo] here');
assert(imgResult.includes('<img src="https://example.com/img.jpg"'), 'plainTextToHtml: converts image marker to img tag');
assert(imgResult.includes('alt="A photo"'), 'plainTextToHtml: preserves alt text');
assert(imgResult.startsWith('<p>'), 'plainTextToHtml: wraps in paragraph');

// XSS prevention in image markers
const xssResult = plainTextToHtml('[IMG||" onload="alert(1)||xss]');
assert(!xssResult.includes('"onload'), 'plainTextToHtml: XSS in URL is escaped');

// HTML passthrough
const htmlInput = '<p>Already <strong>HTML</strong></p>';
assertEqual(plainTextToHtml(htmlInput), htmlInput, 'plainTextToHtml: HTML passthrough');

// Loading placeholder removal
const withLoading = 'Text __IMG_LOADING_123__ more';
assert(!plainTextToHtml(withLoading).includes('__IMG_LOADING'), 'plainTextToHtml: removes loading placeholders');

// HTML entity escaping in plain text
const withEntities = 'Tom & Jerry <3';
const entityResult = plainTextToHtml(withEntities);
assert(entityResult.includes('&amp;'), 'plainTextToHtml: escapes ampersand in text');
assert(entityResult.includes('&lt;'), 'plainTextToHtml: escapes angle bracket in text');

// --- htmlToPlainText ---

assertEqual(htmlToPlainText('<p>Hello</p>'), 'Hello', 'htmlToPlainText: strips p tags');
assertEqual(
  htmlToPlainText('<p>Line 1</p><p>Line 2</p>'),
  'Line 1\nLine 2',
  'htmlToPlainText: p tags become newlines'
);
assertEqual(
  htmlToPlainText('<h1>Title</h1><p>Body</p>'),
  'Title\nBody',
  'htmlToPlainText: h1 becomes newline'
);
assertEqual(htmlToPlainText(''), '', 'htmlToPlainText: empty string');
assertEqual(htmlToPlainText(null), '', 'htmlToPlainText: null');
assertEqual(htmlToPlainText(undefined), '', 'htmlToPlainText: undefined');
assertEqual(htmlToPlainText(42), '', 'htmlToPlainText: number');

// Image tag to marker roundtrip
const imgHtml = '<p>See <img src="https://example.com/img.jpg" alt="A photo" /> here</p>';
const imgPlain = htmlToPlainText(imgHtml);
assert(imgPlain.includes('[IMG||https://example.com/img.jpg||A photo]'), 'htmlToPlainText: converts img to marker');

// Multiple newline collapse
assertEqual(
  htmlToPlainText('<p>A</p><p></p><p></p><p></p><p>B</p>'),
  'A\n\nB',
  'htmlToPlainText: collapses multiple newlines'
);

// Entity decoding
assert(htmlToPlainText('<p>Tom &amp; Jerry</p>').includes('Tom & Jerry'), 'htmlToPlainText: decodes entities');

// --- stripImagesFromContent ---

assertEqual(
  stripImagesFromContent('<p>Hello <img src="x" alt="y"> world</p>'),
  'Hello  world',
  'stripImagesFromContent: strips img tags'
);
assertEqual(
  stripImagesFromContent('Hello [IMG||url||alt] world'),
  'Hello  world',
  'stripImagesFromContent: strips image markers'
);
assertEqual(
  stripImagesFromContent('Text __IMG_LOADING_99__ more'),
  'Text  more',
  'stripImagesFromContent: strips loading placeholders'
);
assertEqual(stripImagesFromContent(''), '', 'stripImagesFromContent: empty string');
assertEqual(stripImagesFromContent(null), '', 'stripImagesFromContent: null');
assertEqual(stripImagesFromContent(undefined), '', 'stripImagesFromContent: undefined');
assertEqual(
  stripImagesFromContent('<p>Hello &amp; world</p>'),
  'Hello & world',
  'stripImagesFromContent: decodes entities'
);

// --- Roundtrip tests ---

const originalPlain = 'Hello world\n\nThis is a test.\n[IMG||https://example.com/photo.jpg||Sunset photo]\nEnd.';
const asHtml = plainTextToHtml(originalPlain);
const backToPlain = htmlToPlainText(asHtml);
assert(backToPlain.includes('Hello world'), 'Roundtrip: preserves text');
assert(backToPlain.includes('[IMG||https://example.com/photo.jpg||Sunset photo]'), 'Roundtrip: preserves image markers');
assert(backToPlain.includes('End.'), 'Roundtrip: preserves trailing text');

// --- Results ---

console.log('');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed.');
}
