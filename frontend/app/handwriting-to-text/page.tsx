import type { Metadata } from "next";
import Script from "next/script";
import { ArrowRight, CheckCircle, FileText, Search, ShieldCheck, Smartphone } from "lucide-react";

const APP_STORE_URL = "https://apps.apple.com/app/cleanote/id6784403759";
const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.cleanote.app&utm_source=cleanote_website";

export const metadata: Metadata = {
  title: "Convert Handwritten Notes to Text",
  description:
    "Use Cleanote to convert handwritten notes, worksheets, equations, and study pages into editable, searchable text on web, iPhone, and Android.",
  alternates: {
    canonical: "/handwriting-to-text/"
  },
  openGraph: {
    title: "Convert Handwritten Notes to Text | Cleanote",
    description:
      "Cleanote turns paper notes and handwritten pages into editable, searchable text while keeping review and uncertainty visible.",
    url: "https://www.cleanote.in/handwriting-to-text/",
    type: "website"
  }
};

const faqs = [
  {
    question: "Can Cleanote convert handwritten notes to text?",
    answer:
      "Yes. Cleanote lets users upload or capture handwritten pages and returns editable text that can be reviewed, copied, searched, and exported."
  },
  {
    question: "Can Cleanote read messy handwriting?",
    answer:
      "Cleanote is designed for real handwritten notes, but accuracy depends on lighting, page angle, contrast, and handwriting clarity. The app keeps review in the workflow so users can correct uncertain text."
  },
  {
    question: "Does Cleanote solve homework?",
    answer:
      "No. Cleanote is built to digitize and organize homework pages. It helps preserve the student's written work instead of replacing learning with automatic answers."
  },
  {
    question: "What happens when OCR is uncertain?",
    answer:
      "Cleanote uses a review-first workflow. The goal is to preserve the visible writing, flag uncertainty, and avoid inventing content that was not on the page."
  },
  {
    question: "Can I use Cleanote on iPhone, Android, and the web?",
    answer:
      "Yes. Cleanote is available as a web scanner and has app links for iPhone and Android."
  }
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer
    }
  }))
};

export default function HandwritingToTextPage() {
  return (
    <main className="seo-page">
      <Script
        id="handwriting-to-text-faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <header className="seo-nav">
        <a className="seo-brand" href="/">
          <img alt="" src="/cleanote-icon.png" />
          <span>Cleanote</span>
        </a>
        <nav aria-label="Cleanote pages">
          <a href="/homework-scanner/">Homework scanner</a>
          <a href="/app">Try scanner</a>
        </nav>
      </header>

      <section className="seo-hero">
        <div>
          <p className="seo-kicker">Handwriting to text</p>
          <h1>Convert handwritten notes into searchable documents.</h1>
          <p>
            Cleanote is a handwriting-first scanner for students, parents, researchers, and
            professionals. Upload a notebook page, worksheet, or annotated document and turn it into
            editable text that can be searched, copied, reviewed, and exported.
          </p>
          <div className="seo-actions">
            <a className="seo-primary" href="/app">
              Start scanning <ArrowRight aria-hidden="true" size={17} />
            </a>
            <a href={APP_STORE_URL} rel="noreferrer" target="_blank">
              App Store
            </a>
            <a href={GOOGLE_PLAY_URL} rel="noreferrer" target="_blank">
              Google Play
            </a>
          </div>
        </div>
        <aside className="seo-preview" aria-label="Cleanote handwriting conversion preview">
          <div className="seo-paper">
            <span>Notebook page</span>
            <p>(a+b)^2 = a^2 + b^2 + 2ab</p>
            <p>India is a very big country.</p>
            <p>Review notes before saving.</p>
          </div>
          <div className="seo-result">
            <FileText aria-hidden="true" size={22} />
            <strong>Editable text</strong>
            <span>Searchable, exportable, and reviewable</span>
          </div>
        </aside>
      </section>

      <section className="seo-grid" aria-label="How Cleanote works">
        <article>
          <CheckCircle aria-hidden="true" size={22} />
          <h2>Capture the whole page</h2>
          <p>Use upload or camera capture for handwritten notes, worksheets, diagrams, and printed pages with annotations.</p>
        </article>
        <article>
          <Search aria-hidden="true" size={22} />
          <h2>Make notes searchable</h2>
          <p>Cleanote turns scanned writing into text so students can find concepts, terms, formulas, and study points later.</p>
        </article>
        <article>
          <ShieldCheck aria-hidden="true" size={22} />
          <h2>Review before trusting</h2>
          <p>The workflow favors traceable transcription and user review instead of silently inventing missing words or equations.</p>
        </article>
      </section>

      <section className="seo-two-col">
        <div>
          <p className="seo-kicker">Best for</p>
          <h2>Notes that should not disappear after class.</h2>
          <p>
            Cleanote is useful for lecture notes, handwritten homework, lab pages, meeting notes,
            research records, and printed documents with handwritten comments.
          </p>
        </div>
        <ul className="seo-list">
          <li>Convert handwriting into editable text.</li>
          <li>Keep equations and written lines reviewable.</li>
          <li>Search across saved study material.</li>
          <li>Export or copy text for reports, homework review, and revision.</li>
        </ul>
      </section>

      <section className="seo-faq" aria-label="Handwriting to text FAQ">
        <p className="seo-kicker">FAQ</p>
        <h2>Common handwriting-to-text questions</h2>
        {faqs.map((faq) => (
          <details key={faq.question}>
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </section>

      <footer className="seo-footer">
        <span>Cleanote, a product of Karigari Home LLC</span>
        <a href="/privacy/">Privacy</a>
        <a href="/support/">Support</a>
      </footer>
    </main>
  );
}
