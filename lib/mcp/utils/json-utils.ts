// lib/mcp/utils/json-utils.ts

/**
 * Robustly extracts and parses JSON from a string that might contain markdown or extra conversational text.
 * @param text The raw string from the LLM response.
 * @returns The parsed JSON object.
 * @throws Error if no valid JSON object or array is found or if parsing fails.
 */
export function safeParseJSON(text: string): any {
    if (!text) throw new Error("Received empty text for JSON parsing");

    // 1. Remove markdown code blocks if present (```json ... ``` or ``` ...)
    let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    // 2. Find the first '{' or '[' and the last '}' or ']'
    const firstOpenBrace = cleaned.indexOf("{");
    const firstOpenBracket = cleaned.indexOf("[");
    
    // Determine the start point (whichever comes first)
    let start = -1;
    if (firstOpenBrace !== -1 && firstOpenBracket !== -1) {
        start = Math.min(firstOpenBrace, firstOpenBracket);
    } else {
        start = firstOpenBrace !== -1 ? firstOpenBrace : firstOpenBracket;
    }

    const lastCloseBrace = cleaned.lastIndexOf("}");
    const lastCloseBracket = cleaned.lastIndexOf("]");
    
    // Determine the end point (whichever comes last)
    const end = Math.max(lastCloseBrace, lastCloseBracket);

    if (start !== -1 && end !== -1 && end > start) {
        const jsonText = cleaned.substring(start, end + 1);
        try {
            // FIX: Common LLM error - trailing commas in objects/arrays
            // This is a simple regex that finds a comma followed by a closing brace or bracket
            const fixedJsonText = jsonText.replace(/,\s*([}\]])/g, '$1');
            return JSON.parse(fixedJsonText);
        } catch (error) {
            // If regex fix failed, try one last time with the raw substring
            try {
                return JSON.parse(jsonText);
            } catch (e2) {
                console.error("Failed to parse extracted JSON block:", jsonText);
                throw new Error(`JSON extraction valid but parsing failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }

    // Fallback: Just try parsing the whole thing if no braces found
    try {
        return JSON.parse(cleaned);
    } catch (error) {
        throw new Error("No valid JSON structure found in response.");
    }
}
