// lib/user-service.ts
import { UserApiKeys } from "./api-keys";

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    provider: "email" | "google" | "github";
    apiKeys: UserApiKeys;
    createdAt: number;
}

const USERS_STORAGE_KEY = "sarvagya_users";
const SESSION_KEY = "sarvagya_session_user";

export const UserService = {
    // Get all users from storage
    getUsers(): UserProfile[] {
        if (typeof window === "undefined") return [];
        try {
            const stored = localStorage.getItem(USERS_STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    },

    // Save users to storage
    saveUsers(users: UserProfile[]): void {
        if (typeof window === "undefined") return;
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    },

    // Register a new user
    register(name: string, email: string, password?: string, provider: UserProfile['provider'] = 'email'): UserProfile | null {
        const users = this.getUsers();

        if (users.find(u => u.email === email)) {
            // User exists, return null or handle login
            return null;
        }

        const newUser: UserProfile = {
            id: Math.random().toString(36).substring(2, 11),
            name,
            email,
            provider,
            apiKeys: {}, // Start with empty keys
            createdAt: Date.now()
        };

        const updatedUsers = [...users, newUser];
        this.saveUsers(updatedUsers);
        return newUser;
    },

    // Login user
    login(email: string, password?: string): UserProfile | null {
        const users = this.getUsers();
        return users.find(u => u.email === email) || null;
    },

    // Set current session
    setSession(user: UserProfile): void {
        if (typeof window === "undefined") return;
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        // Also set the old session legacy key for compatibility
        localStorage.setItem("sarvagya_session", "enterprise_pro_session_" + user.id);
    },

    // Get current session user
    getCurrentUser(): UserProfile | null {
        if (typeof window === "undefined") return null;
        try {
            const stored = localStorage.getItem(SESSION_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    },

    // Logout
    logout(): void {
        if (typeof window === "undefined") return;
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem("sarvagya_session");
        window.location.href = "/login";
    },

    // Update user API keys
    updateApiKeys(userId: string, keys: UserApiKeys): void {
        const users = this.getUsers();
        const updatedUsers = users.map(u => {
            if (u.id === userId) {
                return { ...u, apiKeys: keys };
            }
            return u;
        });
        this.saveUsers(updatedUsers);

        // Also update current session if it's the same user
        const currentUser = this.getCurrentUser();
        if (currentUser && currentUser.id === userId) {
            this.setSession({ ...currentUser, apiKeys: keys });
        }
    }
};
