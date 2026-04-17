require('dotenv').config();
const axios = require('axios');

async function testGroqOnly() {
    const key = process.env.GROQ_API_KEY;
    try {
        const res = await axios.get("https://api.groq.com/openai/v1/models", {
            headers: { Authorization: `Bearer ${key}` }
        });
        console.log("Groq Models List Success. Found", res.data.data.length, "models.");
        console.log("First model:", res.data.data[0].id);
    } catch (err) {
        if (err.response) {
            console.error("Groq Connect Error:", err.response.status);
            console.error(JSON.stringify(err.response.data, null, 2));
        } else {
            console.error("Groq Network Error:", err.message);
        }
    }

    // Test Chat Completion
    try {
        const res = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
            model: "llama-3.3-70b-versatile", // Trying the newer alias
            messages: [{ role: "user", content: "hi" }],
        }, {
            headers: { Authorization: `Bearer ${key}` }
        });
        console.log("Groq Chat Success matches:", res.data.choices[0].message.content);
    } catch (err) {
        console.error("Groq Chat Error:", err.response?.status);
        if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
    }
}

testGroqOnly();
