// lib/api-keys.ts
// BYOK (Bring Your Own Key) - Client-side API key management

export type Provider = "openai" | "groq" | "anthropic" | "perplexity" | "openrouter" | "github";

export interface ApiKeyConfig {
    provider: Provider;
    key: string;
    isValid?: boolean;
    lastValidated?: number;
}

export interface UserApiKeys {
    openai?: string;
    groq?: string;
    anthropic?: string;
    perplexity?: string;
    openrouter?: string;
    github?: string;
    ollamaBaseUrl?: string;
    preferredProvider?: Provider;
}

const STORAGE_KEY = "sarvagya_api_keys";

// Get all stored API keys
export function getApiKeys(): UserApiKeys {
    if (typeof window === "undefined") return {};
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
}

// Save API keys to localStorage
export function saveApiKeys(keys: UserApiKeys): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

// Get a specific provider key
export function getApiKey(provider: Provider): string | null {
    const keys = getApiKeys();
    return keys[provider] || null;
}

// Set a specific provider key
export function setApiKey(provider: Provider, key: string): void {
    const keys = getApiKeys();
    keys[provider] = key;
    saveApiKeys(keys);
}

// Remove a specific provider key
export function removeApiKey(provider: Provider): void {
    const keys = getApiKeys();
    delete keys[provider];
    saveApiKeys(keys);
}

// Get preferred provider (or first available)
export function getPreferredProvider(): Provider | null {
    const keys = getApiKeys();

    // Return user's preferred provider if set and has key
    if (keys.preferredProvider && keys[keys.preferredProvider]) {
        return keys.preferredProvider;
    }

    // Otherwise return first available
    const providers: Provider[] = ["groq", "openrouter", "openai", "anthropic", "perplexity"];
    for (const provider of providers) {
        if (keys[provider]) return provider;
    }

    return null;
}

// Set preferred provider
export function setPreferredProvider(provider: Provider): void {
    const keys = getApiKeys();
    keys.preferredProvider = provider;
    saveApiKeys(keys);
}

// Check if any keys are configured
export function hasAnyApiKey(): boolean {
    const keys = getApiKeys();
    return !!(keys.openai || keys.groq || keys.anthropic || keys.perplexity || keys.openrouter);
}

// Get available providers (those with keys)
export function getAvailableProviders(): Provider[] {
    const keys = getApiKeys();
    const available: Provider[] = [];
    if (keys.openai) available.push("openai");
    if (keys.groq) available.push("groq");
    if (keys.anthropic) available.push("anthropic");
    if (keys.perplexity) available.push("perplexity");
    if (keys.openrouter) available.push("openrouter");
    return available;
}

// Provider display info
export const PROVIDER_INFO: Record<Provider, {
    name: string;
    placeholder: string;
    docsUrl: string;
    color: string;
    freeOption: boolean;
}> = {
    openai: {
        name: "OpenAI",
        placeholder: "sk-...",
        docsUrl: "https://platform.openai.com/api-keys",
        color: "#10a37f",
        freeOption: false,
    },
    groq: {
        name: "Groq",
        placeholder: "gsk_...",
        docsUrl: "https://console.groq.com/keys",
        color: "#f55036",
        freeOption: true,
    },
    anthropic: {
        name: "Anthropic Claude",
        placeholder: "sk-ant-...",
        docsUrl: "https://console.anthropic.com/settings/keys",
        color: "#cc785c",
        freeOption: false,
    },
    perplexity: {
        name: "Perplexity",
        placeholder: "pplx-...",
        docsUrl: "https://docs.perplexity.ai/guides/getting-started",
        color: "#00a3ff",
        freeOption: false,
    },
    openrouter: {
        name: "OpenRouter",
        placeholder: "sk-or-v1-...",
        docsUrl: "https://openrouter.ai/keys",
        color: "#656565",
        freeOption: true,
    },
    github: {
        name: "GitHub Models",
        placeholder: "ghp_...",
        docsUrl: "https://github.com/marketplace/models",
        color: "#334155",
        freeOption: true,
    },
};

// Mask API key for display (show first 4 and last 4 chars)
export function maskApiKey(key: string): string {
    if (key.length <= 12) return "****";
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

// Clear all stored keys
export function clearAllApiKeys(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
}
