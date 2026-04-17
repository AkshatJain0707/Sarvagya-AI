export async function validateJSONSchema(data: Record<string, any>, schema: Record<string, string>) {
    // Simple validation for now, can be expanded
    for (const key in schema) {
        if (schema[key] === "string" && typeof data[key] !== "string") {
            throw new Error(`Invalid type for ${key}: expected string`);
        }
        if (schema[key] === "object" && typeof data[key] !== "object") {
            throw new Error(`Invalid type for ${key}: expected object`);
        }
    }
}
