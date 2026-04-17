// lib/mcp/tools/stats/report-generator.ts
import { llmClient } from "../../llm/hybridClient";
import { safeParseJSON } from "../../utils/json-utils";

const REPORT_GENERATOR_SYSTEM_PROMPT = `
You are the REPORT GENERATOR AGENT within Sarvagya's statistical analysis pipeline.
Your job: Create an analyst-grade report with methodology, results, and reproducibility.

INPUT:
- Analysis strategy
- Statistical results
- Synthesized insights

OUTPUT JSON SCHEMA:
{
  "agent_name": "Report Generator",
  "report_markdown": "# Executive Summary\\n...\\n## Methodology\\n...\\n## Results\\n...\\n## Recommendations",
  "jupyter_notebook_structure": {
    "cells": [
      { "type": "markdown", "content": "# Statistical Analysis Report" },
      { "type": "code", "content": "import pandas as..." }
    ]
  },
  "glossary": { "term": "definition" }
}

OPERATING PRINCIPLES:
1. Ensure the report is regulatory-ready if pharma context is detected.
2. Include explicit citations of methodology.
3. Maintain reproducibility (the Jupyter structure should be executable).
`.trim();

export const reportGeneratorTool = {
    name: "report_generator",
    async invoke(args: {
        analysisStrategy: any;
        statisticalResults: any;
        insights: any;
        apiKeys?: any
    }) {
        const { analysisStrategy, statisticalResults, insights, apiKeys } = args;

        const userPrompt = `
ANALYSIS STRATEGY:
${JSON.stringify(analysisStrategy, null, 2)}

STATISTICAL RESULTS:
${JSON.stringify(statisticalResults, null, 2)}

INSIGHTS:
${JSON.stringify(insights, null, 2)}

Generate the final report.
    `.trim();

        try {
            const raw = await llmClient.call({
                systemPrompt: REPORT_GENERATOR_SYSTEM_PROMPT,
                userPrompt,
                agentName: "sarvagya",
                apiKeys,
            });

            const response = safeParseJSON(raw);
            return {
                markdown: response.report_markdown,
                summary: response.agent_name, // fallback or specific field
                tableOfContents: response.table_of_contents || [],
                jupyterStructure: response.jupyter_notebook_structure,
                canExport: true,
                exportOptions: ["PDF", "DOCX"]
            };
        } catch (error) {
            console.error("Report Generator error:", error);
            throw error;
        }
    },
};
