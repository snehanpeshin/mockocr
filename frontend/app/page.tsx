"use client";

import { ArrowRight, Check, Loader2, Play, Smartphone, Upload } from "lucide-react";
import { FormEvent, useState } from "react";
import { getApiBase } from "./apiBase";

const API_BASE = getApiBase();
const APP_STORE_URL = "https://apps.apple.com/app/cleanote/id6784403759";
const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.cleanote.app&utm_source=cleanote_website";

const STEPS = [
  "Capture a page",
  "Get editable text",
  "Review and export"
];

export default function LandingPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Student");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitInterest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE}/api/beta/request`, {
        body: JSON.stringify({ name, email, role }),
        headers: { "Content-Type": "application/json" },
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.detail ?? "Could not save your details.");
      }

      if (payload.beta_access) {
        window.localStorage.setItem("cleanote.betaAccess", JSON.stringify(payload));
      }

      setMessage("Thanks. Your details were saved. We will follow up as Cleanote improves.");
      setName("");
      setEmail("");
      setRole("Student");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your details.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="one-page-site">
      <header className="one-page-nav">
        <a className="one-page-brand" href="/">
          <img alt="" src="/cleanote-icon.png" />
          <span>Cleanote</span>
        </a>
        <nav aria-label="Cleanote links">
          <a href="#apps">Apps</a>
          <a href="#tablet">Tablet</a>
          <a href="/app">Web scanner</a>
        </nav>
      </header>

      <section className="one-page-hero">
        <div className="one-page-copy">
          <p className="one-page-kicker">AI note capture</p>
          <h1>Convert handwritten notes into searchable documents.</h1>
          <p>
            Cleanote helps students, parents, researchers, and professionals turn paper notes,
            worksheets, and annotated pages into editable text.
          </p>

          <div className="one-page-actions" id="apps">
            <a className="store-button ios" href={APP_STORE_URL} rel="noreferrer" target="_blank">
              <Smartphone aria-hidden="true" size={18} />
              App Store
            </a>
            <a className="store-button android" href={GOOGLE_PLAY_URL} rel="noreferrer" target="_blank">
              <Play aria-hidden="true" size={18} />
              Google Play
            </a>
            <a className="text-button" href="/app">
              Try web scanner <ArrowRight aria-hidden="true" size={17} />
            </a>
          </div>

          <div className="one-page-steps" aria-label="How Cleanote works">
            {STEPS.map((step, index) => (
              <span key={step}>
                <strong>{index + 1}</strong>
                {step}
              </span>
            ))}
          </div>
        </div>

        <aside className="one-page-card" aria-label="Join Cleanote updates">
          <div className="mini-scan">
            <div className="mini-paper">
              <span />
              <span />
              <strong>(a+b)² = a² + b² + 2ab</strong>
              <span />
            </div>
            <div className="mini-output">
              <Check aria-hidden="true" size={18} />
              Editable draft ready
            </div>
          </div>

          <form className="simple-interest-form" onSubmit={submitInterest}>
            <h2>Get Cleanote updates</h2>
            <p>One short form for beta access, product updates, and tablet interest.</p>
            <label htmlFor="interest-name">Name</label>
            <input
              autoComplete="name"
              id="interest-name"
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
            <label htmlFor="interest-email">Email</label>
            <input
              autoComplete="email"
              id="interest-email"
              maxLength={254}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
            <label htmlFor="interest-role">I am a</label>
            <select id="interest-role" onChange={(event) => setRole(event.target.value)} value={role}>
              <option>Student</option>
              <option>Parent</option>
              <option>Researcher</option>
              <option>Teacher</option>
              <option>Professional</option>
            </select>
            <button className="form-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? <Loader2 aria-hidden="true" className="spin" size={18} /> : null}
              {isSubmitting ? "Saving" : "Join updates"}
            </button>
            {message ? <p className="form-message" role="status">{message}</p> : null}
          </form>
        </aside>
      </section>

      <section className="one-page-strip" aria-label="Cleanote highlights">
        <span><Upload aria-hidden="true" size={17} /> Photos, PDFs, screenshots</span>
        <span><Check aria-hidden="true" size={17} /> Edit before using</span>
        <span><ArrowRight aria-hidden="true" size={17} /> TXT, DOCX, PDF export</span>
      </section>

      <section className="tablet-note" id="tablet">
        <img alt="Cleanote writing tablet concept" src="/cleanote-tablet-concept.jpg" />
        <div>
          <p className="one-page-kicker">Coming soon</p>
          <h2>Cleanote+ writing tablet bundle</h2>
          <p>
            A simple 8.5-inch reusable writing tablet concept for kids, homework, and quick notes.
            Join the form above if you want updates.
          </p>
        </div>
      </section>

      <footer className="one-page-footer">
        <span>© {new Date().getFullYear()} KARIGARI HOME LLC DBA CLEANOTE</span>
        <nav aria-label="Legal links">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/support">Support</a>
          <a href="/delete-account">Delete data</a>
        </nav>
      </footer>
    </main>
  );
}
