"use client";

import {
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  Lock,
  Search,
  Smartphone,
  Sparkles,
  Upload
} from "lucide-react";
import { FormEvent, useState } from "react";
import { getApiBase } from "./apiBase";

const API_BASE = getApiBase();
const APP_STORE_URL = "https://apps.apple.com/bz/app/cleanote/id6784403759";

const BENEFITS = [
  "Capture full pages and PDFs",
  "Keep equations, labels, and side notes",
  "Search, edit, copy, or export"
];

const OUTCOMES = [
  "Less retyping after class",
  "Cleaner study material",
  "Notes you can actually find later"
];

export default function LandingPage() {
  const [preorderName, setPreorderName] = useState("");
  const [preorderEmail, setPreorderEmail] = useState("");
  const [preorderRole, setPreorderRole] = useState("Parent");
  const [preorderQuantity, setPreorderQuantity] = useState("1");
  const [preorderUseCase, setPreorderUseCase] = useState("");
  const [preorderMessage, setPreorderMessage] = useState<string | null>(null);
  const [isSubmittingPreorder, setIsSubmittingPreorder] = useState(false);

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
          <a href="/app">App</a>
          <a href="/billing">Premium</a>
          <a href="/support">Support</a>
        </nav>
        <a className="doc-nav-cta" href="/app">
          Open scanner <ArrowRight aria-hidden="true" size={17} />
        </a>
      </header>

      <section className="doc-hero simple-hero">
        <div className="doc-hero-copy">
          <p className="doc-kicker">Handwriting OCR</p>
          <h1>Convert handwritten notes into searchable documents.</h1>
          <p>
            Cleanote helps students, parents, researchers, and professionals turn notebook pages,
            worksheets, PDFs, and annotated handouts into editable text they can review and use.
          </p>
          <div className="doc-actions">
            <a className="doc-primary" href="/app">
              <Upload aria-hidden="true" size={18} />
              Try Cleanote
            </a>
            <a className="doc-secondary" href="/billing">
              Premium $9.99/mo
            </a>
            <a className="app-store-badge" href={APP_STORE_URL} rel="noreferrer" target="_blank">
              <Smartphone aria-hidden="true" size={22} />
              <span>
                <small>Download on the</small>
                App Store
              </span>
            </a>
          </div>
          <div className="simple-benefits" aria-label="Cleanote benefits">
            {BENEFITS.map((benefit) => (
              <span key={benefit}>
                <Check aria-hidden="true" size={16} />
                {benefit}
              </span>
            ))}
          </div>
          <div className="doc-outcomes" aria-label="What Cleanote helps with">
            {OUTCOMES.map((outcome) => (
              <span key={outcome}>{outcome}</span>
            ))}
          </div>
        </div>

        <div className="doc-tool-preview simple-preview" aria-label="Cleanote preview">
          <div className="doc-drop-preview">
            <FileText aria-hidden="true" size={38} />
            <strong>Drop a note here</strong>
            <span>Image · PDF · DOCX</span>
          </div>
          <div className="simple-output-preview">
            <p>Result</p>
            <strong>Text you can work with</strong>
            <span>Cleanote keeps readable written material visible, including side notes, labels, and equations.</span>
          </div>
        </div>
      </section>

      <section className="doc-trust-bar simple-trust" aria-label="Cleanote highlights">
        <span><Sparkles aria-hidden="true" size={18} /> Finds more page detail</span>
        <span><Search aria-hidden="true" size={18} /> Makes notes searchable</span>
        <span><Lock aria-hidden="true" size={18} /> Keeps review in your hands</span>
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
            <strong>$9.99/month</strong>
            <span>Premium access now. Early tablet bundle interest captured for launch updates.</span>
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
          <a className="tablet-premium-link" href="/billing">
            Get Premium now <ArrowRight aria-hidden="true" size={16} />
          </a>
          {preorderMessage ? <p className="tablet-preorder-message">{preorderMessage}</p> : null}
        </form>
      </section>

      <footer className="doc-footer">
        <div>
          <img alt="" src="/cleanote-icon.png" />
          <span>Cleanote, a product of Karigari Home LLC</span>
        </div>
        <nav aria-label="Footer links">
          <a href="/privacy"><Lock aria-hidden="true" size={15} /> Privacy</a>
          <a href="/refund">Refunds</a>
          <a href="/support">Support</a>
          <a href={APP_STORE_URL} rel="noreferrer" target="_blank">iPhone App</a>
          <a href="/app"><BookOpen aria-hidden="true" size={15} /> App</a>
        </nav>
      </footer>
    </main>
  );
}
