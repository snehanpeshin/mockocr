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
  const [isReadyToSend, setIsReadyToSend] = useState(false);
  const emailError = email.trim() ? validateSupportEmail(email) : "";
  const canSubmit = Boolean(name.trim() && message.trim() && email.trim() && !emailError);

  function submitSupportForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    const subject = encodeURIComponent(`Karigari support request from ${name.trim()}`);
    const body = encodeURIComponent(
      `Name: ${name.trim()}\nEmail: ${email.trim()}\n\n${message.trim()}`
    );
    setIsReadyToSend(true);
    window.location.href = `mailto:info@cleanote.in?subject=${subject}&body=${body}`;
  }

  return (
    <main className="policy-shell">
      <article className="policy-content">
        <p className="eyebrow">Karigari Home LLC</p>
        <h1>Support</h1>
        <p className="company-line">Karigari Home LLC</p>
        <p className="policy-date">Last updated: July 6, 2026</p>

        <section>
          <h2>How To Get Help</h2>
          <p>
            For Karigari support, account help, deletion requests, app questions, or OCR issues,
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
          {isReadyToSend ? (
            <p className="support-success" role="status">
              Your email app should open with a draft addressed to info@cleanote.in. Send that
              draft to complete your request.
            </p>
          ) : null}
        </form>

        <p className="support-form-note">
          This form opens your email app. Karigari does not claim the message was received until
          you send it. You can also email <a href="mailto:info@cleanote.in">info@cleanote.in</a> directly.
        </p>

        <section>
          <h2>What To Include</h2>
          <p>
            Include your device type and whether the problem involved a photo, PDF, printed
            handout, handwritten page, or annotated worksheet.
          </p>
        </section>

        <section>
          <h2>Follow Karigari</h2>
          <p>
            For product updates, follow Karigari on{" "}
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

        <a href="/">Back to Karigari</a>
      </article>
    </main>
  );
}
