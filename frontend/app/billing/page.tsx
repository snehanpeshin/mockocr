"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { getApiBase } from "../apiBase";

const API_BASE = getApiBase();
const PREMIUM_ACCESS_KEY = "cleanote.premiumAccess";
const PURCHASE_CONVERSION_ID = "AW-18335791503/hqCKCN_C9NUcEI_zl6dE";
const PURCHASE_CONVERSION_STORAGE_PREFIX = "cleanote.purchaseConversionSent.";

const PRODUCTS = [
  {
    key: "cleanote_one_time_premium",
    name: "One-Time Premium",
    price: "$0.99",
    description: "Support Cleanote during launch with a simple one-time premium payment.",
    cta: "Get premium"
  }
];

export default function BillingPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checkoutStatus, setCheckoutStatus] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const sessionId = params.get("session_id") ?? "";
    setCheckoutStatus(status);
    if (status === "success") {
      window.localStorage.setItem(PREMIUM_ACCESS_KEY, "true");
      setMessage("Premium is active on this browser. You can return to the scanner.");
      const conversionKey = `${PURCHASE_CONVERSION_STORAGE_PREFIX}${sessionId || "unknown"}`;
      if (!window.sessionStorage.getItem(conversionKey)) {
        window.sessionStorage.setItem(conversionKey, "true");
        const gtag = (window as typeof window & {
          gtag?: (event: "event", action: string, params: Record<string, string>) => void;
        }).gtag;
        gtag?.("event", "conversion", {
          send_to: PURCHASE_CONVERSION_ID,
          transaction_id: sessionId
        });
      }
    } else if (status === "cancelled") {
      setMessage("Checkout was cancelled. You can try again when you are ready.");
    }
  }, []);

  async function startCheckout(event: FormEvent<HTMLFormElement>, productKey: string) {
    event.preventDefault();
    setIsLoading(productKey);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE}/api/stripe/checkout-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_key: productKey,
          customer_email: email.trim() || null,
          success_url: `${window.location.origin}/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${window.location.origin}/billing?status=cancelled`
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "Could not start checkout.");
      }
      window.location.href = payload.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start checkout.");
    } finally {
      setIsLoading(null);
    }
  }

  return (
    <main className="landing-shell">
      <section className="landing-hero billing-hero">
        <div className="landing-copy">
          <p className="eyebrow">Cleanote checkout</p>
          <h1>Get Cleanote Premium.</h1>
          <p>
            Premium is an optional one-time $0.99 web support payment during launch. Secure
            Checkout is powered by Stripe, owned by Karigari Home LLC, and branded as Cleanote.
          </p>
          <p>
            The Cleanote iPhone app is currently free on the App Store. This direct web payment
            is separate from mobile app downloads and does not purchase or install the mobile app.
          </p>
          <p className="company-line">
            Cleanote, a product of Karigari Home LLC · <a href="/privacy">Privacy Policy</a> ·{" "}
            <a href="/refund">Refund Policy</a>
          </p>
          {checkoutStatus === "success" ? (
            <a className="primary billing-return-link" href="/app">
              Return to scanner
            </a>
          ) : null}
        </div>

        <div className="billing-panel">
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="student@example.com"
              type="email"
              value={email}
            />
          </label>

          {PRODUCTS.map((product) => (
            <form
              className="billing-card"
              key={product.key}
              onSubmit={(event) => startCheckout(event, product.key)}
            >
              <div>
                <h2>{product.name}</h2>
                <strong className="billing-price">{product.price}</strong>
                <p>{product.description}</p>
              </div>
              <button className="primary" disabled={isLoading !== null} type="submit">
                {isLoading === product.key ? (
                  <Loader2 aria-hidden="true" className="spin" size={18} />
                ) : (
                  <ArrowRight aria-hidden="true" size={18} />
                )}
                <span>{isLoading === product.key ? "Opening Stripe" : product.cta}</span>
              </button>
            </form>
          ))}

          {message ? <p className="message">{message}</p> : null}
        </div>
      </section>
    </main>
  );
}
