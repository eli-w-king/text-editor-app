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

