"use client";

import {
  Apple,
  ArrowRight,
  Check,
  FileText,
  Languages,
  Lock,
  LogOut,
  Play,
  Smartphone,
  Sparkles,
  Upload
} from "lucide-react";
import { FormEvent, useState } from "react";
import { getApiBase } from "./apiBase";
import { authErrorMessage, useAuth } from "./lib/auth";

const API_BASE = getApiBase();
const APP_STORE_URL = "https://apps.apple.com/app/cleanote/id6784403759";
const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=com.cleanote.app&utm_source=cleanote_website";
const KASHMIRI_TRANSLATOR_URL = "https://apps.apple.com/us/app/kashmiri-translator/id6786125105";

const VISUAL_STEPS = [
  {
    label: "Add a page",
    text: "Use a photo, PDF, screenshot, or document."
  },
  {
    label: "Get an OCR draft",
    text: "Cleanote converts readable writing into editable text."
  },
  {
    label: "Review and use",
    text: "Check the result, then save, copy, or export it."
  }
];

const HOW_IT_WORKS = [
  {
    label: "Capture",
    text: "Upload a photo, screenshot, PDF, or document."
  },
  {
    label: "Transcribe",
    text: "Cleanote creates an editable OCR draft from readable content."
  },
  {
    label: "Review and export",
    text: "Compare the draft with the page, make edits, then save or export."
  }
];

const AUDIENCES = [
  {
    title: "Students",
    text: "Capture lecture notes, homework, formulas, and revision pages."
  },
  {
    title: "Parents",
    text: "Keep simple digital records of worksheets and practice work."
  },
  {
    title: "Teachers and tutors",
    text: "Digitize annotated handouts and handwritten lesson material."
  },
  {
    title: "Professionals",
    text: "Turn meeting notes, research pages, and rough ideas into editable text."
  }
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
    text: "Save notes locally and search them again in the web workspace."
  },
  {
    title: "Export-ready output",
    text: "Copy, edit, and prepare notes for study or work."
  }
];

const FAQS = [
  {
    question: "Is Cleanote free?",
    answer: "Cleanote is free to download on Android. The iPhone app is a one-time $0.99 App Store download."
  },
  {
    question: "Do I need an account?",
    answer: "No account is needed for the iPhone app. The web scanner can be tried separately; sign-in is used only for supported account features."
  },
  {
    question: "Can I use Cleanote on the web?",
    answer: "Yes, supported web access is available after sign in."
  },
  {
    question: "Do I need the Cleanote+ tablet?",
    answer: "No. Cleanote works with ordinary paper, existing photos, PDFs, and screenshots. The writing tablet bundle is a future product concept."
  },
  {
    question: "How accurate is the transcription?",
    answer: "OCR can make mistakes with unclear handwriting, equations, diagrams, or dark images. Always compare important results with the original page."
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
        throw new Error(payload.detail ?? "Could not save tablet waitlist interest.");
      }
      setPreorderMessage(payload.message ?? "Thanks. Your tablet waitlist interest was saved.");
      setPreorderUseCase("");
    } catch (error) {
      setPreorderMessage(error instanceof Error ? error.message : "Could not save tablet waitlist interest.");
    } finally {
      setIsSubmittingPreorder(false);
    }
  }

  return (
    <main className="site-shell document-site">
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Cleanote",
            applicationCategory: "ProductivityApplication",
            operatingSystem: "iOS, Android, and web",
            description:
              "Cleanote converts readable handwritten and printed notes into editable text that users can review, save, and export.",
            offers: [
              {
                "@type": "Offer",
                price: "0.99",
                priceCurrency: "USD",
                url: APP_STORE_URL
              },
              {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
                url: GOOGLE_PLAY_URL
              }
            ],
            url: "https://www.cleanote.in/"
          }).replace(/</g, "\\u003c")
        }}
        type="application/ld+json"
      />
      <header className="doc-nav">
        <a className="doc-brand" href="/">
          <img alt="" src="/cleanote-icon.png" />
          <span>Cleanote</span>
        </a>
        <nav aria-label="Cleanote navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#use-cases">Who it helps</a>
          <a href="#tablet">Tablet</a>
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
          <div className="store-icon-links" aria-label="Download Cleanote">
            <a aria-label="Download Cleanote on the App Store" href={APP_STORE_URL} rel="noreferrer" target="_blank" title="App Store">
              <Apple aria-hidden="true" size={20} />
            </a>
            <a aria-label="Get Cleanote on Google Play" className="google-play-icon-link" href={GOOGLE_PLAY_URL} rel="noreferrer" target="_blank" title="Google Play">
              <Play aria-hidden="true" size={20} />
            </a>
          </div>
        </div>
      </header>
      {authMessage ? <p className="doc-auth-message">{authMessage}</p> : null}

      <section className="doc-hero simple-hero video-hero">
        <div className="hero-video-layer" aria-hidden="true" />
        <div className="hero-video-overlay" aria-hidden="true" />
        <div className="doc-hero-copy">
          <p className="doc-kicker">Handwriting capture for everyday notes</p>
          <h1>Turn handwritten pages into editable notes.</h1>
          <p>
            Photograph ordinary paper or add a PDF. Cleanote creates a text draft
            you can review, edit, save, and export.
          </p>
          <div className="doc-actions">
            <a className="doc-primary app-store-primary" href={APP_STORE_URL} rel="noreferrer" target="_blank">
              <Apple aria-hidden="true" size={18} />
              Download on the App Store
            </a>
            <a className="doc-primary google-play-primary" href={GOOGLE_PLAY_URL} rel="noreferrer" target="_blank">
              <Play aria-hidden="true" size={18} />
              Get it on Google Play
            </a>
            <a className="doc-secondary" href="#how-it-works">
              See how it works
              <ArrowRight aria-hidden="true" size={17} />
            </a>
          </div>
          <p className="app-price-note">Free on Android. $0.99 one-time iPhone download. The optional tablet is not required.</p>
          <div className="simple-benefits" aria-label="Cleanote highlights">
            {["Works with ordinary paper", "Photos and PDFs", "Editable text", "TXT, DOCX, and PDF export"].map((benefit) => (
              <span key={benefit}>
                <Check aria-hidden="true" size={16} />
                {benefit}
              </span>
            ))}
          </div>
        </div>

        <div className="product-visual" aria-label="Illustration of the Cleanote capture and review workflow">
          <div className="vision-console">
            <div className="vision-console-header">
              <span />
              <strong>Capture and review</strong>
              <small>workflow</small>
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
                <Upload aria-hidden="true" size={20} />
                <strong>Export</strong>
                <span>TXT · DOCX · PDF</span>
              </article>
              <article>
                <Check aria-hidden="true" size={20} />
                <strong>Review</strong>
                <span>user checked</span>
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
        <span><FileText aria-hidden="true" size={18} /> Ordinary paper works</span>
        <span><Smartphone aria-hidden="true" size={18} /> iPhone app available now</span>
        <span><Lock aria-hidden="true" size={18} /> Review before relying on OCR</span>
      </section>

      <section className="doc-process-section" id="how-it-works">
        <div className="doc-section-heading">
          <p className="doc-kicker">How it works</p>
          <h2>From a written page to text you can use.</h2>
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

      <section className="audience-section" id="use-cases">
        <div className="doc-section-heading">
          <p className="doc-kicker">Use cases</p>
          <h2>Useful wherever handwriting is still the easiest place to start.</h2>
        </div>
        <div className="audience-grid">
          {AUDIENCES.map((audience) => (
            <article key={audience.title}>
              <Check aria-hidden="true" size={18} />
              <h3>{audience.title}</h3>
              <p>{audience.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="availability-section" aria-label="Cleanote product availability">
        <article>
          <p className="doc-kicker">Available now</p>
          <h2>Cleanote app and web scanner</h2>
          <ul>
            <li>Cleanote for iPhone on the App Store</li>
            <li>Web scanning with photos, PDFs, screenshots, and DOCX files</li>
            <li>Editable results with TXT, DOCX, and PDF export</li>
            <li>Local browser note saving and search</li>
          </ul>
        </article>
        <article className="future-product-card">
          <p className="doc-kicker">In development</p>
          <h2>Cleanote+ writing tablet bundle</h2>
          <p>
            The 8.5-inch writing tablet is a concept under development. Joining the
            waitlist records interest; it is not a purchase or reservation.
          </p>
        </article>
      </section>

      <section className="pricing-panel" id="pricing">
        <div>
          <p className="doc-kicker">Pricing</p>
          <h2>Choose your mobile app store.</h2>
          <p>Free on Android or a one-time $0.99 iPhone download. Optional account for supported web access.</p>
        </div>
        <div className="pricing-store-actions">
          <a className="doc-primary app-store-primary" href={APP_STORE_URL} rel="noreferrer" target="_blank">
            <Apple aria-hidden="true" size={18} />
            App Store
          </a>
          <a className="doc-primary google-play-primary" href={GOOGLE_PLAY_URL} rel="noreferrer" target="_blank">
            <Play aria-hidden="true" size={18} />
            Google Play
          </a>
        </div>
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

      <section className="doc-tablet-band simple-tablet" id="tablet" aria-label="Cleanote tablet bundle waitlist">
        <div className="doc-tablet-copy">
          <p className="doc-kicker">Coming soon</p>
          <h2>Cleanote+ writing tablet bundle concept.</h2>
          <p>
            A reusable 8.5-inch LCD writing tablet concept designed to work alongside
            the Cleanote capture workflow. Final features, price, and availability are not yet confirmed.
          </p>
          <div className="doc-price-callout">
            <strong>Coming soon</strong>
            <span>Join the nonbinding interest list.</span>
          </div>
        </div>
        <figure className="doc-tablet-figure">
          <img alt="Cleanote tablet bundle concept" src="/cleanote-tablet-concept.jpg" />
        </figure>
        <form className="tablet-preorder-form" onSubmit={submitTabletPreorder}>
          <h3>Join the tablet waitlist</h3>
          <p>We will use these details only to follow up about the tablet concept.</p>
          <label htmlFor="tablet-name">Name</label>
          <input
            autoComplete="name"
            id="tablet-name"
            maxLength={120}
            onChange={(event) => setPreorderName(event.target.value)}
            required
            value={preorderName}
          />
          <label htmlFor="tablet-email">Email</label>
          <input
            autoComplete="email"
            id="tablet-email"
            maxLength={254}
            onChange={(event) => setPreorderEmail(event.target.value)}
            required
            type="email"
            value={preorderEmail}
          />
          <div className="tablet-preorder-row">
            <div>
              <label htmlFor="tablet-role">I am a</label>
              <select id="tablet-role" onChange={(event) => setPreorderRole(event.target.value)} value={preorderRole}>
                <option>Parent</option>
                <option>Student</option>
                <option>Tutor</option>
                <option>Teacher</option>
                <option>Professional</option>
              </select>
            </div>
            <div>
              <label htmlFor="tablet-quantity">Possible quantity</label>
              <input
                id="tablet-quantity"
                min="1"
                max="50"
                onChange={(event) => setPreorderQuantity(event.target.value)}
                type="number"
                value={preorderQuantity}
              />
            </div>
          </div>
          <label htmlFor="tablet-use-case">How would you use it? <span>(optional)</span></label>
          <textarea
            id="tablet-use-case"
            maxLength={600}
            onChange={(event) => setPreorderUseCase(event.target.value)}
            rows={3}
            value={preorderUseCase}
          />
          <button className="primary tablet-preorder-button" disabled={isSubmittingPreorder} type="submit">
            {isSubmittingPreorder ? "Saving" : "Join tablet waitlist"}
          </button>
          <small className="tablet-privacy-note">
            By joining, you agree that Cleanote may contact you about this concept. See the{" "}
            <a href="/privacy">Privacy Policy</a>.
          </small>
          <a className="tablet-premium-link" href={APP_STORE_URL} rel="noreferrer" target="_blank">
            Download the iPhone app <ArrowRight aria-hidden="true" size={16} />
          </a>
          {preorderMessage ? <p className="tablet-preorder-message" role="status">{preorderMessage}</p> : null}
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
          <a href="/delete-account">Delete account or data</a>
          <a href="/support">Support</a>
          <a href="/support">Contact</a>
          <a href="/refund">Refund Policy</a>
          <a href={APP_STORE_URL} rel="noreferrer" target="_blank">App Store</a>
          <a href={GOOGLE_PLAY_URL} rel="noreferrer" target="_blank">Google Play</a>
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
