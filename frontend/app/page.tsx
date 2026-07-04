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
    text: "Capture notebook pages, PDFs, screenshots, worksheets, and rough study material."
  },
  {
    label: "Clean",
    text: "Turn cluttered handwriting and annotations into organized, readable output."
  },
  {
    label: "Export",
    text: "Review the result, copy text, save notes, or export when you need a usable document."
  }
];

const HOW_IT_WORKS = [
  "Upload or capture your notes",
  "Let Cleanote organize the content",
  "Review, export, or save the cleaned version"
];

const USE_CASES = [
  "Students cleaning lecture notes",
  "Researchers organizing PDFs",
  "Professionals cleaning meeting notes",
  "Creators turning rough drafts into readable content"
];

const FAQS = [
  {
    question: "Is Cleanote free?",
    answer: "Cleanote for iPhone is available as a one-time $0.99 App Store download."
  },
  {
    question: "Do I need an account?",
    answer:
      "You can use the iOS app after download. A Cleanote account is useful for supported sync, web access, and future account features."
  },
  {
    question: "Can I use Cleanote on the web?",
    answer:
      "The website supports account access and may support web features depending on the current product version."
  },
  {
    question: "Why is the app $0.99?",
    answer: "The small one-time price helps support development, maintenance, and new features."
  },
  {
    question: "Is my data private?",
    answer:
      "Cleanote explains what data is stored and how it is used in the Privacy Policy."
  },
  {
    question: "Where can I get support?",
    answer: "Visit the Support page for help with the app, website, OCR results, or your account."
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

      <section className="doc-hero simple-hero">
        <div className="doc-hero-copy">
          <p className="doc-kicker">Cleanote for iPhone</p>
          <h1>Clean notes from messy documents.</h1>
          <p>
            Cleanote helps you turn cluttered notes, PDFs, screenshots, and study material into
            organized, readable outputs.
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
          <p className="app-price-note">One-time $0.99 iPhone download. Account access is optional.</p>
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
              <strong>Cluttered worksheet</strong>
              <span>PDF · screenshot · handwritten page</span>
            </div>
            <div className="phone-card active">
              <Sparkles aria-hidden="true" size={28} />
              <strong>Cleaned output</strong>
              <span>Readable sections, extracted text, review-ready notes</span>
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
        <span><Upload aria-hidden="true" size={18} /> Capture document mess</span>
        <span><Search aria-hidden="true" size={18} /> Make notes searchable</span>
        <span><Lock aria-hidden="true" size={18} /> Keep review in your hands</span>
      </section>

      <section className="doc-process-section" id="how-it-works">
        <div className="doc-section-heading">
          <p className="doc-kicker">How it works</p>
          <h2>From rough capture to usable notes.</h2>
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
          <h2>Built for people with real paper and rough files.</h2>
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
          <h2>Cleanote for iPhone is available as a one-time $0.99 App Store download.</h2>
          <p>
            An account is optional and helps with supported web access, syncing, and future features.
          </p>
        </div>
        <a className="doc-primary" href={APP_STORE_URL} rel="noreferrer" target="_blank">
          <Smartphone aria-hidden="true" size={18} />
          Download on the App Store
        </a>
      </section>

      <section className="doc-tablet-band simple-tablet" aria-label="Cleanote tablet bundle preorder">
        <div className="doc-tablet-copy">
          <p className="doc-kicker">Coming soon · early preorder interest open</p>
          <h2>Cleanote+ writing tablet bundle.</h2>
          <p>
            A simple 8.5-inch writing tablet concept for kids, tutors, and families who want
            less paper clutter and a cleaner way to save handwritten learning.
          </p>
          <div className="doc-price-callout">
            <strong>Coming soon</strong>
            <span>Early tablet bundle interest is captured for launch updates.</span>
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
            placeholder="Who would use it? Example: my child for homework, tutoring students, lab notes..."
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
          <h2>Questions before you download.</h2>
        </div>
        <div className="faq-grid">
          {FAQS.map((faq) => (
            <article key={faq.question}>
              <h3>{faq.question}</h3>
              <p>
                {faq.question === "Is my data private?" ? (
                  <>
                    Cleanote explains what data is stored and how it is used in the{" "}
                    <a href="/privacy">Privacy Policy</a>.
                  </>
                ) : faq.question === "Where can I get support?" ? (
                  <>
                    Visit the <a href="/support">Support page</a> for help with the app, website,
                    OCR results, or your account.
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
          <span>Cleanote turns messy notes and documents into readable outputs.</span>
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
