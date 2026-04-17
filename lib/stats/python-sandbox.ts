// lib/stats/python-sandbox.ts
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

export interface SandboxResult {
    success: boolean;
    stdout: string;
    stderr: string;
    artifacts: Record<string, any>;
    error?: string;
}

export class PythonSandbox {
    private tempDir: string;

    constructor() {
        this.tempDir = path.join(os.tmpdir(), `sarvagya-stats-${Date.now()}`);
    }

    private async ensureTempDir() {
        try {
            await fs.mkdir(this.tempDir, { recursive: true });
        } catch (err) {
            console.error("Failed to create temp dir:", err);
        }
    }

    async run(code: string, inputData?: { filename: string; content: string }): Promise<SandboxResult> {
        await this.ensureTempDir();

        const scriptPath = path.join(this.tempDir, "analysis_script.py");
        const outputPath = path.join(this.tempDir, "output.json");

        // Wrap code to pipe results to JSON for easy JS parsing
        // Add column validation to catch LLM column hallucinations
        const wrappedCode = `
import json
import pandas as pd
import numpy as np
import plotly.utils as putils
import warnings
warnings.filterwarnings('ignore')

# === COLUMN SAFETY WRAPPER ===
_original_getitem = pd.DataFrame.__getitem__
_original_dropna = pd.DataFrame.dropna

def _safe_getitem(self, key):
    """Intercept column access to provide better error messages"""
    available_cols = list(self.columns)
    
    if isinstance(key, str):
        if (key not in self.columns):
            print(f"[WARNING] Column '{key}' not found. Available columns: {available_cols}")
            
            # 1. Try case-insensitive exact match
            matches = [c for c in available_cols if c.lower() == key.lower()]
            
            # 2. Try fuzzy match (substring)
            if not matches:
                matches = [c for c in available_cols if key.lower() in c.lower() or c.lower() in key.lower()]
            
            if matches:
                print(f"  -> Suggestion: using '{matches[0]}'")
                return _original_getitem(self, matches[0])
            
            # 3. Handle dot-access failure (e.g. data['column with spaces'] vs data.column_with_spaces)
            key_clean = key.replace(' ', '_').replace('.', '_')
            matches = [c for c in available_cols if c.replace(' ', '_').replace('.', '_').lower() == key_clean.lower()]
            if matches:
                print(f"  -> Found match via normalization: '{matches[0]}'")
                return _original_getitem(self, matches[0])

            print(f"  -> CRITICAL: No match found. Returning NaN series as fallback to avoid crash.")
            return pd.Series([np.nan] * len(self), name=key)
    elif isinstance(key, list):
        missing = [k for k in key if k not in self.columns]
        if missing:
            print(f"[HALLUCINATION WARNING] Columns not found in data: {missing}")
            print(f"  -> AVAILABLE COLUMNS: {available_cols}")
            print(f"  -> ACTION: Filling {missing} with NaNs to maintain row count ({len(self)}).")
            
            # Create a new DataFrame with missing columns as NaNs to preserve row count
            result = self.copy()
            for m in missing:
                result[m] = np.nan
            
            # Return only requested columns (some will be NaNs)
            return _original_getitem(result, key)
    
    return _original_getitem(self, key)

def _safe_dropna(self, *args, **kwargs):
    """Intercept dropna to filter out non-existent columns in subset"""
    if 'subset' in kwargs and kwargs['subset'] is not None:
        subset = kwargs['subset']
        if isinstance(subset, (list, tuple, pd.Index)):
            available = list(self.columns)
            valid_subset = [c for c in subset if c in available]
            missing = [c for c in subset if c not in available]
            if missing:
                print(f"[WARNING] dropna subset contains non-existent columns: {missing}")
                print(f"  -> Using valid columns: {valid_subset}")
                kwargs['subset'] = valid_subset
    return _original_dropna(self, *args, **kwargs)

pd.DataFrame.__getitem__ = _safe_getitem
pd.DataFrame.dropna = _safe_dropna

# Load data and print available columns for debugging
data = pd.read_csv('data.csv')
print("=== ANALYSIS START ===")
print(f"AVAILABLE COLUMNS: {data.columns.tolist()}")
print(f"DATA SHAPE: {data.shape}")
print("======================")

# === USER CODE START ===
${code}
# === USER CODE END ===

# === ROBUST SERIALIZATION ===
def _deep_clean(obj, seen=None):
    """Recursively clean objects for JSON serialization, breaking circles and pruning large/internal data."""
    if seen is None:
        seen = set()
    
    obj_id = id(obj)
    if obj_id in seen:
        return f"<Circular Reference @{obj_id}>"
    
    # Prune types we definitely don't want to serialize deeply or that cause issues
    if isinstance(obj, (pd.DataFrame, pd.Series)):
        # OPTIMIZATION: Only serialize a summary of the dataframe if it's large
        if len(obj) > 100:
            return {
                "type": "dataframe_summary",
                "shape": obj.shape,
                "columns": obj.columns.tolist(),
                "head": obj.head(5).to_dict(orient='records'),
                "description": obj.describe().to_dict(),
                "message": f"Dataframe truncated from {len(obj)} rows for performance."
            }
        return obj.to_dict(orient='records')
    
    if isinstance(obj, np.ndarray):
        if obj.size > 1000:
            return f"<Large Array {obj.shape} {obj.dtype}>"
        return obj.tolist()
    
    if isinstance(obj, (np.int64, np.int32, np.int16, np.int8)):
        return int(obj)
    if isinstance(obj, (np.float64, np.float32, np.float16)):
        # Handle NaN/Inf for JSON compliance
        val = float(obj)
        if np.isnan(val) or np.isinf(val):
            return str(val)
        return val
    if isinstance(obj, (np.bool_)):
        return bool(obj)
    
    if isinstance(obj, dict):
        seen.add(obj_id)
        # Prune keys starting with underscore to avoid internal state leakage
        return {str(k): _deep_clean(v, seen) for k, v in obj.items() if not str(k).startswith('_')}
    
    if isinstance(obj, (list, tuple, set)):
        seen.add(obj_id)
        # Limit list serialization size
        if len(obj) > 500:
            return [_deep_clean(i, seen) for i in list(obj)[:500]] + [f"... truncated {len(obj)-500} items"]
        return [_deep_clean(i, seen) for i in obj]
    
    if hasattr(obj, 'tolist'):
        return obj.tolist()
    
    # Fallback to string representation for complex/unknown types
    if type(obj).__module__ != 'builtins' and not isinstance(obj, (str, int, float, bool, type(None))):
        return str(obj)
        
    return obj

class SarvagyaJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        # This is now a fallback if _deep_clean missed something
        if isinstance(obj, (pd.DataFrame, pd.Series)):
            return obj.to_dict(orient='records')
        return str(obj)

# Automatically capture common result variables if they exist
_sarvagya_export_container = {}
_candidate_vars = ['stats_results', 'summary_metrics', 'analysis_results', 'results', 'output', 'model_metrics']
for var in _candidate_vars:
    if var in locals() and var != '_sarvagya_export_container':
        # Deep clean before assigning to avoid circularity in the container itself
        _sarvagya_export_container[var] = _deep_clean(locals()[var])

# Plotly special handling
if 'plotly_json' in locals():
    _sarvagya_export_container['plots'] = plotly_json

with open(r'${outputPath.replace(/\\/g, '/')}', 'w') as f:
    json.dump(_sarvagya_export_container, f, cls=SarvagyaJSONEncoder, indent=2)
`;

        try {
            if (inputData) {
                await fs.writeFile(path.join(this.tempDir, inputData.filename), inputData.content);
            }

            await fs.writeFile(scriptPath, wrappedCode);

            const { stdout, stderr } = await execAsync(`python "${scriptPath}"`, {
                cwd: this.tempDir,
                timeout: 30000
            });

            let artifacts = {};
            try {
                const outputJson = await fs.readFile(outputPath, "utf-8");
                artifacts = JSON.parse(outputJson);
            } catch (e) {
                console.warn("No output.json found or failed to parse. Code might not have produced explicit artifacts.");
            }

            return { success: true, stdout, stderr, artifacts };
        } catch (error: any) {
            return {
                success: false,
                stdout: error.stdout || "",
                stderr: error.stderr || "",
                artifacts: {},
                error: error.message
            };
        } finally {
            // Cleanup (optional, maybe keep for debugging if requested)
            // await fs.rm(this.tempDir, { recursive: true, force: true });
        }
    }
}

export const pythonSandbox = new PythonSandbox();
