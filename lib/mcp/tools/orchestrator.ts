// src/tools/orchestrator.ts
import { llmClient } from "../llm/hybridClient";
import { companyDisambiguator } from "./company-disambiguation";
import { boardroomDecisionTool } from "./agent1-boardroom";
import { roadmapArchitectTool } from "./agent2-roadmap";
import { marketEntryTool } from "./agent3-market";
import { deckBlueprintTool } from "./agent4-deck";
import { offerDesignTool } from "./agent5-offer";
import { dataCollectionTool } from "./data-collection";

const ORCHESTRATOR_SYSTEM_PROMPT = `
You are the CONSULTING COPILOT ORCHESTRATOR.

Your job: Route user queries to the appropriate specialist agents.

Intent Classification:
- "Should we..." → Agent 1 (Boardroom Decision)
- "Roadmap for..." → Agent 2 (Execution Roadmap)
- "Market..." → Agent 3 (Market Entry)
- "Deck for..." → Agent 4 (Deck Blueprint)
- "How to price..." → Agent 5 (Engagement Design)
- Multi-part queries → Sequential execution with context passing

Output this JSON:
{
  "intent": "decision|roadmap|market|deck|offer|multi_agent",
  "primary_agent": "Agent 1|2|3|4|5",
  "secondary_agents": [],
  "workflow_template": "Template_A|B|C|D|E or null",
  "clarifying_questions": [],
  "context_for_agents": {
    "market_context": "...",
    "company_context": "...",
    "data_needs": ["market_research", "competitor_data"]
  },
  "execution_plan": "Sequential execution with context passing between agents"
}
`;

export const orchestratorTool = {
    name: "orchestrate_consulting_workflow",
    async invoke(args: Record<string, any>) {
        const { query, workflowTemplate, context, companyName, region, competitors, apiKeys } = args;

        console.log(`\n[Orchestrator] Processing: ${query}`);

        // If user mentions a company name, handle disambiguation first
        if (companyName) {
            const options = await companyDisambiguator.search(companyName, apiKeys);

            if (options.length > 1) {
                // Return disambiguation question instead of processing
                return {
                    status: "disambiguation_needed",
                    message: await companyDisambiguator.askUserForClarification(
                        companyName,
                        options
                    ),
                    options: options.map((opt) => ({
                        id: opt.id,
                        name: opt.name,
                        industry: opt.industry,
                        country: opt.country,
                        description: opt.description,
                    })),
                };
            }

            // If only one match, proceed with research
            console.log(`[Orchestrator] Company confirmed: ${options[0].name}`);
        }

        try {
            // Step 1: Classify intent using high-capability provider
            const classificationText = await llmClient.call({
                systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
                userPrompt: `User query: "${query}"\nContext: ${JSON.stringify(context || {})}`,
                agentName: "orchestrator",
                apiKeys
            });

            const routing = JSON.parse(classificationText || "{}");

            // Step 2: Execute workflow based on template or routing
            const template = workflowTemplate || routing.workflow_template;
            let agentOutputs: Record<string, any> = {};
            let executionSequence: string[] = [];

            if (template === "Template_A" || routing.primary_agent === "Agent 1") {
                executionSequence = ["Agent 1", "Agent 2", "Agent 4"];

                // Collect data if needed
                if (routing.context_for_agents?.data_needs?.length > 0) {
                    agentOutputs.data_collection = await dataCollectionTool.invoke({
                        marketQuery: query,
                        dataTypes: routing.context_for_agents.data_needs,
                    });
                }

                // Execute Agent 1
                agentOutputs.agent_1 = await boardroomDecisionTool.invoke({
                    question: query,
                    options: ["Option 1", "Option 2", "Option 3"],
                    context,
                });

                // Execute Agent 2
                const agent1Rec = agentOutputs.agent_1?.stage_5_recommendation;
                agentOutputs.agent_2 = await roadmapArchitectTool.invoke({
                    decision: agent1Rec ? `Assuming ${agent1Rec.call}: ${agent1Rec.primary_rationale}` : query,
                    valueTarget: agentOutputs.agent_1?.stage_3_7_lens_analysis?.financial_roi?.upside || "$100M",
                    constraints: context?.constraints,
                });

                // Execute Agent 4
                agentOutputs.agent_4 = await deckBlueprintTool.invoke({
                    caseDescription: query,
                    audience: context?.audience || "board",
                    agentOutputs: {
                        agent_1_recommendation: agent1Rec,
                        agent_2_roadmap: agentOutputs.agent_2?.ROADMAP_SUMMARY,
                    },
                });
            } else if (template === "Template_B" || routing.primary_agent === "Agent 3") {
                executionSequence = ["Agent 3", "Agent 2", "Agent 4"];

                agentOutputs.agent_3 = await marketEntryTool.invoke({
                    marketQuery: query,
                    region: context?.region || "Global",
                    companyName: companyName,
                    competitors: context?.competitors || [],
                    apiKeys
                });

                agentOutputs.agent_2 = await roadmapArchitectTool.invoke({
                    decision: `Market entry: ${agentOutputs.agent_3?.PRIMARY_FINDING}`,
                    valueTarget: agentOutputs.agent_3?.market_size || "$100M",
                    constraints: context?.constraints,
                });

                agentOutputs.agent_4 = await deckBlueprintTool.invoke({
                    caseDescription: `Go-to-Market: ${query}`,
                    audience: context?.audience || "investors",
                    agentOutputs: {
                        market_analysis: agentOutputs.agent_3,
                        roadmap: agentOutputs.agent_2?.ROADMAP_SUMMARY,
                    },
                });
            } else {
                // Default fallback
                const primaryAgent = routing.primary_agent;
                if (primaryAgent === "Agent 3") {
                    agentOutputs.agent_3 = await marketEntryTool.invoke({ marketQuery: query });
                } else if (primaryAgent === "Agent 5") {
                    agentOutputs.agent_5 = await offerDesignTool.invoke({ clientChallenge: query, scope: "To be defined", timelineWeeks: 8 });
                } else {
                    agentOutputs.agent_1 = await boardroomDecisionTool.invoke({ question: query, options: ["Analysis required"] });
                }
            }

            return {
                workflow_executed: template || routing.workflow_template || "Dynamic",
                agents_executed: executionSequence,
                outputs: agentOutputs,
                overall_confidence: calculateOverallConfidence(agentOutputs),
                next_recommended_steps: [
                    "Review recommendation",
                    "Validate key assumptions",
                    "Share with stakeholders",
                ],
            };
        } catch (error) {
            return { error: `Orchestrator Gemini Error: ${error instanceof Error ? error.message : String(error)}` };
        }
    },
};

function calculateOverallConfidence(outputs: Record<string, any>): string {
    const confidences = Object.values(outputs)
        .filter((o: any) => o?.CONFIDENCE_CALIBRATION?.confidence_percentage !== undefined)
        .map((o: any) => o.CONFIDENCE_CALIBRATION.confidence_percentage);

    if (confidences.length === 0) return "UNKNOWN";

    const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    return avg > 80 ? "HIGH" : avg > 50 ? "MEDIUM" : "LOW";
}
