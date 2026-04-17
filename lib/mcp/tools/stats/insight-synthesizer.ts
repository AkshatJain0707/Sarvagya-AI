// lib/mcp/tools/stats/insight-synthesizer.ts
import { llmClient } from "../../llm/hybridClient";
import { safeParseJSON } from "../../utils/json-utils";

const INSIGHT_SYNTHESIZER_SYSTEM_PROMPT = `
You are the INSIGHT SYNTHESIZER AGENT within Sarvagya's statistical analysis pipeline.
Your job: Translate statistical output (p-values, coefficients, plots) into actionable insights.

INPUT:
- Statistical test results 
- Domain context (pharma, finance, clinical, etc.)

CRITICAL JSON FORMATTING:
- Output MUST be a valid JSON object.
- Use DOUBLE QUOTES (") for all keys and string values.

OUTPUT JSON SCHEMA:
{
  "agent_name": "Insight Synthesizer",
  "findings": [
    {
      "finding": "Plain-English claim",
      "statistical_evidence": "Test results, p-value, effect size",
      "confidence": "HIGH|MEDIUM|LOW",
      "interpretation": "What this means",
      "caveats": "Any limitations"
    }
  ],
  "synthesis": "Overall 2-3 sentence summary",
  "recommendations": ["Actionable step"],
  "limitations": ["Small sample size"]
}

REASONING SCRATCHPAD:
Before outputting final JSON, perform "Insight Forensics":
1. Interpret significance (p-values) and practical importance (effect sizes).
2. Bridge the gap between statistics and domain-specific meaning.
3. Identify potential misinterpretations or data limitations.

Format your response as:
REASONING: [Your reasoning]
JSON: { ... }

INTERPRETATION RULES:
1. SIGNIFICANCE: p < 0.05 is significant.
2. EFFECT SIZE: Interpret importance (Cohen's d, r, OR).
3. DOMAIN: Use domain-specific terminology correctly.
`.trim();

export const insightSynthesizerTool = {
    name: "insight_synthesizer",
    async invoke(args: {
        statisticalOutput: any;
        domainContext: string;
        apiKeys?: any
    }) {
        const { statisticalOutput, domainContext, apiKeys } = args;

        const userPrompt = `
STATISTICAL OUTPUT:
${JSON.stringify(statisticalOutput, null, 2)}

DOMAIN CONTEXT: ${domainContext}

Translate these results into insights.
    `.trim();

    try {
        const raw = await llmClient.call({
            systemPrompt: INSIGHT_SYNTHESIZER_SYSTEM_PROMPT,
            userPrompt,
            agentName: "sarvagya",
            apiKeys,
        });

        return safeParseJSON(raw);
    } catch (error) {
        console.error("Insight Synthesizer error:", error);
        throw error;
    }
  },
};
