import { ArrowRight, Check, FileText, Search, Sparkles, Upload } from "lucide-react";

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
          <a href="/app">Open app</a>
        </nav>
      </header>

      <section className="site-hero">
        <div className="site-hero-copy">
          <p className="site-kicker">Handwriting OCR for students, parents, and researchers</p>
          <h1>Turn handwritten notes into editable text.</h1>
          <p>
            Upload note photos, worksheets, PDFs, or annotated handouts. Cleanote converts
            readable handwriting into text you can edit, search, and export.
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
              <strong>Lecture-notes.jpg</strong>
              <p>Handwritten page detected</p>
            </section>
            <section className="preview-output">
              <p className="preview-label">Extracted text</p>
              <h2>Photosynthesis Notes</h2>
              <p>Plants convert light energy into chemical energy.</p>
              <p>Equation and diagram labels are kept readable for review.</p>
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

      <footer className="site-footer">
        <p>Cleanote, a product of Karigari Home LLC</p>
        <div>
          <a href="/privacy">Privacy Policy</a>
          <a href="/refund">Refund Policy</a>
        </div>
      </footer>
    </main>
  );
}
