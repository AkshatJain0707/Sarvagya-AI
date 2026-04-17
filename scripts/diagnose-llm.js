require('dotenv').config();
const axios = require('axios');

async function testGroq() {
    console.log("\n--- Testing Groq ---");
    const key = process.env.GROQ_API_KEY;
    if (!key) { console.error("Missing GROQ_API_KEY"); return; }

    try {
        const res = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            model: "llama-3.1-70b-versatile",
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 10
        }, {
            headers: { Authorization: `Bearer ${key}` }
        });
        console.log("Groq Success:", res.data.choices[0].message.content);
    } catch (err) {
        if (err.response) {
            console.error("Groq Error Status:", err.response.status);
            console.error("Groq Error Data:", JSON.stringify(err.response.data, null, 2));
        } else {
            console.error("Groq Error:", err.message);
        }
    }
}

async function testOpenRouter() {
    console.log("\n--- Testing OpenRouter ---");
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) { console.error("Missing OPENROUTER_API_KEY"); return; }

    try {
        // Test WITHOUT extra headers first
        console.log("Testing WITHOUT extra headers...");
        const res = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "anthropic/claude-3.5-sonnet",
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 10
        }, {
            headers: { Authorization: `Bearer ${key}` }
        });
        console.log("OpenRouter Success (no headers):", res.data.choices[0].message.content);
    } catch (err) {
        console.error("OpenRouter Error (no headers):", err.response?.status, err.response?.data || err.message);
    }

    try {
        // Test WITH extra headers
        console.log("\nTesting WITH extra headers...");
        const res = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "anthropic/claude-3.5-sonnet",
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 10
        }, {
            headers: {
                Authorization: `Bearer ${key}`,
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "Consultant AI"
            }
        });
        console.log("OpenRouter Success (with headers):", res.data.choices[0].message.content);
    } catch (err) {
        console.error("OpenRouter Error (with headers):", err.response?.status, err.response?.data || err.message);
    }
}

async function runTests() {
    await testGroq();
    await testOpenRouter();
}

runTests();
