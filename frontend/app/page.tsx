import {
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  ClipboardCheck,
  Download,
  FileImage,
  FileText,
  FolderSearch,
  Highlighter,
  Lock,
  NotebookPen,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Upload
} from "lucide-react";

const FILE_TYPES = ["JPG", "PNG", "PDF", "DOCX", "Notebook photos", "Annotated handouts"];

const PROCESS_STEPS = [
  {
    icon: Upload,
    title: "Upload",
    description: "Add a note photo, PDF, DOCX, worksheet, or annotated document."
  },
  {
    icon: ScanLine,
    title: "Scan",
    description: "Cleanote improves the image, reads handwriting, and checks uncertain text."
  },
  {
    icon: ClipboardCheck,
    title: "Review",
    description: "Edit the result beside your original scan and keep unclear words visible."
  },
  {
    icon: Download,
    title: "Export",
    description: "Copy text, save searchable notes, or download TXT, DOCX, and PDF."
  }
];

const FEATURE_GROUPS = [
  {
    icon: NotebookPen,
    title: "Handwriting-first OCR",
    description:
      "Designed for lecture notes, homework, lab notebooks, research pages, and quick paper notes."
  },
  {
    icon: Highlighter,
    title: "Mixed documents",
    description:
      "Handles printed text and handwritten annotations differently, so typed handouts stay clean."
  },
  {
    icon: Brain,
    title: "Forensic AI review",
    description:
      "Runs a second check for confusions like b/6, O/0, l/1, equations, and unclear words."
  },
  {
    icon: FolderSearch,
    title: "Searchable archive",
    description:
      "Save scans by subject and search across the notes you have already processed."
  }
];

const USE_CASES = [
  "Student lecture notes",
  "Math and science pages",
  "Annotated PDFs",
  "Lab notebooks",
  "Research records",
  "Kids homework"
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
          <a href="/app">Tools</a>
          <a href="/billing">Pricing</a>
          <a href="/support">Support</a>
          <a href="/privacy">Privacy</a>
        </nav>
        <a className="doc-nav-cta" href="/app">
          Open app <ArrowRight aria-hidden="true" size={17} />
        </a>
      </header>

      <section className="doc-hero">
        <div className="doc-hero-copy">
          <p className="doc-kicker">Handwriting to editable text</p>
          <h1>Convert handwritten notes into searchable documents.</h1>
          <p>
            Cleanote is a document-processing workspace for students, parents, researchers, and
            professionals who need paper notes, worksheets, and annotated files turned into usable
            digital text.
          </p>
          <div className="doc-actions">
            <a className="doc-primary" href="/app">
              <Upload aria-hidden="true" size={18} />
              Upload a file
            </a>
            <a className="doc-secondary" href="/beta">
              Request beta access
            </a>
          </div>
          <div className="doc-file-types" aria-label="Supported file types">
            {FILE_TYPES.map((type) => (
              <span key={type}>{type}</span>
            ))}
          </div>
        </div>

        <div className="doc-tool-preview" aria-label="Cleanote upload preview">
          <div className="doc-tool-header">
            <div>
              <span className="doc-status-dot" />
              <strong>OCR workspace</strong>
            </div>
            <span>Amazon Textract + AI review</span>
          </div>
          <div className="doc-drop-preview">
            <FileImage aria-hidden="true" size={38} />
            <strong>Drop handwritten notes here</strong>
            <span>Scan image, PDF, or DOCX</span>
          </div>
          <div className="doc-result-preview">
            <div>
              <p>Corrected transcription</p>
              <strong>\((a+b)^2 = a^2 + b^2 + 2ab\)</strong>
            </div>
            <div>
              <p>Possible ambiguity</p>
              <strong>6 → b, confidence 96%</strong>
            </div>
            <div>
              <p>Export</p>
              <strong>TXT · DOCX · PDF · Copy</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="doc-trust-bar" aria-label="Cleanote highlights">
        <span><ShieldCheck aria-hidden="true" size={18} /> Private document workflow</span>
        <span><Sparkles aria-hidden="true" size={18} /> AI checks unclear handwriting</span>
        <span><Search aria-hidden="true" size={18} /> Search saved notes</span>
      </section>

      <section className="doc-process-section" aria-label="How Cleanote works">
        <div className="doc-section-heading">
          <p className="doc-kicker">Workflow</p>
          <h2>One focused tool from upload to export.</h2>
        </div>
        <div className="doc-process-grid">
          {PROCESS_STEPS.map((step) => (
            <article key={step.title}>
              <step.icon aria-hidden="true" size={22} />
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="doc-feature-section" aria-label="Cleanote capabilities">
        <div className="doc-section-heading">
          <p className="doc-kicker">Built for real paper</p>
          <h2>Cleaner results for messy notes, formulas, and annotations.</h2>
        </div>
        <div className="doc-feature-grid">
          {FEATURE_GROUPS.map((feature) => (
            <article key={feature.title}>
              <feature.icon aria-hidden="true" size={22} />
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="doc-use-case-band" aria-label="Cleanote use cases">
        <div>
          <p className="doc-kicker">Use cases</p>
          <h2>Start with one page. Build a searchable notebook over time.</h2>
        </div>
        <div className="doc-use-case-list">
          {USE_CASES.map((useCase) => (
            <span key={useCase}>
              <Check aria-hidden="true" size={16} />
              {useCase}
            </span>
          ))}
        </div>
      </section>

      <section className="doc-tablet-band" aria-label="Cleanote tablet bundle preorder">
        <div>
          <p className="doc-kicker">Tablet bundle</p>
          <h2>Cleanote+ writing tablet package.</h2>
          <p>
            We are exploring an 8.5-inch reusable writing tablet bundle for kids, tutors, and
            families who want paper-like writing with searchable digital notes.
          </p>
        </div>
        <div className="doc-tablet-actions">
          <a href="/beta">
            Join preorder list <ArrowRight aria-hidden="true" size={17} />
          </a>
          <a href="/cleanote-tablet-manual.pdf" target="_blank" rel="noreferrer">
            <FileText aria-hidden="true" size={17} />
            Manual
          </a>
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
          <a href="https://www.facebook.com/profile.php?id=61591217794113" target="_blank" rel="noreferrer">
            Facebook
          </a>
          <a href="https://www.instagram.com/cleanote4/" target="_blank" rel="noreferrer">
            Instagram
          </a>
          <a href="/billing">Premium</a>
          <a href="/app"><BookOpen aria-hidden="true" size={15} /> App</a>
        </nav>
      </footer>
    </main>
  );
}
