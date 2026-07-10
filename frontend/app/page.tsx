"use client";

import {
  ArrowRight,
  Check,
  FileText,
  Languages,
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
const KASHMIRI_TRANSLATOR_URL = "https://apps.apple.com/us/app/kashmiri-translator/id6786125105";

const VISUAL_STEPS = [
  {
    label: "Vision input",
    text: "Capture photos, PDFs, or screenshots."
  },
  {
    label: "OCR + AI review",
    text: "Clean the scan and check the text."
  },
  {
    label: "Structured output",
    text: "Edit, save, search, or export."
  }
];

const HOW_IT_WORKS = [
  {
    label: "Capture",
    text: "Upload a photo, screenshot, PDF, or document."
  },
  {
    label: "Understand",
    text: "Cleanote reads handwriting, printed text, and annotated material."
  },
  {
    label: "Use",
    text: "Edit, search, copy, save, or export the result."
  }
];

const USE_CASES = [
  "Lecture notes",
  "Research PDFs",
  "Meeting notes",
  "Rough drafts"
];

const CAPABILITIES = [
  {
    title: "Handwriting OCR",
    text: "Turn rough written pages into editable text."
  },
  {
    title: "Printed + annotated files",
    text: "Handle clean printed documents and handwritten marks together."
  },
  {
    title: "Searchable archive",
    text: "Save notes so old pages become easier to find."
  },
  {
    title: "Export-ready output",
    text: "Copy, edit, and prepare notes for study or work."
  }
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
  const currentYear = new Date().getFullYear();
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
          <a href="#capabilities">Capabilities</a>
          <a href="/kashmiri-translator">Kashmiri Translator</a>
          <a href="#pricing">Pricing</a>
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
          <p className="doc-kicker">AI vision for handwritten work</p>
          <h1>Convert messy notes into searchable documents.</h1>
          <p>
            Cleanote uses OCR, scan cleanup, and AI review to turn handwriting,
            PDFs, screenshots, and study material into editable output.
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
          <p className="app-price-note">$0.99 one-time iPhone download. Web workspace available after sign in.</p>
          <div className="simple-benefits" aria-label="Cleanote highlights">
            {["Handwriting OCR", "Printed files", "Annotated PDFs", "Searchable exports"].map((benefit) => (
              <span key={benefit}>
                <Check aria-hidden="true" size={16} />
                {benefit}
              </span>
            ))}
          </div>
        </div>

        <div className="product-visual" aria-label="Cleanote product preview">
          <div className="vision-console">
            <div className="vision-console-header">
              <span />
              <strong>Cleanote Vision</strong>
              <small>ready</small>
            </div>
            <div className="vision-document">
              <div className="vision-doc-line wide" />
              <div className="vision-doc-line" />
              <div className="vision-equation">(a+b)² = a² + b² + 2ab</div>
              <div className="vision-markbox" />
              <div className="vision-doc-line short" />
              <div className="vision-doc-line medium" />
            </div>
            <div className="vision-output-grid">
              <article>
                <FileText aria-hidden="true" size={20} />
                <strong>Text</strong>
                <span>editable</span>
              </article>
              <article>
                <Search aria-hidden="true" size={20} />
                <strong>Archive</strong>
                <span>searchable</span>
              </article>
              <article>
                <Sparkles aria-hidden="true" size={20} />
                <strong>Review</strong>
                <span>AI-assisted</span>
              </article>
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
        <span><Upload aria-hidden="true" size={18} /> Vision capture</span>
        <span><Search aria-hidden="true" size={18} /> Searchable notes</span>
        <span><Lock aria-hidden="true" size={18} /> User-reviewed output</span>
      </section>

      <section className="doc-process-section" id="how-it-works">
        <div className="doc-section-heading">
          <p className="doc-kicker">Pipeline</p>
          <h2>From scan to usable document.</h2>
        </div>
        <div className="launch-step-grid">
          {HOW_IT_WORKS.map((step, index) => (
            <article key={step.label}>
              <span>{index + 1}</span>
              <h3>{step.label}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="vision-capabilities-section" id="capabilities">
        <div className="doc-section-heading">
          <p className="doc-kicker">Capabilities</p>
          <h2>Built for notes that do not look like perfect documents.</h2>
          <p>
            Cleanote is tuned for the messy middle: handwriting, printed pages,
            equations, screenshots, PDFs, and annotated worksheets.
          </p>
        </div>
        <div className="vision-capability-grid">
          {CAPABILITIES.map((capability) => (
            <article key={capability.title}>
              <Sparkles aria-hidden="true" size={20} />
              <h3>{capability.title}</h3>
              <p>{capability.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="doc-use-case-band launch-use-cases">
        <div>
          <p className="doc-kicker">Use cases</p>
          <h2>For real notes in study and work.</h2>
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

      <section className="product-family-band" aria-label="More apps from Cleanote">
        <div className="product-family-copy">
          <p className="doc-kicker">Also from Cleanote</p>
          <h2>Kashmiri Translator</h2>
          <p>
            A focused English to Kashmiri translator for quick written translations on iPhone.
          </p>
          <aside className="translator-news-card" aria-label="Kashmiri Translator news">
            <span>App Store milestone</span>
            <strong>Kashmiri Translator recently reached #34 in Apple paid apps.</strong>
            <p>Thank you to early users supporting language tools from Cleanote.</p>
          </aside>
          <div className="product-family-actions">
            <a className="doc-primary" href={KASHMIRI_TRANSLATOR_URL} rel="noreferrer" target="_blank">
              <Smartphone aria-hidden="true" size={18} />
              View on the App Store
            </a>
            <a className="doc-secondary" href="/kashmiri-translator">
              Learn more
              <ArrowRight aria-hidden="true" size={16} />
            </a>
          </div>
        </div>
        <div className="translator-product-card" aria-hidden="true">
          <div className="translator-card-media" />
          <div className="translator-card-content">
            <Languages size={28} />
            <strong>Kashmiri Translator</strong>
            <span>English to Kashmiri on iPhone</span>
          </div>
        </div>
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
        <a className="doc-footer-brand" href="/">
          <img alt="" src="/cleanote-icon.png" />
          <span>Clean notes from messy documents.</span>
        </a>
        <nav aria-label="Footer links">
          <a href="/privacy"><Lock aria-hidden="true" size={15} /> Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/support">Support</a>
          <a href="/support">Contact</a>
          <a href={APP_STORE_URL} rel="noreferrer" target="_blank">App Store</a>
          <a href="/kashmiri-translator">Kashmiri Translator</a>
          <a href="/mobile"><Smartphone aria-hidden="true" size={15} /> App</a>
        </nav>
        <p className="doc-footer-copyright">
          © {currentYear} KARIGARI HOME LLC DBA CLEANOTE. All Rights Reserved.
        </p>
      </footer>
    </main>
  );
}
