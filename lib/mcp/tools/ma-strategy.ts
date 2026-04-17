// lib/mcp/tools/ma-strategy.ts
// M&A Strategy module for deal structure, valuation, integration roadmap

interface CompanyProfile {
    name: string;
    revenue: number;
    ebitda: number;
    customerCount: number;
    acv: number; // Average Contract Value
    retentionRate: number;
    employeeCount: number;
    keyPersons?: string[];
}

interface DealStructure {
    type: "cash" | "stock" | "mixed" | "earnout";
    cashComponent?: number;
    stockComponent?: number;
    earnoutConditions?: string[];
    earnoutPercent?: number;
    closingTimeline: string;
}

interface ValuationRange {
    method: string;
    low: number;
    mid: number;
    high: number;
    rationale: string;
}

interface IntegrationPhase {
    phase: number;
    name: string;
    duration: string;
    activities: string[];
    risks: string[];
    kpis: string[];
}

interface MAAnalysis {
    strategicRationale: {
        primary: string;
        synergies: string[];
        threats_mitigated: string[];
    };
    valuationRange: ValuationRange[];
    recommendedPrice: number;
    dealStructure: DealStructure;
    integrationRoadmap: IntegrationPhase[];
    risks: Array<{ risk: string; probability: string; impact: string; mitigation: string }>;
    recommendation: "PROCEED" | "DONT" | "WAIT" | "CONDITIONAL";
    confidence: "HIGH" | "MEDIUM" | "LOW";
}

// Revenue multiple valuation
function revenueMultiple(revenue: number, multiple: number = 3): ValuationRange {
    return {
        method: "Revenue Multiple",
        low: revenue * (multiple * 0.7),
        mid: revenue * multiple,
        high: revenue * (multiple * 1.3),
        rationale: `${multiple}x revenue, typical for SaaS/tech`,
    };
}

// EBITDA multiple valuation
function ebitdaMultiple(ebitda: number, multiple: number = 8): ValuationRange {
    return {
        method: "EBITDA Multiple",
        low: ebitda * (multiple * 0.8),
        mid: ebitda * multiple,
        high: ebitda * (multiple * 1.2),
        rationale: `${multiple}x EBITDA, market standard`,
    };
}

// Customer value approach
function customerValueApproach(
    customerCount: number,
    acv: number,
    retentionRate: number
): ValuationRange {
    const ltv = acv * (retentionRate / (1 - retentionRate)); // Simplified LTV
    const totalValue = customerCount * ltv;

    return {
        method: "Customer LTV",
        low: totalValue * 0.6,
        mid: totalValue * 0.8,
        high: totalValue,
        rationale: `Based on customer LTV of $${(ltv / 1000).toFixed(0)}K`,
    };
}

// Generate integration roadmap
function generateIntegrationRoadmap(target: CompanyProfile): IntegrationPhase[] {
    return [
        {
            phase: 1,
            name: "Day 0-30: Stabilization",
            duration: "1 month",
            activities: [
                "Secure key personnel with retention bonuses",
                "Communicate to all employees",
                "Customer communication plan",
                "Legal entity integration prep",
            ],
            risks: ["Key person departure", "Customer uncertainty"],
            kpis: ["Key person retention %", "Customer churn rate"],
        },
        {
            phase: 2,
            name: "Month 2-3: Quick Wins",
            duration: "2 months",
            activities: [
                "Cross-sell opportunities identified",
                "Technology stack assessment",
                "Process alignment begun",
                "Combined go-to-market strategy",
            ],
            risks: ["Cultural misalignment", "Technology incompatibility"],
            kpis: ["Cross-sell pipeline", "Employee satisfaction"],
        },
        {
            phase: 3,
            name: "Month 4-6: Deep Integration",
            duration: "3 months",
            activities: [
                "Systems consolidation",
                "Team restructuring completed",
                "Full product integration",
                "Unified customer success",
            ],
            risks: ["Integration delays", "Revenue disruption"],
            kpis: ["Integration milestones", "Combined revenue growth"],
        },
        {
            phase: 4,
            name: "Month 7-12: Optimization",
            duration: "6 months",
            activities: [
                "Synergy realization tracking",
                "Cost optimization",
                "Market expansion",
                "Combined innovation roadmap",
            ],
            risks: ["Synergy shortfall", "Market share loss"],
            kpis: ["Synergy realization %", "Market share"],
        },
    ];
}

// Main M&A analysis
function analyzeAcquisition(
    target: CompanyProfile,
    context: { budget?: number; strategicPriority?: string; timeline?: string }
): MAAnalysis {
    // Calculate valuations
    const valuations: ValuationRange[] = [
        revenueMultiple(target.revenue, 3),
        ebitdaMultiple(target.ebitda, 8),
        customerValueApproach(target.customerCount, target.acv, target.retentionRate),
    ];

    // Recommended price (median of mids)
    const mids = valuations.map((v) => v.mid).sort((a, b) => a - b);
    const recommendedPrice = mids[Math.floor(mids.length / 2)];

    // Deal structure recommendation
    const dealStructure: DealStructure = {
        type: target.keyPersons && target.keyPersons.length > 0 ? "earnout" : "mixed",
        cashComponent: recommendedPrice * 0.7,
        stockComponent: recommendedPrice * 0.2,
        earnoutPercent: 10,
        earnoutConditions: ["24-month key person retention", "Revenue targets met"],
        closingTimeline: "60-90 days",
    };

    // Risk assessment
    const risks = [
        {
            risk: "Key person departure",
            probability: target.keyPersons && target.keyPersons.length > 0 ? "HIGH" : "MEDIUM",
            impact: "40% value erosion",
            mitigation: "2-year retention bonuses, earnout structure",
        },
        {
            risk: "Customer churn post-acquisition",
            probability: "MEDIUM",
            impact: "20% revenue at risk",
            mitigation: "Dedicated customer success team, early communication",
        },
        {
            risk: "Technology integration delays",
            probability: "MEDIUM",
            impact: "6-month synergy delay",
            mitigation: "Technical due diligence, phased integration",
        },
    ];

    // Recommendation logic
    const withinBudget = !context.budget || recommendedPrice <= context.budget;
    const recommendation: MAAnalysis["recommendation"] = withinBudget
        ? target.retentionRate >= 0.8
            ? "PROCEED"
            : "CONDITIONAL"
        : "WAIT";

    return {
        strategicRationale: {
            primary: context.strategicPriority || "Market expansion and customer acquisition",
            synergies: [
                `Revenue synergy: ${target.customerCount} customers for cross-sell`,
                `Cost synergy: Shared infrastructure`,
                `Capability: ${target.name} product/tech stack`,
            ],
            threats_mitigated: ["Competitor threat neutralized", "Market share protection"],
        },
        valuationRange: valuations,
        recommendedPrice,
        dealStructure,
        integrationRoadmap: generateIntegrationRoadmap(target),
        risks,
        recommendation,
        confidence: withinBudget && target.retentionRate >= 0.85 ? "HIGH" : "MEDIUM",
    };
}

// Export M&A strategy tool
export const maStrategyTool = {
    name: "ma_strategy",
    description: "Analyze M&A opportunities with valuation, deal structure, and integration planning",

    async invoke(args: {
        action: "analyze" | "valuation" | "integration_roadmap";
        target?: CompanyProfile;
        context?: { budget?: number; strategicPriority?: string; timeline?: string };
    }) {
        const { action, target, context } = args;

        switch (action) {
            case "analyze":
                if (!target) throw new Error("Analysis requires target company profile");
                return {
                    action: "analyze",
                    result: analyzeAcquisition(target, context || {}),
                };

            case "valuation":
                if (!target) throw new Error("Valuation requires target company profile");
                return {
                    action: "valuation",
                    revenueMultiple: revenueMultiple(target.revenue),
                    ebitdaMultiple: ebitdaMultiple(target.ebitda),
                    customerValue: customerValueApproach(
                        target.customerCount,
                        target.acv,
                        target.retentionRate
                    ),
                };

            case "integration_roadmap":
                if (!target) throw new Error("Integration roadmap requires target profile");
                return {
                    action: "integration_roadmap",
                    phases: generateIntegrationRoadmap(target),
                };

            default:
                throw new Error(`Unknown action: ${action}`);
        }
    },
};

export { analyzeAcquisition, revenueMultiple, ebitdaMultiple, customerValueApproach };
export type { CompanyProfile, DealStructure, ValuationRange, IntegrationPhase, MAAnalysis };
