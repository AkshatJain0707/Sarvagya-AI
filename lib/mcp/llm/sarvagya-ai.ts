// lib/mcp/llm/sarvagya-ai.ts
// Sarvagya AI - G.O.A.T-level consulting agent with 5-layer reasoning

import fs from "fs";
import path from "path";
import axios from "axios";
import { boardroomDecisionTool } from "@/lib/mcp/tools/agent1-boardroom";
import { roadmapArchitectTool } from "@/lib/mcp/tools/agent2-roadmap";
import { marketEntryTool } from "@/lib/mcp/tools/agent3-market";
import { deckBlueprintTool } from "@/lib/mcp/tools/agent4-deck";
import { offerDesignTool } from "@/lib/mcp/tools/agent5-offer";
import { dataCollectionTool } from "@/lib/mcp/tools/data-collection";
import { companyDisambiguator } from "@/lib/mcp/tools/company-disambiguation";
import { researchSynthesizer } from "@/lib/mcp/tools/research-synthesizer";
import { financialModelingTool } from "@/lib/mcp/tools/financial-modeling";
import { maStrategyTool } from "@/lib/mcp/tools/ma-strategy";

// Request type classification
type RequestType = "quick" | "deep" | "scenario" | "decision";
type ProviderType = "groq" | "github" | "openrouter" | "perplexity";
type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

interface SarvagyaRequest {
    query: string;
    requestType?: RequestType;
    conversationHistory?: ConversationTurn[];
    context?: Record<string, any>;
    forcedTool?: string;
    model?: string;
    apiKeys?: {
        groq?: string;
        github?: string;
        openrouter?: string;
        perplexity?: string;
        ollamaBaseUrl?: string;
        groqApiKey?: string; // Fallback for old names
        githubApiKey?: string;
        openRouterApiKey?: string;
        perplexityApiKey?: string;
        githubModelsApiKey?: string; // Backend naming
    };
}

interface ConversationTurn {
    role: "user" | "assistant";
    content: string;
    timestamp: number;
    recommendation?: string;
    assumptions?: string[];
}

interface SarvagyaResponse {
    content: string;
    provider: ProviderType;
    latencyMs: number;
    reasoning: {
        layer1_decomposition?: string;
        layer2_frameworks?: string[];
        layer3_analysis?: Record<string, any>;
        layer4_synthesis?: string;
        layer5_recommendation?: string;
    };
    confidence: ConfidenceLevel;
    tokens: { input: number; output: number };
}

interface StreamChunk {
    content: string;
    done: boolean;
    provider?: ProviderType;
}

class SarvagyaAI {
    private groqApiKey: string;
    private githubApiKey: string;
    private openRouterApiKey: string;
    private systemPrompt: string;
    private conversationMemory: ConversationTurn[] = [];

    constructor() {
        this.groqApiKey = process.env.GROQ_API_KEY || "";
        this.githubApiKey = process.env.GITHUB_MODELS_API_KEY || "";
        this.openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
        this.systemPrompt = this.loadSystemPrompt();
    }

    private loadSystemPrompt(): string {
        try {
            const promptPath = path.join(
                process.cwd(),
                "prompts",
                "sarvagya_system_prompt.txt"
            );
            return fs.readFileSync(promptPath, "utf-8");
        } catch {
            console.warn("[Sarvagya] System prompt not found, using default");
            return this.getDefaultPrompt();
        }
    }

    private getDefaultPrompt(): string {
        return `You are SARVAGYA AI, a G.O.A.T-level strategic consultant.
Use 5-layer reasoning: Problem Decomposition → Framework Selection → Analysis → Synthesis → Recommendation.
Always provide specific, quantified, actionable recommendations.
End with: PROCEED / DON'T / WAIT / CONDITIONAL.`;
    }

    // Classify request type for routing
    classifyRequest(query: string, context?: Record<string, any>): RequestType {
        const lowerQuery = query.toLowerCase();

        // High-stakes indicators → deep analysis
        if (
            lowerQuery.includes("acquire") ||
            lowerQuery.includes("merger") ||
            lowerQuery.includes("$") ||
            lowerQuery.includes("million") ||
            lowerQuery.includes("billion") ||
            context?.stakes === "high"
        ) {
            return "deep";
        }

        // Scenario analysis
        if (
            lowerQuery.includes("scenario") ||
            lowerQuery.includes("what if") ||
            lowerQuery.includes("compare")
        ) {
            return "scenario";
        }

        // Decision queries
        if (
            lowerQuery.includes("should we") ||
            lowerQuery.includes("recommend") ||
            lowerQuery.includes("decision")
        ) {
            return "decision";
        }

        // Default to quick
        return "quick";
    }

    // Smart provider routing
    private routeToProvider(request: SarvagyaRequest): ProviderType {
        const selectedModel = request.model || request.context?.model;
        if (selectedModel === "groq") return "groq";
        if (selectedModel === "github") return "github";
        if (selectedModel === "openrouter") return "openrouter";
        if (selectedModel === "perplexity") return "perplexity";

        const requestType = request.requestType || this.classifyRequest(request.query, request.context);
        switch (requestType) {
            case "deep":
            case "scenario":
                return "github"; // Quality-critical
            case "quick":
            case "decision":
            default:
                if (this.openRouterApiKey || request.apiKeys?.openRouterApiKey) return "openrouter";
                return "groq"; // Speed-critical
        }
    }

    // Build conversation context
    private buildMessages(query: string, forcedTool?: string, externalHistory?: ConversationTurn[]): Array<{ role: string; content: string }> {
        let systemPrompt = this.systemPrompt;

        if (forcedTool && forcedTool !== "auto") {
            systemPrompt += `\n\nUSER HAS FORCED THE USE OF TOOL: ${forcedTool}. You MUST call this tool immediately based on the query. Do not provide a direct answer until the tool output is received.`;
        }

        const messages: Array<{ role: string; content: string }> = [
            { role: "system", content: systemPrompt },
        ];

        // Add conversation history (prefer internal if external not provided, or merge strategy?)
        // Strategy: Use external history if provided (Stateless/Client-driven), fallback to internal (Stateful/Server-driven)
        const historySource = externalHistory && externalHistory.length > 0 ? externalHistory : this.conversationMemory;

        // Take last 10 turns for context (increased from 5 for better depth)
        const recentHistory = historySource.slice(-10);

        for (const turn of recentHistory) {
            messages.push({ role: turn.role, content: turn.content });
        }

        messages.push({ role: "user", content: query });
        return messages;
    }

    // Streaming response from Groq
    async *streamGroq(request: SarvagyaRequest): AsyncGenerator<StreamChunk> {
        const messages = this.buildMessages(request.query, request.forcedTool, request.conversationHistory);
        const apiKey = request.apiKeys?.groqApiKey || request.apiKeys?.groq || this.groqApiKey;
        try {
            const response = await axios.post(
                "https://api.groq.com/openai/v1/chat/completions",
                {
                    model: "llama-3.3-70b-versatile",
                    messages,
                    temperature: 0.2,
                    max_tokens: 4000,
                    stream: true,
                },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                    responseType: "stream",
                }
            );

            let buffer = "";
            for await (const chunk of response.data) {
                buffer += chunk.toString();
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        if (data === "[DONE]") {
                            yield { content: "", done: true, provider: "groq" };
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content || "";
                            if (content) {
                                yield { content, done: false, provider: "groq" };
                            }
                        } catch {
                            // Skip malformed JSON
                        }
                    }
                }
            }
            yield { content: "", done: true, provider: "groq" };
        } catch (error) {
            console.error("[Sarvagya] Groq streaming failed:", error);
            throw error;
        }
    }

    // Streaming response from GitHub Models
    async *streamGitHub(request: SarvagyaRequest): AsyncGenerator<StreamChunk> {
        const messages = this.buildMessages(request.query, request.forcedTool, request.conversationHistory);
        const apiKey = request.apiKeys?.githubApiKey || request.apiKeys?.github || request.apiKeys?.githubModelsApiKey || this.githubApiKey;
        try {
            const response = await axios.post(
                "https://models.inference.ai.azure.com/chat/completions",
                {
                    model: "gpt-4o",
                    messages,
                    temperature: 0.2,
                    max_tokens: 4000,
                    stream: true,
                },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                    responseType: "stream",
                }
            );

            let buffer = "";
            for await (const chunk of response.data) {
                buffer += chunk.toString();
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        if (data === "[DONE]") {
                            yield { content: "", done: true, provider: "github" };
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content || "";
                            if (content) {
                                yield { content, done: false, provider: "github" };
                            }
                        } catch {
                            // Skip malformed JSON
                        }
                    }
                }
            }
            yield { content: "", done: true, provider: "github" };
        } catch (error) {
            console.error("[Sarvagya] GitHub streaming failed:", error);
            throw error;
        }
    }

    // Streaming response from OpenRouter
    async *streamOpenRouter(request: SarvagyaRequest): AsyncGenerator<StreamChunk> {
        const messages = this.buildMessages(request.query, request.forcedTool, request.conversationHistory);
        const apiKey = request.apiKeys?.openrouter || request.apiKeys?.openRouterApiKey || this.openRouterApiKey;
        try {
            const response = await axios.post(
                "https://openrouter.ai/api/v1/chat/completions",
                {
                    model: "anthropic/claude-3.5-sonnet",
                    messages,
                    temperature: 0.2,
                    max_tokens: 4000,
                    stream: true,
                },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://github.com/google-deepmind/antigravity",
                        "X-Title": "Consultant AI",
                    },
                    responseType: "stream",
                }
            );

            let buffer = "";
            for await (const chunk of response.data) {
                buffer += chunk.toString();
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6).trim();
                        if (data === "[DONE]") {
                            yield { content: "", done: true, provider: "openrouter" };
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content || "";
                            if (content) {
                                yield { content, done: false, provider: "openrouter" };
                            }
                        } catch {
                            // Skip malformed JSON
                        }
                    }
                }
            }
            yield { content: "", done: true, provider: "openrouter" };
        } catch (error) {
            console.error("[Sarvagya] OpenRouter streaming failed:", error);
            throw error;
        }
    }

    // Streaming response from Perplexity
    async *streamPerplexity(query: string, apiKeys?: SarvagyaRequest["apiKeys"]): AsyncGenerator<StreamChunk> {
        const messages = this.buildMessages(query);
        const apiKey = apiKeys?.perplexityApiKey;
        if (!apiKey) {
            throw new Error("Perplexity API key missing");
        }
        try {
            const response = await axios.post(
                "https://api.perplexity.ai/chat/completions",
                {
                    model: "sonar-reasoning-pro",
                    messages,
                    stream: true,
                },
                {
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                    responseType: "stream",
                }
            );

            let buffer = "";
            for await (const chunk of response.data) {
                buffer += chunk.toString();
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6).trim();
                        if (data === "[DONE]") {
                            yield { content: "", done: true, provider: "perplexity" };
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content || "";
                            if (content) {
                                yield { content, done: false, provider: "perplexity" };
                            }
                        } catch {
                            // Skip malformed JSON
                        }
                    }
                }
            }
            yield { content: "", done: true, provider: "perplexity" };
        } catch (error) {
            console.error("[Sarvagya] Perplexity streaming failed:", error);
            throw error;
        }
    }

    // Main streaming entry point
    async *stream(request: SarvagyaRequest): AsyncGenerator<StreamChunk> {
        const provider = this.routeToProvider(request);
        const requestType = request.requestType || this.classifyRequest(request.query, request.context);

        console.log(`[Sarvagya] Request type: ${requestType}, Provider: ${provider}`);

        // Resolve providers for fallback
        const groqKey = request.apiKeys?.groqApiKey || request.apiKeys?.groq || this.groqApiKey;
        const githubKey = request.apiKeys?.githubApiKey || request.apiKeys?.github || request.apiKeys?.githubModelsApiKey || this.githubApiKey;
        const openRouterKey = request.apiKeys?.openrouter || request.apiKeys?.openRouterApiKey || this.openRouterApiKey;

        const chain = [
            { id: "groq", key: groqKey, stream: () => this.streamGroq(request) },
            { id: "github", key: githubKey, stream: () => this.streamGitHub(request) },
            { id: "openrouter", key: openRouterKey, stream: () => this.streamOpenRouter(request) }
        ];

        // Move routed provider to front
        const primaryIdx = chain.findIndex(p => p.id === provider);
        if (primaryIdx > -1) {
            const [p] = chain.splice(primaryIdx, 1);
            chain.unshift(p);
        }

        let fullResponse = "";
        let succeeded = false;
        let lastError = "";

        for (const p of chain) {
            if (p.key) {
                try {
                    console.log(`[Sarvagya] Attempting stream with ${p.id}...`);
                    for await (const chunk of p.stream()) {
                        fullResponse += chunk.content;
                        yield chunk;
                    }
                    succeeded = true;
                    break;
                } catch (err: any) {
                    const status = err.response?.status;
                    const msg = err.response?.data?.error?.message || err.message;
                    console.warn(`[Sarvagya] Stream via ${p.id} failed (${status}): ${msg}`);
                    lastError = msg;
                }
            }
        }

        if (succeeded && fullResponse) {
            this.conversationMemory.push({
                role: "assistant",
                content: fullResponse,
                timestamp: Date.now(),
            });
        }

        if (!succeeded) {
            throw new Error(`Sarvagya streaming failed. Last error: ${lastError}`);
        }
    }


    // Define tools for the LLM
    private getTools() {
        return [
            {
                type: "function",
                function: {
                    name: "boardroom_decision",
                    description: "High-stakes decision analysis using Agent 1 (Boardroom)",
                    parameters: { type: "object", properties: { decision: { type: "string" }, context: { type: "string" } }, required: ["decision"] }
                }
            },
            {
                type: "function",
                function: {
                    name: "execution_roadmap",
                    description: "Create execution roadmap using Agent 2",
                    parameters: { type: "object", properties: { goal: { type: "string" }, timeline: { type: "string" } }, required: ["goal"] }
                }
            },
            {
                type: "function",
                function: {
                    name: "market_entry",
                    description: "Analyze market entry using Agent 3",
                    parameters: { type: "object", properties: { market: { type: "string" }, product: { type: "string" } }, required: ["market"] }
                }
            },
            {
                type: "function",
                function: {
                    name: "financial_modeling",
                    description: "Run DCF, scenarios, or sensitivity analysis",
                    parameters: { type: "object", properties: { action: { type: "string", enum: ["dcf", "scenarios", "sensitivity"] }, inputs: { type: "object" } }, required: ["action"] }
                }
            },
            {
                type: "function",
                function: {
                    name: "ma_strategy",
                    description: "Analyze M&A deal structure and valuation",
                    parameters: { type: "object", properties: { action: { type: "string", enum: ["analyze", "valuation"] }, target: { type: "object" } }, required: ["action"] }
                }
            },
            {
                type: "function",
                function: {
                    name: "company_disambiguation",
                    description: "Search and identify correct company entity/domain",
                    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] }
                }
            },
            {
                type: "function",
                function: {
                    name: "collect_market_intelligence",
                    description: "Scrape web data for market intelligence",
                    parameters: { type: "object", properties: { topic: { type: "string" }, urls: { type: "array", items: { type: "string" } } }, required: ["topic"] }
                }
            },
            {
                type: "function",
                function: {
                    name: "research_synthesizer",
                    description: "Synthesize gathered research into insights",
                    parameters: { type: "object", properties: { topic: { type: "string" }, researchData: { type: "array", items: { type: "object" } } }, required: ["topic"] }
                }
            },
            {
                type: "function",
                function: {
                    name: "deck_blueprint",
                    description: "Generate a presentation deck structure using Agent 4",
                    parameters: { type: "object", properties: { topic: { type: "string" }, audience: { type: "string" } }, required: ["topic"] }
                }
            },
            {
                type: "function",
                function: {
                    name: "engagement_design",
                    description: "Design a consulting engagement/offer using Agent 5",
                    parameters: { type: "object", properties: { problem: { type: "string" }, solution: { type: "string" } }, required: ["problem"] }
                }
            }
        ];
    }

    private async executeTool(name: string, args: any, apiKeys?: SarvagyaRequest["apiKeys"]) {
        console.log(`[Sarvagya] Executing tool: ${name}`);
        const toolArgs = { ...args, apiKeys }; // Inject keys into tool args
        switch (name) {
            case "boardroom_decision": return await boardroomDecisionTool.invoke(toolArgs);
            case "execution_roadmap": return await roadmapArchitectTool.invoke(toolArgs);
            case "market_entry": return await marketEntryTool.invoke(toolArgs);
            case "financial_modeling": return await financialModelingTool.invoke(toolArgs);
            case "ma_strategy": return await maStrategyTool.invoke(toolArgs);
            case "company_disambiguation": return await companyDisambiguator.search(args.query, apiKeys);
            case "collect_market_intelligence": return await dataCollectionTool.invoke(toolArgs);
            case "research_synthesizer": return await researchSynthesizer.synthesizeCompanyData(args.topic, args.researchData, apiKeys);
            case "deck_blueprint": return await deckBlueprintTool.invoke(toolArgs);
            case "engagement_design": return await offerDesignTool.invoke(toolArgs);
            default: return { error: "Tool not found" };
        }
    }

    // Non-streaming call with tool support
    async call(request: SarvagyaRequest): Promise<SarvagyaResponse> {
        const provider = this.routeToProvider(request);
        const messages = this.buildMessages(request.query, request.forcedTool, request.conversationHistory);
        const tools = this.getTools();
        const startTime = Date.now();
        const apiKeys = request.apiKeys;


        // Resolve providers for fallback
        const groqKey = apiKeys?.groqApiKey || apiKeys?.groq || this.groqApiKey;
        const githubKey = apiKeys?.githubApiKey || apiKeys?.github || apiKeys?.githubModelsApiKey || this.githubApiKey;
        const openRouterKey = apiKeys?.openrouter || apiKeys?.openRouterApiKey || this.openRouterApiKey;

        const chain = [
            { id: "groq", key: groqKey, call: () => this.callSpecificProvider("groq", request, startTime) },
            { id: "github", key: githubKey, call: () => this.callSpecificProvider("github", request, startTime) },
            { id: "openrouter", key: openRouterKey, call: () => this.callSpecificProvider("openrouter", request, startTime) }
        ];

        // Move routed provider to front
        const primaryIdx = chain.findIndex(p => p.id === provider);
        if (primaryIdx > -1) {
            const [p] = chain.splice(primaryIdx, 1);
            chain.unshift(p);
        }

        let lastError = "";
        for (const p of chain) {
            if (p.key) {
                try {
                    return await p.call();
                } catch (err: any) {
                    const status = err.response?.status;
                    const msg = err.response?.data?.error?.message || err.message;
                    console.warn(`[Sarvagya] ${p.id} failed (${status}): ${msg}`);
                    lastError = msg;
                    if (status !== 402 && status !== 429 && status !== 503) {
                        // If not a quota/rate limit error, maybe don't fallback?
                        // Actually, for robustness, we should probably try everything.
                    }
                }
            }
        }

        throw new Error(`Sarvagya failed to get a response. Last error: ${lastError}`);
    }

    private async callSpecificProvider(provider: ProviderType, request: SarvagyaRequest, startTime: number): Promise<SarvagyaResponse> {
        const messages = this.buildMessages(request.query, request.forcedTool, request.conversationHistory);
        const tools = this.getTools();
        const apiKeys = request.apiKeys;

        if (provider === "openrouter") {
            const response = await axios.post(
                "https://openrouter.ai/api/v1/chat/completions",
                { model: "anthropic/claude-3.5-sonnet", messages, tools, tool_choice: "auto" },
                { headers: { Authorization: `Bearer ${apiKeys?.openRouterApiKey || apiKeys?.openrouter || this.openRouterApiKey}` } }
            );
            return this.handleToolResponse(response, "openrouter", messages, apiKeys, startTime);
        }

        if (provider === "github") {
            const response = await axios.post(
                "https://models.inference.ai.azure.com/chat/completions",
                { model: "gpt-4o", messages, tools, tool_choice: "auto" },
                { headers: { Authorization: `Bearer ${apiKeys?.githubApiKey || apiKeys?.github || apiKeys?.githubModelsApiKey || this.githubApiKey}` } }
            );
            return this.handleToolResponse(response, "github", messages, apiKeys, startTime);
        }

        if (provider === "groq") {
            const response = await axios.post(
                "https://api.groq.com/openai/v1/chat/completions",
                { model: "llama-3.3-70b-versatile", messages, tools, tool_choice: "auto", temperature: 0.2 },
                { headers: { Authorization: `Bearer ${apiKeys?.groqApiKey || apiKeys?.groq || this.groqApiKey}` } }
            );
            return this.handleToolResponse(response, "groq", messages, apiKeys, startTime);
        }

        if (provider === "perplexity") {
            const response = await axios.post(
                "https://api.perplexity.ai/chat/completions",
                { model: "sonar-reasoning-pro", messages },
                { headers: { Authorization: `Bearer ${apiKeys?.perplexityApiKey}` } }
            );
            const content = response.data.choices[0].message.content;
            return {
                content,
                provider: "perplexity",
                latencyMs: Date.now() - startTime,
                reasoning: {},
                confidence: this.extractConfidence(content),
                tokens: { input: 0, output: 0 }
            };
        }
        throw new Error(`Unsupported provider: ${provider}`);
    }

    private async handleToolResponse(response: any, provider: ProviderType, messages: any[], apiKeys: any, startTime: number): Promise<SarvagyaResponse> {
        const msg = response.data.choices[0].message;
        let content = msg.content || "";

        if (msg.tool_calls) {
            messages.push(msg);
            for (const toolCall of msg.tool_calls) {
                const result = await this.executeTool(toolCall.function.name, JSON.parse(toolCall.function.arguments), apiKeys);
                messages.push({ role: "tool", tool_call_id: toolCall.id, content: JSON.stringify(result) });
            }

            const url = provider === "openrouter" ? "https://openrouter.ai/api/v1/chat/completions" :
                provider === "github" ? "https://models.inference.ai.azure.com/chat/completions" :
                    "https://api.groq.com/openai/v1/chat/completions";
            const model = provider === "openrouter" ? "anthropic/claude-3.5-sonnet" :
                provider === "github" ? "gpt-4o" : "llama-3.3-70b-versatile";
            const key = provider === "openrouter" ? (apiKeys?.openRouterApiKey || apiKeys?.openrouter || this.openRouterApiKey) :
                provider === "github" ? (apiKeys?.githubApiKey || apiKeys?.github || apiKeys?.githubModelsApiKey || this.githubApiKey) :
                    (apiKeys?.groqApiKey || apiKeys?.groq || this.groqApiKey);

            const response2 = await axios.post(url, { model, messages }, { headers: { Authorization: `Bearer ${key}` } });
            content = response2.data.choices[0].message.content;
        }

        return {
            content,
            provider,
            latencyMs: Date.now() - startTime,
            reasoning: {},
            confidence: this.extractConfidence(content),
            tokens: { input: 0, output: 0 }
        };
    }

    // ... (rest of methods)

    private extractConfidence(content: string): ConfidenceLevel {
        if (content.includes("HIGH")) return "HIGH";
        if (content.includes("MEDIUM")) return "MEDIUM";
        return "LOW";
    }

    clearMemory(): void { this.conversationMemory = []; }
    getHistory(): ConversationTurn[] { return [...this.conversationMemory]; }
}

export const sarvagyaAI = new SarvagyaAI();
export type { SarvagyaRequest, SarvagyaResponse, StreamChunk, RequestType };
