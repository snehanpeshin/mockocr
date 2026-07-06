"use client";

import { FormEvent, useState } from "react";

const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

function validateSupportEmail(email: string) {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return "Email is required.";
  }
  if (trimmedEmail.length > MAX_EMAIL_LENGTH) {
    return `Email must be ${MAX_EMAIL_LENGTH} characters or fewer.`;
  }
  if (!EMAIL_PATTERN.test(trimmedEmail)) {
    return "Enter a valid email address.";
  }
  return "";
}

export default function SupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const emailError = email.trim() ? validateSupportEmail(email) : "";
  const canSubmit = Boolean(name.trim() && message.trim() && email.trim() && !emailError);

  function submitSupportForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setSubmitted(true);
    setName("");
    setEmail("");
    setMessage("");
  }

  return (
    <main className="policy-shell">
      <article className="policy-content">
        <p className="eyebrow">Cleanote</p>
        <h1>Support</h1>
        <p className="company-line">Cleanote, a product of Karigari Home LLC</p>
        <p className="policy-date">Last updated: July 6, 2026</p>

        <section>
          <h2>How To Get Help</h2>
          <p>
            For Cleanote support, account help, deletion requests, app questions, or OCR issues,
            contact Karigari Home LLC at info@cleanote.in or use the form below.
          </p>
        </section>

        <form className="support-form" onSubmit={submitSupportForm}>
          <label>
            <span>Name</span>
            <input
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              required
              value={name}
            />
          </label>
          <label>
            <span>Email</span>
            <input
              aria-invalid={Boolean(emailError)}
              maxLength={MAX_EMAIL_LENGTH}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
            {emailError ? <small className="field-error">{emailError}</small> : null}
          </label>
          <label>
            <span>Message</span>
            <textarea
              maxLength={1200}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Tell us what happened."
              required
              rows={5}
              value={message}
            />
          </label>
          <button className="primary" disabled={!canSubmit} type="submit">
            Submit
          </button>
          {submitted ? <p className="support-success">Form submitted successfully.</p> : null}
        </form>

        <section>
          <h2>What To Include</h2>
          <p>
            Include your device type and whether the problem involved a photo, PDF, printed
            handout, handwritten page, or annotated worksheet.
          </p>
        </section>

        <section>
          <h2>Follow Cleanote</h2>
          <p>
            For product updates, follow Cleanote on{" "}
            <a href="https://www.facebook.com/profile.php?id=61591217794113" target="_blank" rel="noreferrer">
              Facebook
            </a>{" "}
            or{" "}
            <a href="https://www.instagram.com/cleanote4/" target="_blank" rel="noreferrer">
              Instagram
            </a>
            .
          </p>
        </section>

        <a href="/">Back to Cleanote</a>
      </article>
    </main>
  );
}
