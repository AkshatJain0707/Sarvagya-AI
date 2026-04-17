const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function testMCP() {
    const tools = ["sarvagya_super_agent", "company_disambiguation", "research_synthesizer"];
    const url = "http://localhost:3000/api/mcp";

    for (const tool of tools) {
        console.log(`Testing tool: ${tool}...`);
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "tools/call",
                    params: {
                        name: tool,
                        arguments: tool === "sarvagya_super_agent"
                            ? { query: "test" }
                            : (tool === "company_disambiguation" ? { query: "google" } : { topic: "test", researchData: [] })
                    },
                    id: Date.now(),
                }),
            });

            const data = await response.json();
            if (data.error && data.error.message === "Method not found") {
                console.error(`❌ FAILED: ${tool} still returns "Method not found"`);
            } else if (data.error) {
                // Some tools might fail due to missing API keys or logic, but that's better than "Method not found"
                console.log(`✅ PARTIAL SUCCESS: ${tool} reached, but returned error: ${data.error.message}`);
            } else {
                console.log(`✅ SUCCESS: ${tool} worked!`);
            }
        } catch (error) {
            console.error(`❌ ERROR: Failed to fetch ${tool}:`, error.message);
        }
    }
}

testMCP();
