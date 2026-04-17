import { llmClient } from "../llm/hybridClient";

interface CompanyOption {
    id: string;
    name: string;
    industry: string;
    country: string;
    revenue: string;
    employees: number;
    confidence: number; // 0-1 (how likely this is what user meant)
    description: string;
}

class CompanyDisambiguator {
    async search(companyName: string, apiKeys?: any): Promise<CompanyOption[]> {
        console.log(`[Disambiguator] Searching for: "${companyName}"`);

        // Use Groq to search multiple sources and rank by likelihood
        const systemPrompt = `
You are a company research expert.
Given a company name, find ALL possible companies that match and rank them by likelihood.

Return ONLY valid JSON with this structure:
{
  "search_term": "user input",
  "possible_companies": [
    {
      "id": "unique_id",
      "name": "Official company name",
      "industry": "e.g., Technology, Food, Music",
      "country": "country of HQ",
      "revenue": "$X billion" or "revenue unknown",
      "employees": number,
      "confidence": 0.95,
      "description": "1-2 sentence description to disambiguate"
    }
  ],
  "disambiguator_note": "If only 1 exact match found, confidence will be 1.0. If multiple, provide all."
}
    `.trim();

        const userPrompt = `
Search for all companies named or known as: "${companyName}"

Look for:
1. Exact name matches
2. Common abbreviations (e.g., "AAPL" = Apple Inc)
3. Different spellings
4. Companies that go by this name informally

For each match:
- Official registered name
- Industry
- Country of headquarters
- Approximate revenue
- Employee count
- Confidence score (how likely this is what user meant)
- Brief description

Rank by confidence (most likely match first).
    `.trim();

        const raw = await llmClient.call({
            systemPrompt,
            userPrompt,
            agentName: "agent3_market", // Use market agent (good at research)
            maxTokens: 2000,
            apiKeys,
        });

        try {
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            const result = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
            return result.possible_companies || [];
        } catch (error) {
            console.error("Parse error:", error);
            return [];
        }
    }

    async askUserForClarification(
        companyName: string,
        options: CompanyOption[]
    ): Promise<string> {
        if (options.length === 0) {
            return `No companies found matching "${companyName}". Could you provide more context?`;
        }

        if (options.length === 1) {
            return `Found exactly one match: ${options[0].name} (${options[0].industry}, ${options[0].country}). Proceeding with research.`;
        }

        // Multiple options - ask user to clarify
        const optionsText = options
            .map(
                (opt, i) =>
                    `${i + 1}. ${opt.name} - ${opt.industry}, ${opt.country} (${opt.revenue}, ~${opt.employees} employees)`
            )
            .join("\n");

        return `Found multiple companies matching "${companyName}". Which one did you mean?\n\n${optionsText}\n\nPlease provide the number (1, 2, 3...) or more context.`;
    }
}

export const companyDisambiguator = new CompanyDisambiguator();
