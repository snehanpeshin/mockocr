import type { Metadata } from "next";
import Script from "next/script";
import { ArrowRight, BookOpen, Camera, CheckCircle, FileText, Users } from "lucide-react";

const APP_STORE_URL = "https://apps.apple.com/app/cleanote/id6784403759";
const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.cleanote.app&utm_source=cleanote_website";

export const metadata: Metadata = {
  title: "Homework Scanner App for Students",
  description:
    "Cleanote helps students and families scan handwritten homework, worksheets, equations, and class notes into reviewable digital text.",
  alternates: {
    canonical: "/homework-scanner/"
  },
  openGraph: {
    title: "Homework Scanner App for Students | Cleanote",
    description:
      "Scan handwritten homework and worksheets into searchable text while preserving review and student learning.",
    url: "https://www.cleanote.in/homework-scanner/",
    type: "website"
  }
};

const faqs = [
  {
    question: "What is a homework scanner app?",
    answer:
      "A homework scanner app captures paper homework or worksheets and converts the visible writing into digital text that can be reviewed, searched, and saved."
  },
  {
    question: "Can Cleanote scan worksheets with handwriting?",
    answer:
      "Yes. Cleanote can process printed worksheets and handwritten notes or annotations, then returns editable text for review."
  },
  {
    question: "Is Cleanote for parents and teachers too?",
    answer:
      "Yes. Parents and teachers can use Cleanote to keep a digital record of handwritten work, class notes, study pages, and practice sheets."
  },
  {
    question: "Does Cleanote replace doing homework?",
    answer:
      "No. Cleanote is a capture and organization tool. It helps preserve and review work that has already been written."
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

export default function HomeworkScannerPage() {
  return (
    <main className="seo-page seo-page-warm">
      <Script
        id="homework-scanner-faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <header className="seo-nav">
        <a className="seo-brand" href="/">
          <img alt="" src="/cleanote-icon.png" />
          <span>Cleanote</span>
        </a>
        <nav aria-label="Cleanote pages">
          <a href="/handwriting-to-text/">Handwriting to text</a>
          <a href="/app">Try scanner</a>
        </nav>
      </header>

      <section className="seo-hero">
        <div>
          <p className="seo-kicker">Homework scanner</p>
          <h1>Scan homework pages without losing the student&apos;s work.</h1>
          <p>
            Cleanote helps students and families turn paper homework, class notes, and worksheets
            into searchable digital records. It is built for capture, review, and organization, not
            shortcuts around learning.
          </p>
          <div className="seo-actions">
            <a className="seo-primary" href="/app">
              Try the scanner <ArrowRight aria-hidden="true" size={17} />
            </a>
            <a href={APP_STORE_URL} rel="noreferrer" target="_blank">
              App Store
            </a>
            <a href={GOOGLE_PLAY_URL} rel="noreferrer" target="_blank">
              Google Play
            </a>
          </div>
        </div>
        <aside className="seo-preview homework-preview" aria-label="Homework scanner preview">
          <div className="seo-paper">
            <span>Worksheet</span>
            <p>Show your steps.</p>
            <p>2x + 4 = 12</p>
            <p>x = 4</p>
          </div>
          <div className="seo-result">
            <BookOpen aria-hidden="true" size={22} />
            <strong>Study record</strong>
            <span>Saved for review, search, and parent support</span>
          </div>
        </aside>
      </section>

      <section className="seo-grid" aria-label="Homework scanner workflow">
        <article>
          <Camera aria-hidden="true" size={22} />
          <h2>Capture pages</h2>
          <p>Take a photo or upload a scan of homework, worksheets, notebook pages, or annotated handouts.</p>
        </article>
        <article>
          <FileText aria-hidden="true" size={22} />
          <h2>Convert writing</h2>
          <p>Turn visible handwriting and printed text into a reviewable digital version that can be corrected before use.</p>
        </article>
        <article>
          <Users aria-hidden="true" size={22} />
          <h2>Review together</h2>
          <p>Use the output for study review, tutoring prep, parent support, and class organization.</p>
        </article>
      </section>

      <section className="seo-two-col">
        <div>
          <p className="seo-kicker">For students and families</p>
          <h2>Keep handwriting in the learning loop.</h2>
          <p>
            Students can keep practicing on paper while Cleanote helps preserve the work as a
            digital record. Parents and teachers can review what was written without retyping every
            page.
          </p>
        </div>
        <ul className="seo-list">
          <li>Good for worksheets, equations, diagrams, and short written answers.</li>
          <li>Useful for exam prep and tutoring sessions.</li>
          <li>Works as a web app, iPhone app, and Android app.</li>
          <li>Supports a future tablet bundle for repeatable paper-like capture.</li>
        </ul>
      </section>

      <section className="seo-faq" aria-label="Homework scanner FAQ">
        <p className="seo-kicker">FAQ</p>
        <h2>Homework scanner questions</h2>
        {faqs.map((faq) => (
          <details key={faq.question}>
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </section>

      <section className="seo-final-cta">
        <CheckCircle aria-hidden="true" size={24} />
        <h2>Ready to scan a page?</h2>
        <p>Start with one clear homework or notebook page, then review the converted text before saving.</p>
        <a className="seo-primary" href="/app">
          Open Cleanote <ArrowRight aria-hidden="true" size={17} />
        </a>
      </section>

      <footer className="seo-footer">
        <span>Cleanote, a product of Karigari Home LLC</span>
        <a href="/privacy/">Privacy</a>
        <a href="/support/">Support</a>
      </footer>
    </main>
  );
}
