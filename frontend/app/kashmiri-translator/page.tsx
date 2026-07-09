import { ArrowLeft, Check, Languages, Smartphone, Volume2 } from "lucide-react";
import type { Metadata } from "next";

const KASHMIRI_TRANSLATOR_URL = "https://apps.apple.com/us/app/kashmiri-translator/id6786125105";

export const metadata: Metadata = {
  title: "Kashmiri Translator",
  description:
    "Kashmiri Translator is a focused iPhone app for translating English into Kashmiri.",
  alternates: {
    canonical: "/kashmiri-translator"
  },
  openGraph: {
    description: "Translate English into Kashmiri with a focused iPhone app from Cleanote.",
    images: ["/kashmiri-translator-bg.jpg"],
    title: "Kashmiri Translator",
    url: "/kashmiri-translator"
  }
};

const HIGHLIGHTS = [
  "English to Kashmiri translation",
  "Clean, simple iPhone interface",
  "Built for quick everyday use"
];

export default function KashmiriTranslatorPage() {
  return (
    <main className="site-shell document-site translator-page">
      <header className="doc-nav">
        <a className="doc-brand" href="/">
          <img alt="" src="/cleanote-icon.png" />
          <span>Cleanote</span>
        </a>
        <nav aria-label="Kashmiri Translator navigation">
          <a href="/">Cleanote</a>
          <a href="#features">Features</a>
          <a href="/privacy">Privacy</a>
          <a href="/support">Support</a>
        </nav>
        <a className="doc-nav-cta app-store-mini" href={KASHMIRI_TRANSLATOR_URL} rel="noreferrer" target="_blank">
          View on the App Store
        </a>
      </header>

      <section className="translator-hero">
        <div className="translator-hero-copy">
          <a className="translator-back-link" href="/">
            <ArrowLeft aria-hidden="true" size={16} />
            Back to Cleanote
          </a>
          <p className="doc-kicker">Additional product</p>
          <h1>Kashmiri Translator</h1>
          <p>
            Translate English into Kashmiri with a focused iPhone app made for simple, everyday language help.
          </p>
          <aside className="translator-news-card" aria-label="Kashmiri Translator news">
            <span>App Store milestone</span>
            <strong>Kashmiri Translator recently reached #34 in Apple paid apps.</strong>
            <p>Thank you to early users supporting language tools from Cleanote.</p>
          </aside>
          <div className="doc-actions">
            <a className="doc-primary app-store-primary" href={KASHMIRI_TRANSLATOR_URL} rel="noreferrer" target="_blank">
              <Smartphone aria-hidden="true" size={18} />
              Download on the App Store
            </a>
            <a className="doc-secondary" href="/support">Contact support</a>
          </div>
        </div>
        <div className="translator-phone-visual" aria-label="Kashmiri Translator preview">
          <div className="translator-phone-top" />
          <div className="translator-input-panel">
            <span>English</span>
            <strong>How are you?</strong>
          </div>
          <div className="translator-arrow">
            <Languages aria-hidden="true" size={24} />
          </div>
          <div className="translator-output-panel">
            <span>Kashmiri</span>
            <strong lang="ks" dir="rtl">تُہۍ کِتھ چھِو؟</strong>
          </div>
        </div>
      </section>

      <section className="translator-feature-band" id="features">
        <div>
          <p className="doc-kicker">Why it helps</p>
          <h2>A simple Kashmiri companion.</h2>
        </div>
        <div className="translator-feature-grid">
          {HIGHLIGHTS.map((highlight) => (
            <article key={highlight}>
              <Check aria-hidden="true" size={18} />
              <span>{highlight}</span>
            </article>
          ))}
          <article>
            <Volume2 aria-hidden="true" size={18} />
            <span>Designed to support spoken-language workflows as the app improves.</span>
          </article>
        </div>
      </section>

      <footer className="doc-footer">
        <a className="doc-footer-brand" href="/">
          <img alt="" src="/cleanote-icon.png" />
          <span>Cleanote</span>
        </a>
        <nav aria-label="Footer links">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/support">Support</a>
          <a href={KASHMIRI_TRANSLATOR_URL} rel="noreferrer" target="_blank">App Store</a>
        </nav>
      </footer>
    </main>
  );
}
