// lib/mcp/tools/stats/code-generator.ts
import { llmClient } from "../../llm/hybridClient";

const CODE_GENERATOR_SYSTEM_PROMPT = `
You are the CODE GENERATOR AGENT within Sarvagya's statistical analysis pipeline.
Your ONLY job: Generate production-grade Python code for statistical analysis.

INPUT:
- Data profile (which contains the TRUE column names in the "columns" field)
- Analysis strategy (tests, visualizations, hypotheses)

OUTPUT FORMAT:
You must provide two parts in your response:
1. EXPLANATION: A brief summary of what the code does.
2. CODE: The Python code block.

⚠️ CRITICAL - COLUMN VALIDATION ⚠️
1. **ONLY USE COLUMNS FROM THE DATA PROFILE.** The exact column names are provided in the "columns" array.
2. **NEVER INVENT OR ASSUME COLUMN NAMES** like "pattern_match", "context_relevance", "date", "category", etc. unless they appear EXACTLY in the data profile.
3. If the analysis strategy references a column that doesn't exist, SKIP that analysis or use the closest available column.
4. ALWAYS start your code by printing and validating columns exist before using them.

⚠️ DEFENSIVE DATA HANDLING ⚠️
1. **CAST TO NUMERIC:** Always use \`pd.to_numeric(data['col'], errors='coerce')\` before performing any arithmetic operations or statistical tests on a column.
2. **CHECK FOR NANS:** After casting, ALWAYS check if a column is empty or all-NaN using \`if data[col].isna().all():\`. If it is, PRINT a warning and SKIP that part of the analysis.
3. **CHECK TYPES:** Print \`data.dtypes\` and \`data.head()\` to the console at the start of the script to assist with debugging.

REQUIRED CODE STRUCTURE:
\`\`\`python
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import plotly.utils
import json
data = pd.read_csv('data.csv', skipinitialspace=True)

# 1. Debug info
print("COLUMNS:", data.columns.tolist())
print("TYPES:\\n", data.dtypes)

# 2. Defensive Casting & NaN Checking
cols_to_analyze = ['col1', 'col2'] 
valid_cols = []
for col in cols_to_analyze:
    if col in data.columns:
        data[col] = pd.to_numeric(data[col], errors='coerce')
        if not data[col].isna().all():
            valid_cols.append(col)
        else:
            print(f"SKIPPING {col}: Column contains no valid numeric data.")

# 3. Safe Analysis
if not valid_cols:
    print("CRITICAL: No valid columns found for analysis. Providing base summary instead.")
    stats_results = data.describe().to_dict()
else:
    # Proceed with analysis using ONLY valid_cols
    data_clean = data.dropna(subset=valid_cols)
    # ... analysis ...
\`\`\`

CODE GENERATION RULES:
1. Load data from 'data.csv' with \`skipinitialspace=True\`.
2. PRINT columns and dtypes first.
3. ALWAYS cast columns to numeric using \`pd.to_numeric(..., errors='coerce')\` and check for all-NaN before analysis.
4. MISSING VALUES: If you encounter NaNs in numeric data (common after casting), use \`sklearn.impute.SimpleImputer\` or choose models that handle NaNs naturally like \`sklearn.ensemble.HistGradientBoostingRegressor\`.
5. ALWAYS validate assumptions before parametric tests (Normality, Homogeneity).
6. ALWAYS report effect sizes (Cohen's d, r, OR) and p-values.
7. INTERACTIVE VISUALS: Use Plotly for all visualizations. 
   - ALWAYS include \`import plotly\` and \`import json\` at the top of the script.
   - Store plotly figures as JSON strings using \`json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)\`.
   - Assign the result to a variable named \`plotly_json\`.
8. Statistics MUST be assigned to the \`stats_results\` variable (a dictionary or dataframe).
9. **NO SELF-REFERENCES:** Do not create circular references or assign large objects (like the entire \`data\` dataframe) to keys within \`stats_results\`. Only store summaries, p-values, coefficients, and metrics.
10. **DO NOT WRITE CODE TO SAVE FILES.** The system handles this automatically.
11. DO NOT use fancy unicode characters in print statements.

⚠️ ANTI-HALLUCINATION GUARD ⚠️
- Use ONLY the columns provided in the AVAILABLE COLUMNS list.
- If all required columns for a modern statistical model are missing, perform a simple exploratory analysis (mean, median, correlation) on the columns that DO exist.
`.trim();

export const codeGeneratorTool = {
    name: "code_generator",
    async invoke(args: {
        dataProfile: any;
        analysisStrategy: any;
        failedCode?: string;
        lastError?: string;
        apiKeys?: any
    }) {
        const { dataProfile, analysisStrategy, failedCode, lastError, apiKeys } = args;

        const columnsArray = dataProfile?.data_summary?.columns || dataProfile?.columns || [];
        const columnNames = columnsArray.map((c: any) =>
            typeof c === 'string' ? c : c.name
        ).filter(Boolean);

        const userPrompt = `
⚠️ AVAILABLE COLUMNS (USE ONLY THESE): ${JSON.stringify(columnNames)}

DATA PROFILE:
${JSON.stringify(dataProfile, null, 2)}

ANALYSIS STRATEGY:
${JSON.stringify(analysisStrategy, null, 2)}

${failedCode ? `
⚠️ REPAIR REQUEST ⚠️
Previous code failed with this error:
\`\`\`
${lastError}
\`\`\`

The failed code was:
\`\`\`python
${failedCode}
\`\`\`

Please analyze the error and provide CORRECTED code that fixes it.
` : "Generate the Python analysis code using ONLY the columns listed above."}
    `.trim();

        try {
            const raw = await llmClient.call({
                systemPrompt: CODE_GENERATOR_SYSTEM_PROMPT,
                userPrompt,
                agentName: "sarvagya",
                apiKeys,
            });

            console.log("DEBUG - Code Generator Raw Output:", raw);

            // PARSING LOGIC for Markdown/Text format
            let explanation = "No explanation provided.";
            let code = "";

            // 1. Extract Code Block
            const codeBlockRegex = /```python\s*([\s\S]*?)```/;
            const codeMatch = raw.match(codeBlockRegex);

            if (codeMatch && codeMatch[1]) {
                code = codeMatch[1].trim();
            } else {
                // Fallback: try to find any code block
                const anyCodeRegex = /```\s*([\s\S]*?)```/;
                const anyMatch = raw.match(anyCodeRegex);
                if (anyMatch && anyMatch[1]) {
                    code = anyMatch[1].trim();
                } else {
                    // Worst case: assume the whole thing is code if it looks like python
                    console.warn("No code block found. Using raw output as code.");
                    code = raw.trim();
                }
            }

            // 2. Extract Explanation (everything before the code block)
            // Or look for "EXPLANATION:" prefix
            const explRegex = /EXPLANATION:\s*([\s\S]*?)(?=```|$)/i;
            const explMatch = raw.match(explRegex);
            if (explMatch && explMatch[1]) {
                explanation = explMatch[1].trim();
            }

            if (!code) {
                throw new Error("Failed to extract code from LLM response.");
            }

            return {
                agent_name: "Code Generator",
                code,
                explanation
            };

        } catch (error) {
            console.error("Code Generator error:", error);
            throw error;
        }
    },
};
