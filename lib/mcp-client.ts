// lib/mcp-client.ts

type ToolInput = Record<string, any>;

export async function callMCPTool(
    toolName: string,
    input: ToolInput
): Promise<any> {
    const controller = new AbortController();
    const TIMEOUT_MS = 300000; // 5 minutes for complex multi-agent flows
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        const response = await fetch("/api/mcp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "tools/call",
                params: {
                    name: toolName,
                    arguments: input,
                },
                id: Date.now(),
            }),
            signal: controller.signal
        });

        clearTimeout(id);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP Error ${response.status}: ${errorText || response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
            throw new Error(`MCP Error [${data.error.code}]: ${data.error.message}`);
        }

        if (!data.result || !data.result.content) {
            return data.result || data;
        }

        // The bridge returns { content: [{ type: "text", text: "json_string" }] }
        const textContent = data.result.content.find((c: Record<string, any>) => c.type === "text")?.text;
        if (textContent) {
            try {
                return JSON.parse(textContent);
            } catch {
                return textContent;
            }
        }

        return data.result;
    } catch (error) {
        clearTimeout(id);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error("Request timed out (5m). The multi-agent pipeline is taking too long to respond.");
        }
        throw error;
    }
}

export async function orchestrateWorkflow(
    query: string,
    workflowTemplate?: string,
    context?: Record<string, any>,
    forcedTool?: string,
    apiKeys?: Record<string, string>
) {
    return callMCPTool("orchestrate_consulting_workflow", {
        query,
        workflowTemplate,
        context,
        forcedTool,
        apiKeys,
    });
}

export async function sarvagyaSuperAgent(
    query: string,
    forcedTool?: string,
    options?: { apiKeys?: Record<string, string>; conversationHistory?: any[];[key: string]: any }
) {
    const { apiKeys, conversationHistory, ...context } = options || {};
    return callMCPTool("sarvagya_super_agent", {
        query,
        forcedTool,
        context,
        apiKeys,
        conversationHistory,
    });
}

export async function sarvagyaStatsAgent(
    query: string,
    options?: {
        dataPreview?: string;
        dataSummary?: any;
        apiKeys?: Record<string, string>;
        conversationHistory?: any[]
    }
) {
    const { apiKeys, conversationHistory, dataPreview, dataSummary } = options || {};
    return callMCPTool("sarvagya_stats_agent", {
        query,
        dataPreview,
        dataSummary,
        apiKeys,
        conversationHistory,
    });
}
