"use client";

import {
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  Loader2,
  Play,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload
} from "lucide-react";
import { FormEvent, useState } from "react";
import { getApiBase } from "./apiBase";

const API_BASE = getApiBase();
const APP_STORE_URL = "https://apps.apple.com/app/cleanote/id6784403759";
const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.cleanote.app&utm_source=cleanote_website";

const STEPS = ["Write", "Capture", "Review"];

const STORY = [
  {
    icon: BookOpen,
    title: "Write naturally",
    copy: "Kids keep practicing on paper: worksheets, equations, sketches, and class notes."
  },
  {
    icon: Camera,
    title: "Capture clearly",
    copy: "Cleanote guides the scan so pages are brighter, straighter, and easier for AI to read."
  },
  {
    icon: Sparkles,
    title: "Review together",
    copy: "Parents and teachers get cleaner digital notes, uncertainty cues, and study-ready text."
  }
];

const MODES = ["Exact transcription", "Clean correction", "Study review"];

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
          <a href="/handwriting-to-text/">Handwriting</a>
          <a href="/homework-scanner/">Homework</a>
          <a href="#tablet">Tablet</a>
          <a href="/app">Web scanner</a>
        </nav>
      </header>

      <section className="one-page-hero">
        <div className="one-page-copy">
          <p className="one-page-kicker">Handwriting-first AI for learning</p>
          <h1>Turn handwritten school pages into searchable learning records.</h1>
          <p>
            Cleanote helps kids and students keep writing by hand, then gives families and teachers
            a safer way to capture, review, and organize what was written.
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
          <img
            alt="Crayon-style worksheet being scanned into digital notes"
            className="crayon-hero-image"
            src="/cleanote-crayon-hero.png"
          />
          <div className="mini-scan">
            <div className="mini-output">
              <Check aria-hidden="true" size={18} />
              Worksheets, equations, drawings, notes, and review
            </div>
          </div>

          <form className="simple-interest-form" onSubmit={submitInterest}>
            <h2>Parent or teacher updates</h2>
            <p>For beta access, family use, classroom ideas, and tablet updates.</p>
            <label htmlFor="interest-name">Parent or teacher name</label>
            <input
              autoComplete="name"
              id="interest-name"
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
            <label htmlFor="interest-email">Parent or teacher email</label>
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
              <option>Parent / Family</option>
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
        <span><Upload aria-hidden="true" size={17} /> Homework pages</span>
        <span><Check aria-hidden="true" size={17} /> Study notes</span>
        <span><ArrowRight aria-hidden="true" size={17} /> Kid-friendly capture</span>
      </section>

      <section className="learning-story" aria-label="Cleanote learning workflow">
        {STORY.map(({ icon: Icon, title, copy }) => (
          <article key={title}>
            <Icon aria-hidden="true" size={22} />
            <h2>{title}</h2>
            <p>{copy}</p>
          </article>
        ))}
      </section>

      <section className="trust-note" aria-label="Cleanote AI trust modes">
        <div>
          <p className="one-page-kicker">Built for trust</p>
          <h2>More than handwriting OCR: a reviewable learning layer.</h2>
          <p>
            Cleanote separates transcription from interpretation, so a student&apos;s original work
            stays traceable before AI turns it into searchable notes, summaries, or quizzes.
          </p>
        </div>
        <div className="mode-list" aria-label="Cleanote modes">
          {MODES.map((mode) => (
            <span key={mode}>
              <ShieldCheck aria-hidden="true" size={17} />
              {mode}
            </span>
          ))}
        </div>
      </section>

      <section className="tablet-note" id="tablet">
        <img alt="Cleanote writing tablet concept" src="/cleanote-tablet-concept.jpg" />
        <div>
          <p className="one-page-kicker">Coming soon</p>
          <h2>Cleanote+ tablet bundle for screen-light practice</h2>
          <p>
            A reusable writing tablet plus Cleanote capture creates a simple loop: write by hand,
            scan once, and build a searchable learning record over time.
          </p>
        </div>
      </section>

      <footer className="one-page-footer">
        <span>© {new Date().getFullYear()} KARIGARI HOME LLC DBA CLEANOTE</span>
        <nav aria-label="Legal links">
          <a href="/handwriting-to-text/">Handwriting to text</a>
          <a href="/homework-scanner/">Homework scanner</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/support">Support</a>
          <a href="/delete-account">Delete data</a>
        </nav>
      </footer>
    </main>
  );
}
