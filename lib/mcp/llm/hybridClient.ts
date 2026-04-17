import axios, { AxiosError } from "axios";

interface LLMCallOptions {
    systemPrompt: string;
    userPrompt: string;
    agentName:
    | "agent1_boardroom"
    | "agent2_roadmap"
    | "agent3_market"
    | "agent4_deck"
    | "agent5_offer"
    | "sarvagya"
    | "orchestrator";
    maxTokens?: number;
    provider?: "groq" | "openrouter" | "perplexity" | "openai" | "anthropic" | "github";
    apiKeys?: {
        groqApiKey?: string;
        openRouterApiKey?: string;
        perplexityApiKey?: string;
        openaiApiKey?: string;
        anthropicApiKey?: string;
        githubModelsApiKey?: string;
        groq?: string;
        github?: string;
        openrouter?: string;
        perplexity?: string;
        openai?: string;
        anthropic?: string;
    };
}

interface AgentConfig {
    primaryMode: "groq" | "openrouter" | "github";
    model: string;
    maxTokens: number;
    temperature: number;
}

class HybridLLMClient {
    private groqApiKey: string;
    private openRouterApiKey: string;
    private githubModelsApiKey: string;
    private agentConfig: Record<string, AgentConfig>;

    constructor() {
        this.groqApiKey = process.env.GROQ_API_KEY || "";
        this.openRouterApiKey = process.env.OPENROUTER_API_KEY || "";
        this.githubModelsApiKey = process.env.GITHUB_MODELS_API_KEY || "";

        this.agentConfig = {
            agent1_boardroom: { primaryMode: "groq", model: "llama-3.3-70b-versatile", maxTokens: 3500, temperature: 0.2 },
            agent2_roadmap: { primaryMode: "groq", model: "llama-3.3-70b-versatile", maxTokens: 4000, temperature: 0.2 },
            agent3_market: { primaryMode: "groq", model: "llama-3.3-70b-versatile", maxTokens: 3500, temperature: 0.2 },
            agent4_deck: { primaryMode: "groq", model: "llama-3.3-70b-versatile", maxTokens: 3000, temperature: 0.2 },
            agent5_offer: { primaryMode: "groq", model: "llama-3.3-70b-versatile", maxTokens: 3500, temperature: 0.2 },
            sarvagya: { primaryMode: "groq", model: "llama-3.3-70b-versatile", maxTokens: 4000, temperature: 0.2 },
            orchestrator: { primaryMode: "groq", model: "llama-3.3-70b-versatile", maxTokens: 2000, temperature: 0.1 },
        };
    }

    private async sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async callWithRetry(
        fn: () => Promise<string>,
        providerId: string,
        maxRetries = 2
    ): Promise<string> {
        let lastError: any;
        for (let i = 0; i <= maxRetries; i++) {
            try {
                return await fn();
            } catch (err: any) {
                lastError = err;
                const status = err.response?.status;
                // Retry on rate limit (429) or transient server errors (500, 502, 503, 504)
                if (status === 429 || (status >= 500 && status <= 504)) {
                    const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
                    console.warn(`[LLM] ${providerId} retry ${i + 1}/${maxRetries} due to status ${status}. Waiting ${Math.round(delay)}ms...`);
                    await this.sleep(delay);
                    continue;
                }
                throw err; // Don't retry on 400, 401, 403, 404, etc.
            }
        }
        throw lastError;
    }

    private async callGroq(model: string, systemPrompt: string, userPrompt: string, maxTokens: number, apiKey: string): Promise<string> {
        console.log(`[Groq] Calling ${model}...`);
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            model,
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            temperature: 0.2,
            max_tokens: maxTokens,
        }, {
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            timeout: 90000,
        });
        return response.data.choices[0].message.content;
    }

    private async callGitHubModels(model: string, systemPrompt: string, userPrompt: string, maxTokens: number, apiKey: string): Promise<string> {
        console.log(`[GitHub Models] Calling ${model}...`);
        const response = await axios.post("https://models.inference.ai.azure.com/chat/completions", {
            model,
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            temperature: 0.2,
            max_tokens: maxTokens,
        }, {
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            timeout: 90000,
        });
        return response.data.choices[0].message.content;
    }

    private async callOpenRouter(model: string, systemPrompt: string, userPrompt: string, maxTokens: number, apiKey: string): Promise<string> {
        console.log(`[OpenRouter] Calling ${model}...`);
        const response = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model,
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
            temperature: 0.2,
            max_tokens: maxTokens,
        }, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://sarvagya.ai",
                "X-Title": "Sarvagya AI",
            },
            timeout: 90000,
        });
        return response.data.choices[0].message.content;
    }

    async call(options: LLMCallOptions): Promise<string> {
        const { systemPrompt, userPrompt, agentName, maxTokens: overrideMaxTokens } = options;
        const config = this.agentConfig[agentName] || this.agentConfig.agent1_boardroom;
        const maxTokens = overrideMaxTokens || config.maxTokens;

        const groqKey = options.apiKeys?.groqApiKey || options.apiKeys?.groq || this.groqApiKey;
        const githubKey = options.apiKeys?.githubModelsApiKey || options.apiKeys?.github || this.githubModelsApiKey;
        const openRouterKey = options.apiKeys?.openRouterApiKey || options.apiKeys?.openrouter || this.openRouterApiKey;

        const providers = [
            { id: "groq", key: groqKey, call: () => this.callGroq(config.model, systemPrompt, userPrompt, maxTokens, groqKey!) },
            { id: "github", key: githubKey, call: () => this.callGitHubModels("gpt-4o", systemPrompt, userPrompt, maxTokens, githubKey!) },
            { id: "openrouter", key: openRouterKey, call: () => this.callOpenRouter("anthropic/claude-3.5-sonnet", systemPrompt, userPrompt, maxTokens, openRouterKey!) }
        ];

        // 1. Try specified provider first with retry
        if (options.provider) {
            const p = providers.find(p => p.id === options.provider);
            if (p && p.key) {
                try {
                    return await this.callWithRetry(p.call, p.id);
                } catch (e) {
                    console.warn(`[LLM] Requested provider ${p.id} failed after retries, entering fallback chain.`);
                }
            }
        }

        // 2. FALLBACK CHAIN with retries
        let lastError = "";
        for (const provider of providers) {
            if (provider.key) {
                try {
                    const res = await this.callWithRetry(provider.call, provider.id);
                    console.log(`[LLM] ✓ ${provider.id} successful`);
                    return res;
                } catch (err: any) {
                    const msg = err.response?.data?.error?.message || err.message;
                    console.warn(`[LLM] ${provider.id} abandoned: ${msg}`);
                    lastError = `[${provider.id}] ${msg}`;
                }
            }
        }

        throw new Error(`No available LLM providers succeeded. Last error: ${lastError || "No keys configured"}`);
    }
}

export const llmClient = new HybridLLMClient();
