// lib/mcp/tools/financial-modeling.ts
// Financial modeling utilities for DCF, scenario analysis, sensitivity

interface DCFInputs {
    revenue: number;
    revenueGrowthRate: number;
    operatingMargin: number;
    taxRate: number;
    capexPercent: number;
    discountRate: number;
    terminalGrowthRate: number;
    yearsToProject: number;
}

interface ScenarioCase {
    name: string;
    probability: number;
    assumptions: Record<string, number>;
    npv: number;
    irr?: number;
}

interface SensitivityResult {
    variable: string;
    baseValue: number;
    variations: Array<{
        value: number;
        changePercent: number;
        npv: number;
        npvChange: number;
    }>;
}

// DCF Valuation Builder
function calculateDCF(inputs: DCFInputs): {
    yearlyProjections: Array<{ year: number; revenue: number; fcf: number; pvFcf: number }>;
    terminalValue: number;
    pvTerminal: number;
    enterpriseValue: number;
} {
    const {
        revenue,
        revenueGrowthRate,
        operatingMargin,
        taxRate,
        capexPercent,
        discountRate,
        terminalGrowthRate,
        yearsToProject,
    } = inputs;

    const yearlyProjections: Array<{
        year: number;
        revenue: number;
        fcf: number;
        pvFcf: number;
    }> = [];

    let cumulativePV = 0;
    let currentRevenue = revenue;

    if (yearsToProject < 1) {
        throw new Error("yearsToProject must be at least 1");
    }

    for (let year = 1; year <= yearsToProject; year++) {
        currentRevenue = currentRevenue * (1 + revenueGrowthRate);
        const ebit = currentRevenue * operatingMargin;
        const nopat = ebit * (1 - taxRate);
        const capex = currentRevenue * capexPercent;
        const fcf = nopat - capex; // Simplified, assumes D&A ≈ CapEx
        const discountFactor = Math.pow(1 + discountRate, year);
        const pvFcf = fcf / discountFactor;

        yearlyProjections.push({ year, revenue: currentRevenue, fcf, pvFcf });
        cumulativePV += pvFcf;
    }

    // Terminal value using perpetuity growth
    const lastFCF = yearlyProjections[yearlyProjections.length - 1].fcf;
    const terminalValue = (lastFCF * (1 + terminalGrowthRate)) / (discountRate - terminalGrowthRate);
    const pvTerminal = terminalValue / Math.pow(1 + discountRate, yearsToProject);

    return {
        yearlyProjections,
        terminalValue,
        pvTerminal,
        enterpriseValue: cumulativePV + pvTerminal,
    };
}

// Scenario Analysis Builder
function buildScenarios(
    baseInputs: DCFInputs,
    scenarios: Array<{ name: string; probability: number; adjustments: Partial<DCFInputs> }>
): ScenarioCase[] {
    return scenarios.map((scenario) => {
        const adjustedInputs = { ...baseInputs, ...scenario.adjustments };
        const dcf = calculateDCF(adjustedInputs);

        return {
            name: scenario.name,
            probability: scenario.probability,
            assumptions: scenario.adjustments as Record<string, number>,
            npv: dcf.enterpriseValue,
        };
    });
}

// Probability-weighted valuation
function weightedValuation(scenarios: ScenarioCase[]): number {
    return scenarios.reduce((sum, s) => sum + s.npv * s.probability, 0);
}

// Sensitivity Analysis
function sensitivityAnalysis(
    baseInputs: DCFInputs,
    variable: keyof DCFInputs,
    variationPercents: number[] = [-20, -10, 0, 10, 20]
): SensitivityResult {
    const baseValue = baseInputs[variable] as number;
    const baseDCF = calculateDCF(baseInputs);
    const baseNPV = baseDCF.enterpriseValue;

    const variations = variationPercents.map((pct) => {
        const newValue = baseValue * (1 + pct / 100);
        const adjustedInputs = { ...baseInputs, [variable]: newValue };
        const dcf = calculateDCF(adjustedInputs);

        return {
            value: newValue,
            changePercent: pct,
            npv: dcf.enterpriseValue,
            npvChange: ((dcf.enterpriseValue - baseNPV) / baseNPV) * 100,
        };
    });

    return { variable, baseValue, variations };
}

// Export financial modeling tool
export const financialModelingTool = {
    name: "financial_modeling",
    description: "Build DCF valuations, scenario analysis, and sensitivity tables",

    async invoke(args: {
        action: "dcf" | "scenarios" | "sensitivity" | "weighted_valuation";
        inputs?: DCFInputs;
        scenarios?: Array<{ name: string; probability: number; adjustments: Partial<DCFInputs> }>;
        variable?: keyof DCFInputs;
        variationPercents?: number[];
    }) {
        const { action, inputs, scenarios, variable, variationPercents } = args;

        switch (action) {
            case "dcf":
                if (!inputs) throw new Error("DCF requires inputs");
                return {
                    action: "dcf",
                    result: calculateDCF(inputs),
                    summary: `Enterprise Value: $${(calculateDCF(inputs).enterpriseValue / 1e6).toFixed(1)}M`,
                };

            case "scenarios":
                if (!inputs || !scenarios) throw new Error("Scenarios requires inputs and scenarios");
                const scenarioResults = buildScenarios(inputs, scenarios);
                return {
                    action: "scenarios",
                    result: scenarioResults,
                    weighted: weightedValuation(scenarioResults),
                    summary: `Weighted valuation: $${(weightedValuation(scenarioResults) / 1e6).toFixed(1)}M`,
                };

            case "sensitivity":
                if (!inputs || !variable) throw new Error("Sensitivity requires inputs and variable");
                return {
                    action: "sensitivity",
                    result: sensitivityAnalysis(inputs, variable, variationPercents),
                };

            case "weighted_valuation":
                if (!inputs || !scenarios) throw new Error("Weighted valuation requires scenarios");
                const builtScenarios = buildScenarios(inputs, scenarios);
                return {
                    action: "weighted_valuation",
                    value: weightedValuation(builtScenarios),
                };

            default:
                throw new Error(`Unknown action: ${action}`);
        }
    },
};

export { calculateDCF, buildScenarios, sensitivityAnalysis, weightedValuation };
export type { DCFInputs, ScenarioCase, SensitivityResult };
