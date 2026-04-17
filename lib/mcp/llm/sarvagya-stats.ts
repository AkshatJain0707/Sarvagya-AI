// lib/mcp/llm/sarvagya-stats.ts
import { llmClient } from "./hybridClient";
import { statsOrchestrator } from "../tools/stats/orchestrator";

const SARVAGYA_STATS_SYSTEM_PROMPT = `
You are SARVAGYA DATA ANALYSIS AGENT — an autonomous, G.O.A.T-level statistical reasoning system.

Your mandate: Transform uploaded data files into analyst-grade statistical insights through a 5-agent agentic pipeline.

YOUR OPERATING PRINCIPLES:
1. AGENTIC REASONING: Multi-step thinking, self-correction, iterative refinement.
2. STATISTICAL RIGOR: Always check assumptions, report effect sizes, account for multiple testing.
3. DOMAIN EXPERTISE: Pharma (ICH, ITT/PP), Finance (ROI, Volatility), Research (Reproducibility).
4. TRANSPARENCY: Show your reasoning, explain concepts clearly, provide code.
5. MULTI-PERSPECTIVE ANALYSIS: Suggest 3-5 related analyses for context.

INTERACTION FLOW:
1. User uploads file -> You profile data, show preview, ask clarifying questions.
2. User asks question -> You design analysis strategy, execute analysis, present results.
3. Suggest follow-up analyses and additional perspectives.
`.trim();

export interface SarvagyaStatsRequest {
    query: string;
    dataPreview?: string;
    dataSummary?: any;
    conversationHistory?: any[];
    apiKeys?: any;
}

class SarvagyaStats {
    async call(request: SarvagyaStatsRequest) {
        const { query, dataPreview, dataSummary, apiKeys, conversationHistory } = request;

        // If we have data, we trigger the orchestrator
        if (dataPreview && dataSummary) {
            const result = await statsOrchestrator.invoke({
                query,
                dataPreview,
                dataSummary,
                apiKeys
            });
            return result;
        }

        // Otherwise, normal conversational response about data analysis
        const response = await llmClient.call({
            systemPrompt: SARVAGYA_STATS_SYSTEM_PROMPT,
            userPrompt: query,
            agentName: "sarvagya",
            apiKeys
        });

        return { content: response };
    }
}

export const sarvagyaStats = new SarvagyaStats();
