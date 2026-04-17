import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as dotenv from "dotenv";

import { orchestratorTool } from "./tools/orchestrator";
import { boardroomDecisionTool } from "./tools/agent1-boardroom";
import { roadmapArchitectTool } from "./tools/agent2-roadmap";
import { marketEntryTool } from "./tools/agent3-market";
import { deckBlueprintTool } from "./tools/agent4-deck";
import { offerDesignTool } from "./tools/agent5-offer";
import { dataCollectionTool } from "./tools/data-collection";
import { financialModelingTool } from "./tools/financial-modeling";
import { maStrategyTool } from "./tools/ma-strategy";
import { companyDisambiguator } from "./tools/company-disambiguation";
import { researchSynthesizer } from "./tools/research-synthesizer";
import { sarvagyaAI } from "./llm/sarvagya-ai";
import { sarvagyaStats } from "./llm/sarvagya-stats";
import { statsOrchestrator } from "./tools/stats/orchestrator";
import { dataProfilerTool } from "./tools/stats/data-profiler";
import { statisticalReasonerTool } from "./tools/stats/statistical-reasoner";
import { codeGeneratorTool } from "./tools/stats/code-generator";
import { insightSynthesizerTool } from "./tools/stats/insight-synthesizer";
import { reportGeneratorTool } from "./tools/stats/report-generator";

dotenv.config();

const server = new Server(
    {
        name: "goat-consulting-copilot",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Register Tool Definitions
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "orchestrate_consulting_workflow",
            description: "Orchestrate multi-agent consulting workflow (runs orchestrator + appropriate specialists)",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string", description: "User consulting query" },
                    workflowTemplate: { type: "string", enum: ["Template_A", "Template_B", "Template_C", "Template_D", "Template_E"] },
                    context: { type: "object" },
                    apiKeys: { type: "object" }
                },
                required: ["query"]
            }
        },
        {
            name: "boardroom_decision",
            description: "Agent 1: High-stakes strategic decision analysis",
            inputSchema: {
                type: "object",
                properties: {
                    question: { type: "string" },
                    options: { type: "array", items: { type: "string" } },
                    context: { type: "object" },
                    apiKeys: { type: "object" }
                },
                required: ["question", "options"]
            }
        },
        {
            name: "execution_roadmap",
            description: "Agent 2: Create execution roadmap",
            inputSchema: {
                type: "object",
                properties: {
                    decision: { type: "string" },
                    valueTarget: { type: "string" },
                    constraints: { type: "object" },
                    apiKeys: { type: "object" }
                },
                required: ["decision", "valueTarget"]
            }
        },
        {
            name: "market_entry",
            description: "Agent 3: Market opportunity analysis",
            inputSchema: {
                type: "object",
                properties: {
                    marketQuery: { type: "string" },
                    region: { type: "string" },
                    competitors: { type: "array", items: { type: "string" } },
                    apiKeys: { type: "object" }
                },
                required: ["marketQuery"]
            }
        },
        {
            name: "deck_blueprint",
            description: "Agent 4: Presentation architecture",
            inputSchema: {
                type: "object",
                properties: {
                    caseDescription: { type: "string" },
                    audience: { type: "string" },
                    agentOutputs: { type: "object" },
                    apiKeys: { type: "object" }
                },
                required: ["caseDescription"]
            }
        },
        {
            name: "engagement_design",
            description: "Agent 5: Consulting engagement design",
            inputSchema: {
                type: "object",
                properties: {
                    clientChallenge: { type: "string" },
                    scope: { type: "string" },
                    timelineWeeks: { type: "number" },
                    apiKeys: { type: "object" }
                },
                required: ["clientChallenge"]
            }
        },
        {
            name: "collect_market_intelligence",
            description: "Trigger market intelligence collection",
            inputSchema: {
                type: "object",
                properties: {
                    marketQuery: { type: "string" },
                    region: { type: "string" },
                    dataTypes: { type: "array", items: { type: "string" } }
                },
                required: ["marketQuery"]
            }
        },
        {
            name: "sarvagya_super_agent",
            description: "G.O.A.T-level strategic consultant with 5-layer reasoning and tool orchestration",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string" },
                    forcedTool: { type: "string", description: "Optionally force a specific specialist tool" },
                    context: { type: "object" },
                    apiKeys: { type: "object" }
                },
                required: ["query"]
            }
        },
        {
            name: "financial_modeling",
            description: "DCF, scenario analysis, sensitivity",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["dcf", "scenarios", "sensitivity"] },
                    inputs: { type: "object" }
                },
                required: ["action"]
            }
        },
        {
            name: "ma_strategy",
            description: "M&A valuation, deal structure, integration",
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["analyze", "valuation"] },
                    target: { type: "object" }
                },
                required: ["action"]
            }
        },
        {
            name: "company_disambiguation",
            description: "Identify company entity/domain",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string" }
                },
                required: ["query"]
            }
        },
        {
            name: "research_synthesizer",
            description: "Synthesize research data",
            inputSchema: {
                type: "object",
                properties: {
                    topic: { type: "string" },
                    researchData: { type: "array" }
                },
                required: ["topic"]
            }
        },
        {
            name: "sarvagya_stats_agent",
            description: "Autonomous statistical analysis agent with 5-agent pipeline",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string" },
                    dataPreview: { type: "string" },
                    dataSummary: { type: "object" },
                    apiKeys: { type: "object" }
                },
                required: ["query"]
            }
        },
        {
            name: "stats_orchestrator",
            description: "Coordinate 5-agent statistical analysis workflow",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string" },
                    dataPreview: { type: "string" },
                    dataSummary: { type: "object" },
                    apiKeys: { type: "object" }
                },
                required: ["query"]
            }
        }
    ]
}));

// Register Tool Handlers
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const { name, arguments: args } = request.params;

    try {
        let result;
        switch (name) {
            case "orchestrate_consulting_workflow": result = await orchestratorTool.invoke(args); break;
            case "boardroom_decision": result = await boardroomDecisionTool.invoke(args); break;
            case "execution_roadmap": result = await roadmapArchitectTool.invoke(args); break;
            case "market_entry": result = await marketEntryTool.invoke(args); break;
            case "deck_blueprint": result = await deckBlueprintTool.invoke(args); break;
            case "engagement_design": result = await offerDesignTool.invoke(args); break;
            case "collect_market_intelligence": result = await dataCollectionTool.invoke(args); break;
            case "financial_modeling": result = await financialModelingTool.invoke(args); break;
            case "ma_strategy": result = await maStrategyTool.invoke(args); break;
            case "company_disambiguation": result = await companyDisambiguator.search(args.query); break;
            case "research_synthesizer": result = await researchSynthesizer.synthesizeCompanyData(args.topic, args.researchData); break;
            case "sarvagya_super_agent": result = await sarvagyaAI.call(args); break;
            case "sarvagya_stats_agent": result = await sarvagyaStats.call(args); break;
            case "stats_orchestrator": result = await statsOrchestrator.invoke(args); break;
            case "data_profiler": result = await dataProfilerTool.invoke(args); break;
            case "statistical_reasoner": result = await statisticalReasonerTool.invoke(args); break;
            case "code_generator": result = await codeGeneratorTool.invoke(args); break;
            case "insight_synthesizer": result = await insightSynthesizerTool.invoke(args); break;
            case "report_generator": result = await reportGeneratorTool.invoke(args); break;
            default: throw new Error(`Unknown tool: ${name}`);
        }
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
        return { content: [{ type: "text" as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
});

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("G.O.A.T Consulting Copilot MCP server running on stdio");
}

const isMain = import.meta.url.startsWith("file:") &&
    (process.argv[1] && (
        process.argv[1] === new URL(import.meta.url).pathname ||
        new URL(import.meta.url).pathname.endsWith(process.argv[1].replace(/\\/g, '/'))
    ));

if (isMain) {
    main().catch(console.error);
}

export { server };
