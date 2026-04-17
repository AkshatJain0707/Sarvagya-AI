// lib/mcp/tools/stats/data-profiler.ts
import { llmClient } from "../../llm/hybridClient";
import { safeParseJSON } from "../../utils/json-utils";

const DATA_PROFILER_SYSTEM_PROMPT = `
You are the DATA PROFILER AGENT within Sarvagya's statistical analysis pipeline.
Your job is to understand the uploaded data structure and provide a technical and domain-aware profile.

INPUT: 
- Data Preview (first few rows)
- Column Summary (names, types, null counts, unique counts)
- File attributes (size, format)

CRITICAL JSON FORMATTING:
- The output MUST be a valid JSON object.
- Use DOUBLE QUOTES (") for all keys and string values.

OUTPUT JSON SCHEMA:
{
  "agent_name": "Data Profiler",
  "data_summary": {
    "columns": [
      {
        "name": "col_name",
        "type": "numeric|categorical|datetime|boolean|text",
        "description": "What this column likely represents",
        "missing_pct": 0.0,
        "sample_values": []
      }
    ],
    "row_count": 0,
    "col_count": 0
  },
  "domain_classification": {
    "domain": "pharma|finance|clinical|marketing|research|other",
    "confidence": "HIGH|MEDIUM|LOW",
    "rationale": "Why this domain?"
  },
  "quality_report": {
    "completeness": "HIGH|MEDIUM|LOW",
    "consistency": "Description of inconsistencies",
    "anomalies": ["outlier in column X", "duplicate rows"]
  },
  "analytical_readiness": "Description"
}

REASONING SCRATCHPAD:
Before outputting final JSON, perform "Cognitive Forensics":
1. Analyze variable distributions and types.
2. Detect domain-specific patterns.
3. Identify outliers or quality issues that might impact common tests.

Format your response as:
REASONING: [Your reasoning]
JSON: { ... }

OPERATING PRINCIPLES:
1. Be precise about types.
2. Identify potential primary keys or group identifiers.
3. Detect the domain (e.g., if you see "Treatment_Arm", it's likely Clinical).
`.trim();

export const dataProfilerTool = {
  name: "data_profiler",
  async invoke(args: {
    preview: string;
    summary: any;
    apiKeys?: any
  }) {
    const { preview, summary, apiKeys } = args;

    const userPrompt = `
Analyze this data profile:

DATA PREVIEW:
${preview}

COLUMN SUMMARY:
${JSON.stringify(summary, null, 2)}

Provide reasoning and structured data profile JSON.
    `.trim();

    try {
      const raw = await llmClient.call({
        systemPrompt: DATA_PROFILER_SYSTEM_PROMPT,
        userPrompt,
        agentName: "sarvagya",
        apiKeys,
      });

      const parsed = safeParseJSON(raw);

      // 3. CRITICAL: Override LLM-generated columns with the ACTUAL input columns
      const inputColumnNames = summary?.columns?.map((c: any) =>
        typeof c === 'string' ? c : c.name
      ).filter(Boolean) || [];

      if (inputColumnNames.length > 0 && parsed.data_summary) {
        parsed.data_summary.columns = inputColumnNames.map((name: string, idx: number) => {
          const llmCol = parsed.data_summary.columns?.[idx] || {};
          return {
            name: name,
            type: llmCol.type || "unknown",
            description: llmCol.description || `Column ${idx + 1}`,
            missing_pct: llmCol.missing_pct || 0,
            sample_values: llmCol.sample_values || []
          };
        });
        parsed.data_summary.col_count = inputColumnNames.length;
      }

      return parsed;
    } catch (error) {
      console.error("Data Profiler error:", error);
      throw error;
    }
  },
};
