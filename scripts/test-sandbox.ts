// scripts/test-sandbox.ts
import { pythonSandbox } from "../lib/stats/python-sandbox";

async function test() {
    console.log("Testing Python Sandbox...");

    const code = `
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.utils as putils
import json

df = pd.DataFrame({'x': [1, 2, 3], 'y': [10, 20, 30]})
fig = px.line(df, x='x', y='y', title='Test Plot')

plotly_json = json.dumps(fig, cls=putils.PlotlyJSONEncoder)
stats_results = {"mean_y": df['y'].mean(), "std_y": df['y'].std()}
    `;

    const result = await pythonSandbox.run(code);
    console.log("Success:", result.success);
    console.log("Artifacts:", JSON.stringify(result.artifacts, null, 2));
    if (result.error) console.error("Error:", result.error);
}

test().catch(console.error);
