import {
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  Lock,
  Search,
  Sparkles,
  Upload
} from "lucide-react";

const BENEFITS = [
  "Capture full pages and PDFs",
  "Keep equations, labels, and side notes",
  "Search, edit, copy, or export"
];

const OUTCOMES = [
  "Less retyping after class",
  "Cleaner study material",
  "Notes you can actually find later"
];

export default function LandingPage() {
  return (
    <main className="site-shell document-site">
      <header className="doc-nav">
        <a className="doc-brand" href="/">
          <img alt="" src="/cleanote-icon.png" />
          <span>Cleanote</span>
        </a>
        <nav aria-label="Cleanote navigation">
          <a href="/app">App</a>
          <a href="/billing">Premium</a>
          <a href="/support">Support</a>
        </nav>
        <a className="doc-nav-cta" href="/app">
          Open scanner <ArrowRight aria-hidden="true" size={17} />
        </a>
      </header>

      <section className="doc-hero simple-hero">
        <div className="doc-hero-copy">
          <p className="doc-kicker">Handwriting OCR</p>
          <h1>Convert handwritten notes into searchable documents.</h1>
          <p>
            Cleanote helps students, parents, researchers, and professionals turn notebook pages,
            worksheets, PDFs, and annotated handouts into editable text they can review and use.
          </p>
          <div className="doc-actions">
            <a className="doc-primary" href="/app">
              <Upload aria-hidden="true" size={18} />
              Try Cleanote
            </a>
            <a className="doc-secondary" href="/billing">
              Premium $9.99/mo
            </a>
          </div>
          <div className="simple-benefits" aria-label="Cleanote benefits">
            {BENEFITS.map((benefit) => (
              <span key={benefit}>
                <Check aria-hidden="true" size={16} />
                {benefit}
              </span>
            ))}
          </div>
          <div className="doc-outcomes" aria-label="What Cleanote helps with">
            {OUTCOMES.map((outcome) => (
              <span key={outcome}>{outcome}</span>
            ))}
          </div>
        </div>

        <div className="doc-tool-preview simple-preview" aria-label="Cleanote preview">
          <div className="doc-drop-preview">
            <FileText aria-hidden="true" size={38} />
            <strong>Drop a note here</strong>
            <span>Image · PDF · DOCX</span>
          </div>
          <div className="simple-output-preview">
            <p>Result</p>
            <strong>Text you can work with</strong>
            <span>Cleanote keeps readable written material visible, including side notes, labels, and equations.</span>
          </div>
        </div>
      </section>

      <section className="doc-trust-bar simple-trust" aria-label="Cleanote highlights">
        <span><Sparkles aria-hidden="true" size={18} /> Finds more page detail</span>
        <span><Search aria-hidden="true" size={18} /> Makes notes searchable</span>
        <span><Lock aria-hidden="true" size={18} /> Keeps review in your hands</span>
      </section>

      <section className="doc-tablet-band simple-tablet" aria-label="Cleanote tablet bundle preorder">
        <div className="doc-tablet-copy">
          <p className="doc-kicker">Coming soon</p>
          <h2>Cleanote+ writing tablet bundle.</h2>
          <p>
            A simple 8.5-inch writing tablet concept for kids, tutors, and families who want
            less paper clutter and a cleaner way to save handwritten learning.
          </p>
          <div className="doc-price-callout">
            <strong>$9.99/month</strong>
            <span>Premium access now. Tablet bundle preorder interest included.</span>
          </div>
        </div>
        <figure className="doc-tablet-figure">
          <img alt="Cleanote tablet bundle concept" src="/cleanote-tablet-concept.jpg" />
        </figure>
        <div className="doc-tablet-actions">
          <a href="/billing">
            Get Premium <ArrowRight aria-hidden="true" size={17} />
          </a>
          <a href="/beta">Join preorder list</a>
        </div>
      </section>

      <footer className="doc-footer">
        <div>
          <img alt="" src="/cleanote-icon.png" />
          <span>Cleanote, a product of Karigari Home LLC</span>
        </div>
        <nav aria-label="Footer links">
          <a href="/privacy"><Lock aria-hidden="true" size={15} /> Privacy</a>
          <a href="/refund">Refunds</a>
          <a href="/support">Support</a>
          <a href="/app"><BookOpen aria-hidden="true" size={15} /> App</a>
        </nav>
      </footer>
    </main>
  );
}
