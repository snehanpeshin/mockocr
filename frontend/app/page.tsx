"use client";

import {
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  Lock,
  LogOut,
  Search,
  Smartphone,
  Sparkles,
  Upload
} from "lucide-react";
import { FormEvent, useState } from "react";
import { getApiBase } from "./apiBase";
import { authErrorMessage, useAuth } from "./lib/auth";

const API_BASE = getApiBase();
const APP_STORE_URL = "https://apps.apple.com/bz/app/cleanote/id6784403759";

const VISUAL_STEPS = [
  {
    label: "Import",
    text: "Add notes, PDFs, or screenshots."
  },
  {
    label: "Clean",
    text: "Make rough pages readable."
  },
  {
    label: "Export",
    text: "Copy, save, or export."
  }
];

const HOW_IT_WORKS = [
  "Capture notes",
  "Clean the content",
  "Save or export"
];

const USE_CASES = [
  "Lecture notes",
  "Research PDFs",
  "Meeting notes",
  "Rough drafts"
];

const FAQS = [
  {
    question: "Is Cleanote free?",
    answer: "Cleanote for iPhone is available as a one-time $0.99 App Store download."
  },
  {
    question: "Do I need an account?",
    answer: "No. An account is only needed for supported web features."
  },
  {
    question: "Can I use Cleanote on the web?",
    answer: "Yes, supported web access is available after sign in."
  },
  {
    question: "Why is the app $0.99?",
    answer: "It keeps Cleanote simple: one small download price."
  },
  {
    question: "Is my data private?",
    answer: "See the Privacy Policy for details."
  },
  {
    question: "Where can I get support?",
    answer: "Use the Support page for help."
  }
];

export default function LandingPage() {
  const { user, isAuthLoading, logout } = useAuth();
  const [preorderName, setPreorderName] = useState("");
  const [preorderEmail, setPreorderEmail] = useState("");
  const [preorderRole, setPreorderRole] = useState("Parent");
  const [preorderQuantity, setPreorderQuantity] = useState("1");
  const [preorderUseCase, setPreorderUseCase] = useState("");
  const [preorderMessage, setPreorderMessage] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [isSubmittingPreorder, setIsSubmittingPreorder] = useState(false);

  const userLabel = user?.displayName || user?.email || "Cleanote user";

  async function submitLogout() {
    setAuthMessage(null);
    try {
      await logout();
    } catch (error) {
      setAuthMessage(authErrorMessage(error));
    }
  }

  async function submitTabletPreorder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingPreorder(true);
    setPreorderMessage(null);

    try {
      const response = await fetch(`${API_BASE}/api/tablet/preorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: preorderName,
          email: preorderEmail,
          role: preorderRole,
          quantity: Number(preorderQuantity) || 1,
          use_case: preorderUseCase
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail ?? "Could not save preorder interest.");
      }
      setPreorderMessage(payload.message ?? "Thanks. Your preorder interest was saved.");
      setPreorderUseCase("");
    } catch (error) {
      setPreorderMessage(error instanceof Error ? error.message : "Could not save preorder interest.");
    } finally {
      setIsSubmittingPreorder(false);
    }
  }

  return (
    <main className="site-shell document-site">
      <header className="doc-nav">
        <a className="doc-brand" href="/">
          <img alt="" src="/cleanote-icon.png" />
          <span>Cleanote</span>
        </a>
        <nav aria-label="Cleanote navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="/app">Web access</a>
          <a href="/support">Support</a>
        </nav>
        <div className="doc-auth-actions">
          {!isAuthLoading && user ? (
            <>
              <span className="doc-user-pill">{user.photoURL ? <img alt="" src={user.photoURL} /> : null}{userLabel}</span>
              <button className="doc-logout" onClick={submitLogout} type="button">
                <LogOut aria-hidden="true" size={16} />
                Logout
              </button>
            </>
          ) : (
            <a className="doc-signin-link" href="/login">Sign in</a>
          )}
          <a className="doc-nav-cta app-store-mini" href={APP_STORE_URL} rel="noreferrer" target="_blank">
            Download on the App Store
          </a>
        </div>
      </header>
      {authMessage ? <p className="doc-auth-message">{authMessage}</p> : null}

      <section className="doc-hero simple-hero video-hero">
        <div className="hero-video-layer" aria-hidden="true">
          <video autoPlay loop muted playsInline aria-hidden="true" poster="/cleanote-tablet-concept.jpg">
            <source src="/videos/productivity-video.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="hero-video-overlay" aria-hidden="true" />
        <div className="doc-hero-copy">
          <p className="doc-kicker">Cleanote for iPhone</p>
          <h1>Clean notes from messy documents.</h1>
          <p>
            Turn notes, PDFs, screenshots, and study material into readable output.
          </p>
          <div className="doc-actions">
            <a className="doc-primary app-store-primary" href={APP_STORE_URL} rel="noreferrer" target="_blank">
              <Smartphone aria-hidden="true" size={18} />
              Download on the App Store
            </a>
            <a className="doc-secondary" href={user ? "/app" : "/login"}>
              {user ? "Try Cleanote Web" : "Sign in"}
            </a>
          </div>
          <p className="app-price-note">$0.99 one-time iPhone download.</p>
          <div className="simple-benefits" aria-label="Cleanote highlights">
            {["Messy notes", "PDFs and screenshots", "Study material", "Readable exports"].map((benefit) => (
              <span key={benefit}>
                <Check aria-hidden="true" size={16} />
                {benefit}
              </span>
            ))}
          </div>
        </div>

        <div className="product-visual" aria-label="Cleanote product preview">
          <div className="phone-mockup">
            <div className="phone-topbar" />
            <div className="phone-card">
              <FileText aria-hidden="true" size={28} />
              <strong>Messy input</strong>
              <span>PDF · photo · handwritten page</span>
            </div>
            <div className="phone-card active">
              <Sparkles aria-hidden="true" size={28} />
              <strong>Cleaned output</strong>
              <span>Readable text and notes</span>
            </div>
          </div>
          <div className="visual-step-stack">
            {VISUAL_STEPS.map((step) => (
              <article key={step.label}>
                <strong>{step.label}</strong>
                <span>{step.text}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="doc-trust-bar simple-trust" aria-label="Cleanote highlights">
        <span><Upload aria-hidden="true" size={18} /> Capture</span>
        <span><Search aria-hidden="true" size={18} /> Search</span>
        <span><Lock aria-hidden="true" size={18} /> Review</span>
      </section>

      <section className="doc-process-section" id="how-it-works">
        <div className="doc-section-heading">
          <p className="doc-kicker">How it works</p>
          <h2>Three simple steps.</h2>
        </div>
        <div className="launch-step-grid">
          {HOW_IT_WORKS.map((step, index) => (
            <article key={step}>
              <span>{index + 1}</span>
              <h3>{step}</h3>
            </article>
          ))}
        </div>
      </section>

      <section className="doc-use-case-band launch-use-cases">
        <div>
          <p className="doc-kicker">Use cases</p>
          <h2>For everyday study and work.</h2>
        </div>
        <div className="doc-use-case-list">
          {USE_CASES.map((useCase) => (
            <span key={useCase}><Check aria-hidden="true" size={15} />{useCase}</span>
          ))}
        </div>
      </section>

      <section className="pricing-panel" id="pricing">
        <div>
          <p className="doc-kicker">Pricing</p>
          <h2>One-time $0.99 iPhone download.</h2>
          <p>Optional account for supported web access.</p>
        </div>
        <a className="doc-primary" href={APP_STORE_URL} rel="noreferrer" target="_blank">
          <Smartphone aria-hidden="true" size={18} />
          Download on the App Store
        </a>
      </section>

      <section className="doc-tablet-band simple-tablet" aria-label="Cleanote tablet bundle preorder">
        <div className="doc-tablet-copy">
          <p className="doc-kicker">Coming soon</p>
          <h2>Cleanote+ writing tablet bundle.</h2>
          <p>
            A simple writing tablet concept for cleaner handwritten learning.
          </p>
          <div className="doc-price-callout">
            <strong>Coming soon</strong>
            <span>Join the early interest list.</span>
          </div>
        </div>
        <figure className="doc-tablet-figure">
          <img alt="Cleanote tablet bundle concept" src="/cleanote-tablet-concept.jpg" />
        </figure>
        <form className="tablet-preorder-form" onSubmit={submitTabletPreorder}>
          <h3>Join preorder interest</h3>
          <input
            onChange={(event) => setPreorderName(event.target.value)}
            placeholder="Name"
            required
            value={preorderName}
          />
          <input
            onChange={(event) => setPreorderEmail(event.target.value)}
            placeholder="Email"
            required
            type="email"
            value={preorderEmail}
          />
          <div className="tablet-preorder-row">
            <select onChange={(event) => setPreorderRole(event.target.value)} value={preorderRole}>
              <option>Parent</option>
              <option>Student</option>
              <option>Tutor</option>
              <option>Teacher</option>
              <option>Professional</option>
            </select>
            <input
              min="1"
              max="50"
              onChange={(event) => setPreorderQuantity(event.target.value)}
              type="number"
              value={preorderQuantity}
            />
          </div>
          <textarea
            onChange={(event) => setPreorderUseCase(event.target.value)}
            placeholder="How would you use it?"
            rows={3}
            value={preorderUseCase}
          />
          <button className="primary tablet-preorder-button" disabled={isSubmittingPreorder} type="submit">
            {isSubmittingPreorder ? "Saving" : "Save my interest"}
          </button>
          <a className="tablet-premium-link" href={APP_STORE_URL} rel="noreferrer" target="_blank">
            Download the iPhone app <ArrowRight aria-hidden="true" size={16} />
          </a>
          {preorderMessage ? <p className="tablet-preorder-message">{preorderMessage}</p> : null}
        </form>
      </section>

      <section className="faq-section" aria-label="Cleanote FAQ">
        <div className="doc-section-heading">
          <p className="doc-kicker">FAQ</p>
          <h2>Quick answers.</h2>
        </div>
        <div className="faq-grid">
          {FAQS.map((faq) => (
            <article key={faq.question}>
              <h3>{faq.question}</h3>
              <p>
                {faq.question === "Is my data private?" ? (
                  <>
                    See the <a href="/privacy">Privacy Policy</a>.
                  </>
                ) : faq.question === "Where can I get support?" ? (
                  <>
                    Visit <a href="/support">Support</a>.
                  </>
                ) : (
                  faq.answer
                )}
              </p>
            </article>
          ))}
        </div>
      </section>

      <footer className="doc-footer">
        <div>
          <img alt="" src="/cleanote-icon.png" />
          <span>Clean notes from messy documents.</span>
        </div>
        <nav aria-label="Footer links">
          <a href="/privacy"><Lock aria-hidden="true" size={15} /> Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/support">Support</a>
          <a href="/support">Contact</a>
          <a href={APP_STORE_URL} rel="noreferrer" target="_blank">App Store</a>
          <a href="/app"><BookOpen aria-hidden="true" size={15} /> App</a>
        </nav>
      </footer>
    </main>
  );
}
