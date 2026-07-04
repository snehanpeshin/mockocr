"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";
import type { User } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { ReactNode } from "react";
import { auth, googleProvider, isFirebaseConfigured, requireFirebaseAuth } from "./firebase";

type AuthContextValue = {
  user: User | null;
  isAuthLoading: boolean;
  isFirebaseReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setIsAuthLoading(false);
      return undefined;
    }

    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsAuthLoading(false);
    });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(requireFirebaseAuth(), googleProvider);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    await createUserWithEmailAndPassword(requireFirebaseAuth(), email, password);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(requireFirebaseAuth(), email, password);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(requireFirebaseAuth(), email);
  }, []);

  const logout = useCallback(async () => {
    await signOut(requireFirebaseAuth());
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthLoading,
      isFirebaseReady: isFirebaseConfigured,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      sendPasswordReset,
      logout
    }),
    [
      user,
      isAuthLoading,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      sendPasswordReset,
      logout
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}

export function authErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";

  switch (code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/missing-password":
      return "Enter your password.";
    case "auth/weak-password":
      return "Use a password with at least 6 characters.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "The email or password is not correct.";
    case "auth/user-not-found":
      return "No Cleanote account was found for that email.";
    case "auth/email-already-in-use":
      return "An account already exists with that email. Try signing in instead.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Google sign-in was cancelled before it finished.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      if (error instanceof Error && error.message.includes("not configured")) {
        return "Cleanote sign-in is not configured yet. Add Firebase environment variables first.";
      }
      return "Something went wrong. Please try again.";
  }
}
