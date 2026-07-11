"use client";

import { ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authErrorMessage, useAuth } from "../lib/auth";

type AuthMode = "signin" | "signup" | "reset";

export default function LoginPage() {
  const router = useRouter();
  const {
    user,
    isAuthLoading,
    isFirebaseReady,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset
  } = useAuth();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthLoading && user) {
      router.push("/app");
    }
  }, [isAuthLoading, router, user]);

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      if (mode === "reset") {
        await sendPasswordReset(email.trim());
        setMessage("If an account exists for this email, a password reset link has been sent.");
        return;
      }

      if (mode === "signup") {
        await signUpWithEmail(email.trim(), password);
      } else {
        await signInWithEmail(email.trim(), password);
      }
      setMessage("Signed in. Opening Cleanote...");
      router.push("/app");
    } catch (nextError) {
      setError(authErrorMessage(nextError));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitGoogle() {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      await signInWithGoogle();
      setMessage("Signed in. Opening Cleanote...");
      router.push("/app");
    } catch (nextError) {
      setError(authErrorMessage(nextError));
    } finally {
      setIsSubmitting(false);
    }
  }

  const heading =
    mode === "signup"
      ? "Create your Cleanote account"
      : mode === "reset"
        ? "Reset your password"
        : "Sign in to Cleanote";

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <a className="auth-back" href="/">
          <ArrowLeft aria-hidden="true" size={17} />
          Back to Cleanote
        </a>

        <div className="auth-brand">
          <img alt="" src="/cleanote-icon.png" />
          <div>
            <p className="doc-kicker">Cleanote account</p>
            <h1>{heading}</h1>
          </div>
        </div>

        <p className="auth-copy">
          Use your account for supported web features. Some notes may remain only in this browser
          unless cloud saving is explicitly shown. The iPhone app remains available through the App Store.
        </p>

        {!isFirebaseReady ? (
          <p className="auth-warning">
            Firebase Authentication is not configured yet. Add the public Firebase environment
            variables before enabling sign-in.
          </p>
        ) : null}

        {mode !== "reset" ? (
          <>
            <button className="google-button" disabled={isSubmitting || !isFirebaseReady} onClick={submitGoogle}>
              {isSubmitting ? <Loader2 aria-hidden="true" className="spin" size={18} /> : <ShieldCheck aria-hidden="true" size={18} />}
              Continue with Google
            </button>
            <div className="auth-divider">
              <span>or</span>
            </div>
          </>
        ) : null}

        <form className="auth-form" onSubmit={submitEmail}>
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="student@example.com"
              required
              type="email"
              value={email}
            />
          </label>

          {mode !== "reset" ? (
            <label>
              <span>Password</span>
              <input
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={6}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                required
                type="password"
                value={password}
              />
            </label>
          ) : null}

          <button className="doc-primary auth-submit" disabled={isSubmitting || !isFirebaseReady} type="submit">
            {isSubmitting ? <Loader2 aria-hidden="true" className="spin" size={18} /> : <Mail aria-hidden="true" size={18} />}
            {mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}
          </button>
        </form>

        {error ? <p className="auth-error">{error}</p> : null}
        {message ? <p className="auth-success">{message}</p> : null}

        <div className="auth-switcher">
          {mode === "signin" ? (
            <>
              <button type="button" onClick={() => setMode("signup")}>Create an account</button>
              <button type="button" onClick={() => setMode("reset")}>Forgot password?</button>
            </>
          ) : (
            <button type="button" onClick={() => setMode("signin")}>Back to sign in</button>
          )}
        </div>
      </section>
    </main>
  );
}
