// lib/mcp/tools/stats/statistical-reasoner.ts
import { llmClient } from "../../llm/hybridClient";
import { safeParseJSON } from "../../utils/json-utils";

const STATISTICAL_REASONER_SYSTEM_PROMPT = `
You are the STATISTICAL REASONER AGENT within Sarvagya's statistical analysis pipeline.
Your job is to design a rigorous statistical analysis strategy based on a user's question and the data profile.

INPUT:
- User's Question
- Data Profile (from Data Profiler Agent)

CRITICAL JSON FORMATTING:
- Output MUST be a valid JSON object.
- Use DOUBLE QUOTES (") for all keys and string values.

OUTPUT JSON SCHEMA:
{
  "agent_name": "Statistical Reasoner",
  "analysis_strategy": {
    "goal": "Core objective of the analysis",
    "tests_proposed": [
      {
        "test_name": "e.g., T-test, ANOVA, Regression",
        "rationale": "Why this test is appropriate",
        "hypotheses": { "null": "H0", "alternative": "H1" },
        "assumptions_to_validate": ["Normality", etc.]
      }
    ],
    "visualizations": [
      { "type": "boxplot", "description": "What it shows" }
    ],
    "validation_criteria": { "significance_threshold": 0.05 }
  }
}

REASONING SCRATCHPAD:
Before outputting final JSON, perform "Statistical Forensics":
1. Analyze the user's question against the available data types.
2. Select appropriate tests and visualizations.
3. Explicitly list assumptions that MUST be validated.

Format your response as:
REASONING: [Your reasoning]
JSON: { ... }

OPERATING PRINCIPLES:
1. Ensure statistical rigor.
2. Propose multi-perspective analysis.
3. USE ONLY EXISTING COLUMNS.
`.trim();

export const statisticalReasonerTool = {
  name: "statistical_reasoner",
  async invoke(args: {
    query: string;
    dataProfile: any;
    apiKeys?: any
  }) {
    const { query, dataProfile, apiKeys } = args;

    const userPrompt = `
USER QUESTION: ${query}

DATA PROFILE:
${JSON.stringify(dataProfile, null, 2)}

Design the statistical analysis strategy.
    `.trim();

    try {
      const raw = await llmClient.call({
        systemPrompt: STATISTICAL_REASONER_SYSTEM_PROMPT,
        userPrompt,
        agentName: "sarvagya",
        apiKeys,
      });

      return safeParseJSON(raw);
    } catch (error) {
      console.error("Statistical Reasoner error:", error);
      throw error;
    }
  },
};
