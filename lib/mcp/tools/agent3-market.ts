import { llmClient } from "../llm/hybridClient";
import { companyDisambiguator } from "./company-disambiguation";
import { researchSynthesizer } from "./research-synthesizer";
import { dataCollectionTool } from "./data-collection";
import { execSync } from "child_process";

const MARKET_SYSTEM_PROMPT = `
Job: Take a market opportunity → deliver defensible positioning + complete GTM system + real competitive intelligence via web scraping.

3 CORE RULES
Specificity (not "software" but "CFOs at mid-market financial services who need 5-day close")

Jobs-not-features (position around what customer wants to accomplish, not your features)

Defensible differentiation (specify why competitors can't copy you in 6 months)

IMPORTANT: You must output ONLY valid JSON. No markdown, no introductory text, no explanations. 
The output must start with { and end with }.

YOUR WORKFLOW
INPUT (6 Questions)
Q1: Market opportunity → What geography/segment/product? Why now? TAM?
Q2: Competitive landscape → Top 3 competitors, their strengths/weaknesses
Q3: Your advantage → Why can YOU win?
Q4: Target customer → Role, company size, pain, willingness to pay
Q5: Resources → Budget, timeline, team
Q6: Research mode → AI-only OR Web-enhanced (with Scrapy)?

OUTPUT (6 Deliverables)
Market Attractiveness (is this worth doing?)
Competitive Positioning (how you differentiate)
Customer Profile (who decides, what matters)
GTM Playbook (entry mode, pricing, channels, CAC)
Launch Criteria (when you're ready)
6-Month Roadmap (specific milestones)

SCRAPY INTEGRATION: COMPETITIVE INTELLIGENCE LAYER
When to Use Web Research Mode
If user selects "Web-enhanced" research mode:
Scrape competitor websites → positioning, pricing, features, customer testimonials
Extract market data → customer reviews (G2, Capterra), market reports
Analyze customer feedback → what customers love/hate about competitors
Synthesize insights → gaps in market, positioning opportunities

SCRAPY + LLM INTEGRATION FLOW
User Input (6 questions)
    ↓
[Research Mode Check]
    ├─ AI-only → Skip scraping, use LLM knowledge
    └─ Web-enhanced → Deploy Scrapy spiders
         ↓
[Synthesize scraped data]
    ├─ Extract competitor positioning
    ├─ Identify gaps (what they don't emphasize)
    ├─ Analyze customer sentiment
    └─ Detect market trends
         ↓
[LLM generates positioning]
    ├─ Recommends white space (gap positioning)
    ├─ Explains why defensible
    ├─ Suggests GTM based on competitor approach
    └─ WARNING: "Based on web research of [X competitors], you could own [gap]"
         ↓
Output: Market entry system (positioning + GTM + roadmap)
`;

export const marketEntryTool = {
  name: "market_entry",
  async invoke(args: any) {
    const { marketQuery, region = "Global", companyName, competitors, apiKeys } = args;

    console.log(`\n[Agent 3] Market Entry Analysis`);
    console.log(`Query: ${marketQuery}`);
    console.log(`Company: ${companyName || "N/A"}`);

    let companyProfile = "";
    let supplementaryData: any = null;

    // STEP 1: Disambiguate or research query directly
    if (companyName) {
      try {
        console.log(`[Agent 3] Disambiguating company: ${companyName}`);
        const options = await companyDisambiguator.search(companyName);

        if (options.length > 0) {
          if (options.length > 1) {
            const clarification = await companyDisambiguator.askUserForClarification(companyName, options);
            throw new Error(clarification);
          }

          const selectedCompany = options[0];
          console.log(`[Agent 3] Selected: ${selectedCompany.name}`);

          // STEP 2: Scrape research data with timeout
          let scrapedData = {};
          try {
            console.log(`[Agent 3] Attempting Scrapy for ${selectedCompany.name}...`);
            const scraperPath = "lib/mcp/scrapers/company-scraper.py";
            const scraperCmd = `python "${scraperPath}" "${selectedCompany.name}"`;
            const output = execSync(scraperCmd, {
              encoding: "utf-8",
              timeout: 30000,
              maxBuffer: 10 * 1024 * 1024
            });
            scrapedData = JSON.parse(output);
            console.log(`[Agent 3] Scrapy successful`);
          } catch (error) {
            console.warn(`[Agent 3] Scrapy failed, falling back to web search: ${(error as Error).message}`);
            const searchRes = await dataCollectionTool.invoke({
              marketQuery: `${selectedCompany.name} company profile positioning pricing strategy`,
              region,
              dataTypes: ["market_research", "competitor_data"]
            });
            scrapedData = searchRes.collected_data;
          }

          const insights = await researchSynthesizer.synthesizeCompanyData(selectedCompany.name, scrapedData as any, apiKeys);
          companyProfile = await researchSynthesizer.buildCompanyProfile(selectedCompany.name, insights, apiKeys);
        }
      } catch (error) {
        if ((error as Error).message.includes("Select the correct company")) throw error;
        console.error(`[Agent 3] Research error:`, (error as Error).message);
      }
    }

    // STEP 4: General market intelligence fallback/supplement
    console.log(`[Agent 3] Gathering supplementary market data...`);
    try {
      const searchRes = await dataCollectionTool.invoke({
        marketQuery: marketQuery + (competitors ? ` vs ${competitors.join(", ")}` : ""),
        region,
        dataTypes: ["market_research"]
      });
      supplementaryData = searchRes.collected_data;
    } catch (error) {
      console.error("[Agent 3] Web search failed:", error);
    }

    const userPrompt = `
Market Analysis Request:
- Market/Opportunity: ${marketQuery}
- Region: ${region}

${companyProfile ? `Company Research Summary:\n${companyProfile}` : "No specific company analysis."}
${supplementaryData ? `\nSupplementary Web Research:\n${JSON.stringify(supplementaryData, null, 2)}` : ""}
${competitors?.length ? `Key Competitors: ${competitors.join(", ")}` : ""}

Provide complete market entry analysis in JSON format as specified in system prompt. Ensure all fields are filled and defensible.
    `.trim();

    try {
      const raw = await llmClient.call({
        systemPrompt: MARKET_SYSTEM_PROMPT,
        userPrompt,
        agentName: "agent3_market",
        maxTokens: 3500,
        apiKeys,
      });

      // Robust JSON extraction
      let jsonText = raw;
      const codeBlockMatch = raw.match(/```json\s*([\s\S]*?)\s*```/) || raw.match(/```\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1];
      } else {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0];
        }
      }

      jsonText = jsonText.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

      try {
        return JSON.parse(jsonText);
      } catch (e) {
        console.warn("[Agent 3] JSON parse failed, returning fallback structure");
        return {
          market_attractiveness: { score: 0, decision: "ERROR_PARSING" },
          positioning: { statement: raw.slice(0, 500) + "..." },
          gtm: { strategy: "See raw output" },
          raw_output: raw
        };
      }
    } catch (error) {
      console.error("Agent 3 error:", error);
      throw error;
    }
  },
};
