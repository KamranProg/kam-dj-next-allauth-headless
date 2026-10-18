"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getUserClient, type SessionUser } from "@/data/user/get-user-client";

type User = SessionUser;

type AuthContextType = {
  user: User | null;
  isLoggedIn: boolean;
  loading: boolean;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchUser() {
    const fetched = await getUserClient();
    setUser(fetched);
  }

  useEffect(() => {
    let active = true;
    getUserClient()
      .then((fetched) => {
        if (active) setUser(fetched);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        loading,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
