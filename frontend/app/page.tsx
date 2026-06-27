import {
  ArrowRight,
  BookOpen,
  Calculator,
  Check,
  FileStack,
  FileText,
  PenLine,
  Search,
  Sparkles,
  Upload
} from "lucide-react";

const FEATURES = [
  {
    icon: Upload,
    title: "Upload a note photo",
    description: "Use notebook pages, printed handouts, annotated worksheets, or saved scans."
  },
  {
    icon: Sparkles,
    title: "OCR with cleanup",
    description: "Cleanote converts readable handwriting into editable text while preserving detail."
  },
  {
    icon: Search,
    title: "Search and reuse",
    description: "Save notes, search across your archive, and export text when you need it."
  }
];

const STEPS = [
  "Upload or capture a note page",
  "Review the extracted text",
  "Edit, save, search, or export"
];

const USE_CASES = [
  {
    icon: PenLine,
    title: "Mixed print and handwriting",
    description:
      "Use Cleanote on printed worksheets, PDFs, and handouts with handwritten annotations."
  },
  {
    icon: Calculator,
    title: "Equations and diagrams",
    description:
      "Keep formulas, labels, and visual notes visible while you review and correct the text."
  },
  {
    icon: FileStack,
    title: "Multi-page notes",
    description:
      "Scan a lecture, notebook chapter, or research record as a connected set of pages."
  },
  {
    icon: BookOpen,
    title: "Study and research archive",
    description:
      "Save searchable notes by subject so old pages become easier to find and reuse."
  }
];

export default function LandingPage() {
  return (
    <main className="site-shell">
      <header className="site-nav">
        <a className="site-brand" href="/">
          <img alt="" src="/cleanote-icon.png" />
          <span>Cleanote</span>
        </a>
        <nav aria-label="Cleanote navigation">
          <a href="/beta">Request beta</a>
          <a href="/billing">Premium</a>
          <a href="/privacy">Privacy</a>
          <a href="/support">Support</a>
          <a href="/app">Open app</a>
        </nav>
      </header>

      <section className="site-hero">
        <div className="site-hero-copy">
          <p className="site-kicker">Handwriting OCR for students, parents, and researchers</p>
          <h1>Turn messy notes into searchable knowledge.</h1>
          <p>
            Upload notebook pages, worksheets, PDFs, diagrams, and annotated handouts. Cleanote
            helps convert readable handwriting into text you can edit, search, and export.
          </p>
          <div className="site-actions">
            <a className="site-primary" href="/beta">
              Request beta access <ArrowRight aria-hidden="true" size={18} />
            </a>
            <a className="site-secondary" href="/app">Returning user? Open app</a>
          </div>
          <ul className="site-checks">
            <li><Check aria-hidden="true" size={16} /> Upload image or PDF</li>
            <li><Check aria-hidden="true" size={16} /> Edit OCR results</li>
            <li><Check aria-hidden="true" size={16} /> Export text, DOCX, or PDF</li>
          </ul>
        </div>

        <div className="product-preview" aria-label="Cleanote product preview">
          <div className="preview-toolbar">
            <span />
            <span />
            <span />
          </div>
          <div className="preview-grid">
            <section className="preview-upload">
              <FileText aria-hidden="true" size={28} />
              <strong>Algebra-worksheet.jpg</strong>
              <p>Printed text and handwritten notes detected</p>
            </section>
            <section className="preview-output">
              <p className="preview-label">Extracted text</p>
              <h2>Chapter 4 Review</h2>
              <p>(a+b)^2 = a^2 + b^2 + 2ab</p>
              <p>Triangle diagram: base, height, and angle labels preserved for review.</p>
              <p className="preview-note">Original image stays nearby so uncertain text can be checked.</p>
            </section>
          </div>
        </div>
      </section>

      <section className="site-feature-grid" aria-label="Cleanote features">
        {FEATURES.map((feature) => (
          <article key={feature.title}>
            <feature.icon aria-hidden="true" size={22} />
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
          </article>
        ))}
      </section>

      <section className="site-use-cases" aria-label="Cleanote use cases">
        <div className="site-section-heading">
          <p className="site-kicker">Built for real notes</p>
          <h2>More than a plain text scanner.</h2>
          <p>
            Cleanote is being shaped around the hard cases: mixed documents, formulas, visual
            notes, multi-page scans, and archives students can actually search later.
          </p>
        </div>
        <div className="site-use-case-grid">
          {USE_CASES.map((useCase) => (
            <article key={useCase.title}>
              <useCase.icon aria-hidden="true" size={22} />
              <h3>{useCase.title}</h3>
              <p>{useCase.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="site-workflow">
        <div>
          <p className="site-kicker">Simple workflow</p>
          <h2>Built for quick note digitization.</h2>
        </div>
        <ol>
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="tablet-manual-band" aria-label="Cleanote tablet bundle manual">
        <div>
          <p className="site-kicker">Tablet bundle concept</p>
          <h2>Cleanote+ 8.5-inch LCD tablet manual</h2>
          <p>
            A parent-friendly operation manual for the writing tablet bundle: setup,
            scanning, care, safety, and troubleshooting.
          </p>
        </div>
        <a href="/cleanote-tablet-manual.pdf" target="_blank" rel="noreferrer">
          <FileText aria-hidden="true" size={18} />
          <span>Open PDF manual</span>
        </a>
      </section>

      <footer className="site-footer">
        <p>Cleanote, a product of Karigari Home LLC</p>
        <div>
          <a href="/privacy">Privacy Policy</a>
          <a href="/refund">Refund Policy</a>
          <a href="/support">Support</a>
          <a href="https://www.facebook.com/profile.php?id=61591217794113" target="_blank" rel="noreferrer">
            Facebook
          </a>
          <a href="https://www.instagram.com/cleanote4/" target="_blank" rel="noreferrer">
            Instagram
          </a>
        </div>
      </footer>
    </main>
  );
}
