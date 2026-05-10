import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { API_URL } from "../config";

export type User = {
  id: number;
  provider: string;
  providerId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  matches?: number;
  won?: number;
  lost?: number;
  rating?: number;
  lastActive?: string;
  githubId?: string;
  twitterId?: string;
  discordId?: string;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  login: (provider: "google" | "github") => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        credentials: "include",
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = (provider: "google" | "github") => {
    window.location.href = `${API_URL}/auth/${provider}`;
  };

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setUser(null);
    }
  };

  const updateProfile = async (updates: Partial<User>) => {
    const res = await fetch(`${API_URL}/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updatedUser = await res.json();
      setUser(updatedUser);
    } else {
      console.log("failed to update user", res.statusText);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, logout, checkAuth, updateProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}

