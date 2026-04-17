// lib/mcp/tools/stats/stats-schemas.ts
import { z } from "zod";

/**
 * Schema for Data Profiler Agent
 */
export const DataProfileSchema = z.object({
  agent_name: z.string().default("Data Profiler"),
  data_summary: z.object({
    columns: z.array(z.object({
      name: z.string(),
      type: z.enum(["numeric", "categorical", "datetime", "boolean", "text", "unknown"]),
      description: z.string().optional(),
      missing_pct: z.number().min(0).max(100),
      sample_values: z.array(z.any()).optional()
    })),
    row_count: z.number().int().min(0),
    col_count: z.number().int().min(0)
  }),
  domain_classification: z.object({
    domain: z.string(),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    rationale: z.string()
  }),
  quality_report: z.object({
    completeness: z.enum(["HIGH", "MEDIUM", "LOW"]),
    consistency: z.string(),
    anomalies: z.array(z.string())
  }),
  analytical_readiness: z.string()
});

/**
 * Schema for Statistical Reasoner Agent
 */
export const AnalysisStrategySchema = z.object({
  agent_name: z.string().default("Statistical Reasoner"),
  analysis_strategy: z.object({
    goal: z.string(),
    tests_proposed: z.array(z.object({
      test_name: z.string(),
      rationale: z.string(),
      hypotheses: z.object({
        null: z.string(),
        alternative: z.string()
      }),
      assumptions_to_validate: z.array(z.string())
    })),
    visualizations: z.array(z.object({
      type: z.string(),
      description: z.string()
    })),
    validation_criteria: z.object({
      significance_threshold: z.number().default(0.05),
      corrections: z.string().optional()
    })
  }),
  perspectives: z.array(z.object({
    angle: z.string(),
    test: z.string()
  })).optional(),
  clarifying_questions: z.array(z.string()).optional()
});

/**
 * Schema for Insight Synthesizer Agent
 */
export const InsightsSchema = z.object({
  agent_name: z.string().default("Insight Synthesizer"),
  findings: z.array(z.object({
    finding: z.string(),
    statistical_evidence: z.string(),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    interpretation: z.string(),
    caveats: z.string().optional()
  })),
  synthesis: z.string(),
  recommendations: z.array(z.string()),
  limitations: z.array(z.string())
});

/**
 * Schema for Report Generator Agent
 */
export const ReportSchema = z.object({
  agent_name: z.string().default("Report Generator"),
  report_markdown: z.string(),
  jupyter_notebook_structure: z.object({
    cells: z.array(z.object({
      type: z.enum(["markdown", "code"]),
      content: z.string()
    }))
  }),
  glossary: z.record(z.string()).optional()
});

export type DataProfile = z.infer<typeof DataProfileSchema>;
export type AnalysisStrategy = z.infer<typeof AnalysisStrategySchema>;
export type Insights = z.infer<typeof InsightsSchema>;
export type Report = z.infer<typeof ReportSchema>;
