import { llmClient } from "../llm/hybridClient";

interface ResearchData {
    financial: Record<string, any>;
    hiring: any;
    competitors: any[];
    news: any[];
    social_signals: Record<string, any>;
    timestamp: string;
}

interface ResearchInsight {
    category: string;
    insight: string;
    evidence?: string;
    confidence: "high" | "medium" | "low";
    source_types: string[]; // "financial", "hiring", "news", etc. (NOT raw URLs)
    data_points: number; // How many data points support this
    note: string; // Why this matters
}

class ResearchSynthesizer {
    async synthesizeCompanyData(
        companyName: string,
        rawScrapedData: ResearchData,
        apiKeys?: any
    ): Promise<ResearchInsight[]> {
        console.log(`[Synthesizer] Analyzing data for: ${companyName}`);

        // CRITICAL: Don't expose raw scraped data to user
        // Instead, use LLM to extract insights and patterns

        const systemPrompt = `
You are a business intelligence analyst.
You will receive raw company research data (financial, hiring, news, social signals).

Your job:
1. Extract KEY INSIGHTS from the data
2. Hide the source data (never mention URLs, specific quotes, or raw scraped info)
3. Provide suggestions based on patterns (not raw facts)
4. Flag hiring trends, financial trends, competitive threats
5. Return structured JSON only

CRITICAL RULE: Never expose raw data to user. Always synthesize into insights.

Return JSON:
{
  "company_name": "string",
  "insights": [
    {
      "category": "hiring_trend" | "financial_health" | "market_position" | "competitive_threat" | "growth_signal",
      "insight": "Natural language insight (1-2 sentences)",
      "evidence": "Briefly mention supporting facts (e.g. '3 senior AI roles posted', 'revenue up 15% in Q4')",
      "confidence": "high" | "medium" | "low",
      "source_types": ["financial", "hiring", "news"],
      "data_points": number,
      "note": "Why this matters for decision-making"
    }
  ],
  "overall_assessment": "1-2 sentence summary",
  "data_quality": "high" | "medium" | "low"
}
    `.trim();

        const userPrompt = `
Analyze this company research data for: ${companyName}

DATA SUMMARY (anonymized, no URLs):
- Financial signals: ${JSON.stringify(rawScrapedData.financial)}
- Hiring patterns: ${JSON.stringify(rawScrapedData.hiring)}
- Competitor landscape: ${JSON.stringify(rawScrapedData.competitors)}
- News sentiment: ${JSON.stringify(rawScrapedData.news)}
- Social signals: ${JSON.stringify(rawScrapedData.social_signals)}

Extract insights (no raw data in response).
Focus on:
1. Is this company growing or declining?
2. Are they hiring aggressively? What roles?
3. What competitive threats do they face?
4. Financial health signals?
5. Market momentum signals?

Return only insights, not raw data.
    `.trim();

        const raw = await llmClient.call({
            systemPrompt,
            userPrompt,
            agentName: "agent3_market",
            maxTokens: 2500,
            apiKeys,
        });

        try {
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            const result = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
            return result.insights || [];
        } catch (error) {
            console.error("Synthesis error:", error);
            return [];
        }
    }

    async buildCompanyProfile(
        companyName: string,
        insights: ResearchInsight[],
        apiKeys?: any
    ): Promise<string> {
        // Convert insights into narrative (for agent use)
        const systemPrompt = `
You are a consulting analyst summarizing company research.

Based on these insights (no raw data, only patterns):
${insights.map((i) => `- ${i.category}: ${i.insight} (Evidence: ${i.evidence || 'N/A'})`).join("\n")}

Create a 3-4 sentence company profile summarizing:
1. Growth trajectory
2. Competitive position
3. Market opportunity
4. Key risks

Use ONLY the insights provided. Do NOT invent data.
    `.trim();

        const userPrompt = `
Summarize research insights for: ${companyName}
    `.trim();

        return await llmClient.call({
            systemPrompt,
            userPrompt,
            agentName: "agent3_market",
            maxTokens: 500,
            apiKeys,
        });
    }
}

export const researchSynthesizer = new ResearchSynthesizer();
