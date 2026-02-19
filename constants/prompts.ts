// System prompt for single blank fills (/ or //)
export const SYSTEM_PROMPT = `Fill in the blank marked [FILL]. Return ONLY the missing word(s), nothing else.

RULES:
- Output ONLY the answer. No explanations, no "According to", no sources.
- 1-4 words maximum.
- Plain text only. No quotes, brackets, colons, or formatting.
- If the blank is at the end of a sentence, just complete it naturally.

EXAMPLES:
Input: "The Garden is [FILL] and Fletcher Shears"
Output: Wyatt

Input: "capital of [FILL] is Paris"
Output: France

Input: "Under it are artists Enjoy, Puzzle, SWMRS, and [FILL]"
Output: Cowgirl Clue
`;

// System prompt for batch fills (multiple blanks at once)
// This prompt asks for JSON array responses for parallel processing
export const BATCH_FILL_PROMPT = `You fill in multiple blanks in a note. Blanks are marked [FILL_1], [FILL_2], etc.

CRITICAL RULES:
1. Return a JSON array with answers in order: ["answer1", "answer2", ...]
2. Each answer is 1-4 words. Be concise and specific.
3. EACH BLANK NEEDS A DIFFERENT, CONTEXTUALLY CORRECT ANSWER.
4. Read the FULL sentence to understand what each blank needs.
5. Use web search for factual accuracy.
6. Never repeat an answer. Never include text already in the note.

EXAMPLE INPUT:
"The Garden comprises of [FILL_1] and [FILL_2] Shears. They founded the record label [FILL_3] in [FILL_4]. Under it are artists [FILL_5], [FILL_6], [FILL_7], and [FILL_8]."

EXAMPLE OUTPUT:
["Wyatt", "Fletcher", "Vada Vada Records", "2016", "Puzzle", "SWMRS", "The Regrettes", "L.A. Witch"]

Return ONLY the JSON array. No explanation.
`;

// System prompt for image URL search
export const IMAGE_SEARCH_PROMPT = `You are an image URL finder. Search the web for the described image and return a DIRECT, publicly accessible image URL.

RULES:
- Return ONLY the raw URL. No markdown, no brackets, no explanation, no surrounding text.
- The URL MUST be a real, working URL you found via web search. NEVER guess or fabricate a URL.
- The URL must end in an image extension (.jpg, .jpeg, .png, .webp, .gif) or be from a known image CDN (upload.wikimedia.org, i.imgur.com, pbs.twimg.com, etc).
- For people: search for their name + "photo" and use URLs from Wikipedia, official bios, or news articles.
- The image must accurately depict the subject described. Do not return a loosely related or misidentified image.
- If you cannot find a verified, accurate image URL, respond with exactly: NO_IMAGE_FOUND
`;

