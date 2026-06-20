"use client";

import { ArrowRight, Check, Loader2, LockKeyhole, Search, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function BetaPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Student");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function joinBeta(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE}/api/beta/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail ?? "Could not join the beta.");
      }

      const data = await response.json();
      if (data.status === "already_verified" && data.beta_access) {
        setMessage("This email is already verified. Open Cleanote when you are ready.");
        return;
      }
      setMessage(
        data.beta_access
          ? "Check your email for your Cleanote access link."
          : "You are on the waitlist. Check your email to verify your spot."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not join the beta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="landing-shell">
      <section className="landing-hero">
        <div className="landing-copy">
          <p className="eyebrow">Cleanote beta</p>
          <h1>Turn handwritten notes into searchable knowledge.</h1>
          <p>
            Upload a notebook page and get clean, structured text you can edit,
            search, and export.
          </p>
          <div className="landing-actions">
            <a href="#beta">Join beta <ArrowRight aria-hidden="true" size={18} /></a>
            <a className="secondary-link" href="/">Open app</a>
          </div>
        </div>

        <form className="beta-form" id="beta" onSubmit={joinBeta}>
          <div>
            <p className="eyebrow">First 50 users</p>
            <h2>Request access</h2>
          </div>
          <label>
            <span>Name</span>
            <input required onChange={(event) => setName(event.target.value)} value={name} />
          </label>
          <label>
            <span>Email</span>
            <input
              required
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label>
            <span>Role</span>
            <select onChange={(event) => setRole(event.target.value)} value={role}>
              <option>Student</option>
              <option>Researcher</option>
              <option>Professional</option>
            </select>
          </label>
          <button className="primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? <Loader2 className="spin" aria-hidden="true" size={18} /> : null}
            <span>{isSubmitting ? "Sending link" : "Get email link"}</span>
          </button>
          {message ? <p className="message">{message}</p> : null}
        </form>
      </section>

      <section className="landing-band">
        <div>
          <Search aria-hidden="true" size={22} />
          <h2>Search handwritten notes</h2>
          <p>Find concepts buried in notebook pages, lab notes, and lecture scans.</p>
        </div>
        <div>
          <Sparkles aria-hidden="true" size={22} />
          <h2>Clean structure</h2>
          <p>Textract reads the page. Bedrock helps clean headings, bullets, and terms.</p>
        </div>
        <div>
          <LockKeyhole aria-hidden="true" size={22} />
          <h2>Passwordless beta</h2>
          <p>Join with your email and click a secure link to access Cleanote.</p>
        </div>
      </section>

      <section className="demo-strip">
        <div>
          <p className="eyebrow">Before</p>
          <p>messy notebook photo, hard to search, hard to reuse</p>
        </div>
        <Check aria-hidden="true" size={24} />
        <div>
          <p className="eyebrow">After</p>
          <p>clean headings, bullets, searchable text, export-ready notes</p>
        </div>
      </section>

      <p className="company-line">
        Cleanote, a product of Karigari Home LLC · <a href="/privacy">Privacy Policy</a> ·{" "}
        <a href="/refund">Refund Policy</a>
      </p>
    </main>
  );
}
