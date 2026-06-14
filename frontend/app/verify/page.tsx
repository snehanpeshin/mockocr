"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function VerifyPage() {
  const [message, setMessage] = useState("Verifying your Cleanote link...");
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    async function verify() {
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) {
        setMessage("This verification link is missing a token.");
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/api/beta/verify?token=${encodeURIComponent(token)}`);
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail ?? "Verification failed.");
        }
        const data = await response.json();
        window.localStorage.setItem("cleanote.betaAccess", JSON.stringify(data));
        setIsVerified(Boolean(data.beta_access));
        setMessage(
          data.beta_access
            ? "You are verified. Welcome to Cleanote."
            : "Your email is verified. You are on the waitlist."
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Verification failed.");
      }
    }

    verify();
  }, []);

  return (
    <main className="verify-shell">
      <section>
        <p className="eyebrow">Cleanote access</p>
        <h1>{isVerified ? "You are in." : "Checking your link"}</h1>
        <p>{message}</p>
        {isVerified ? (
          <a href="/app">Open Cleanote</a>
        ) : message.includes("waitlist") ? (
          <a href="/">Back to Cleanote</a>
        ) : (
          <Loader2 className="spin" aria-hidden="true" size={24} />
        )}
      </section>
    </main>
  );
}
