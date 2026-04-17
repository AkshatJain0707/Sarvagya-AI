import fetch from "node-fetch";

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const SERPER_API_KEY = process.env.SERPER_API_KEY;

const PERPLEXITY_API_ENDPOINT = "https://api.perplexity.ai/chat/completions";
const TAVILY_API_ENDPOINT = "https://api.tavily.com/search";
const SERPER_API_ENDPOINT = "https://google.serper.dev/search";

export const dataCollectionTool = {
    name: "collect_market_intelligence",
    async invoke(args: Record<string, any>) {
        const { marketQuery, region = "Global", dataTypes = [] } = args;
        const collectedData: Record<string, any> = {};

        // 1. Primary Search - Tavily (Best for LLMs)
        if (TAVILY_API_KEY) {
            try {
                console.log(`[Search] Using Tavily for: ${marketQuery}`);
                const tavilyResult = await callWithRetry(() => callTavily(marketQuery));
                collectedData.search_results = tavilyResult;
            } catch (error) {
                console.error("Tavily failed:", error);
            }
        }

        // 2. Fallback 1 - Serper (Google Search)
        if (!collectedData.search_results && SERPER_API_KEY) {
            try {
                console.log(`[Search] Fallback to Serper for: ${marketQuery}`);
                const serperResult = await callWithRetry(() => callSerper(marketQuery));
                collectedData.search_results = serperResult;
            } catch (error) {
                console.error("Serper failed:", error);
            }
        }

        // 3. Fallback 2 - Perplexity (Deep Research)
        if ((!collectedData.search_results || dataTypes.includes("market_research")) && PERPLEXITY_API_KEY) {
            try {
                console.log(`[Search] Using Perplexity for research: ${marketQuery}`);
                const perplexityResult = await callWithRetry(() => callPerplexity(
                    `In-depth market research for ${marketQuery} in ${region}. Focus on: ${dataTypes.join(", ")}. Provide structured data and citations.`
                ));
                collectedData.market_research = perplexityResult;
            } catch (error) {
                console.error("Perplexity failed:", error);
            }
        }

        return {
            market_query: marketQuery,
            region,
            data_types: dataTypes,
            collected_data: collectedData,
            success: !!(collectedData.search_results || collectedData.market_research),
            timestamp: new Date().toISOString(),
        };
    },
};

async function callWithRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if (retries > 0) {
            console.log(`Retrying... (${retries} left)`);
            await new Promise(r => setTimeout(r, delay));
            return callWithRetry(fn, retries - 1, delay * 2);
        }
        throw error;
    }
}

async function callTavily(query: string) {
    const response = await fetch(TAVILY_API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            api_key: TAVILY_API_KEY,
            query,
            search_depth: "advanced",
            include_images: false,
            max_results: 5,
        }),
    });

    if (!response.ok) throw new Error(`Tavily API error: ${response.statusText}`);
    const data: any = await response.json();
    return {
        results: data.results?.map((r: any) => ({
            title: r.title,
            url: r.url,
            content: r.content,
            score: r.score
        })),
        answer: data.answer
    };
}

async function callSerper(query: string) {
    const response = await fetch(SERPER_API_ENDPOINT, {
        method: "POST",
        headers: {
            "X-API-KEY": SERPER_API_KEY!,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: query }),
    });

    if (!response.ok) throw new Error(`Serper API error: ${response.statusText}`);
    const data: any = await response.json();
    return {
        results: data.organic?.slice(0, 5).map((r: any) => ({
            title: r.title,
            url: r.link,
            content: r.snippet
        })),
        knowledgeGraph: data.knowledgeGraph
    };
}

async function callPerplexity(query: string) {
    const response = await fetch(PERPLEXITY_API_ENDPOINT, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "sonar-reasoning",
            messages: [{ role: "user", content: query }],
        }),
    });

    if (!response.ok) throw new Error(`Perplexity API error: ${response.statusText}`);
    const data: any = await response.json();
    return {
        answer: data.choices?.[0]?.message?.content,
        sources: data.citations || [],
    };
}
