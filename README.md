# 🧠 Sarvagya AI: Your Consulting Copilot

Sarvagya AI is a state-of-the-art, multi-agent AI platform designed to empower consultants and business analysts. It handles everything from high-stakes strategic decision-making to complex statistical data modeling, providing an end-to-end "Copilot" experience for professional services.

![Sarvagya AI Banner](public/banner.png) *(Note: Placeholder for your actual screenshot)*

## 🚀 Key Features

### 1. Dual-Core Intelligence Modes
*   **Consultant Mode:** Orchestrates a network of specialized agents for strategic inquiry, market entry, boardroom decisions, and deck blueprinting.
*   **Data Analyser Mode:** Features a secure, isolated **Python Sandbox** for statistical analysis, regression modeling, and automated insight generation.

### 2. Multi-Agent Orchestration (Powered by MCP)
Sarvagya uses the **Model Context Protocol (MCP)** to route queries to the most qualified agent:
*   **Boardroom Decision:** High-stakes strategic validation.
*   **Execution Roadmap:** Operational timelines and KPIs.
*   **Market Entry:** Competitive GTM strategy and analysis.
*   **Research Synthesizer:** Advanced data synthesis and insight extraction.
*   **Financial Modeling:** DCF, LBO, and sensitivity analysis tools.

### 3. Integrated Data Science Pipeline
*   **Auto-Visualization:** Built-in support for **Plotly.js**, rendering interactive charts directly in the chat.
*   **Intelligent Reasoning:** Uses a statistical reasoner to interpret raw data and suggest the best analytical approach.
*   **Professional Exports:** Export your findings directly to **PDF** or **DOCX** with professional formatting.

### 4. Enterprise-Grade Architecture
*   **BYOK (Bring Your Own Key):** Full support for **Groq**, **GitHub Models**, **OpenRouter**, and **Perplexity**.
*   **Secure Vault:** End-to-end encryption for your API keys in the local storage vault.
*   **Stateless History:** Persistent chat history across sessions using a robust localized history service.

---

## 🛠️ Tech Stack

*   **Frontend:** [Next.js 15](https://nextjs.org/) (App Router), [React 19](https://reactjs.org/), [Tailwind CSS 4](https://tailwindcss.com/)
*   **Icons:** [Lucide React](https://lucide.dev/)
*   **Orchestration:** [Model Context Protocol (SDK)](https://modelcontextprotocol.io/)
*   **Data Visualization:** [Plotly.js](https://plotly.com/javascript/) & [React Plotly](https://github.com/plotly/react-plotly.js)
*   **Document Generation:** [Docx](https://docx.js.org/) & [jsPDF](https://parall.ax/products/jspdf)
*   **LLM Providers:** Groq (Llama 3.3), Claude 3.5 (via OpenRouter), GPT-4, GitHub Models

---

## 🚦 Getting Started

### Prerequisites
*   Node.js 18+ 
*   npm / pnpm / yarn
*   A Python environment (for local sandbox analysis if applicable)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/sarvagya-ai.git
    cd sarvagya-ai
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    pnpm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env.local` file in the root directory:
    ```env
    NEXT_PUBLIC_APP_URL=http://localhost:3000
    # Add optional global keys if not using BYOK
    GROQ_API_KEY=your_key_here
    GITHUB_TOKEN=your_token_here
    OPENROUTER_API_KEY=your_key_here
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

Open [http://localhost:3000](http://localhost:3000) to see the application.

---

## 📂 Project Structure

```text
├── app/                  # Next.js App Router (Pages & API)
├── components/           # UI Components (Chat, Sidebar, Cards)
├── lib/                  
│   ├── mcp/              # Agent Registry & Tool definitions
│   │   ├── tools/        # Specialized Agent logic (GTM, Stats, etc.)
│   │   └── llm/          # Provider-specific configurations
│   ├── api-keys.ts       # BYOK Vault logic
│   └── user-service.ts   # Profile and Session management
├── public/               # Static assets
└── prompts/              # System prompts for agent personalities
```

---

## 🛡️ Security & Privacy

*   **Local Execution:** Sensitive data analysis is performed in an isolated environment.
*   **Key Management:** Your API keys are stored in your browser's local storage and are never sent to our servers. They are only used to make client-side requests to your selected providers.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Built with ❤️ for the future of consulting.**
