import type { Metadata } from "next";
import { ArrowRight, BookOpen, CheckCircle2 } from "lucide-react";
import { guides } from "./guideContent";

export const metadata: Metadata = {
  title: "Handwriting OCR Guides for Students and Parents",
  description:
    "Original Karigari guides about handwriting OCR, homework scanning, math notes, study organization, and converting handwritten pages into editable text.",
  alternates: {
    canonical: "/guides/"
  }
};

export default function GuidesPage() {
  return (
    <main className="guide-shell">
      <header className="guide-nav">
        <a className="guide-brand" href="/">
          <img alt="" src="/cleanote-icon.png" />
          <span>Karigari Home LLC</span>
        </a>
        <a className="guide-back-link" href="/app">
          Open scanner <ArrowRight aria-hidden="true" size={17} />
        </a>
      </header>

      <section className="guide-hero">
        <p className="one-page-kicker">Karigari learning library</p>
        <h1>Practical guides for scanning handwritten notes, homework, and study pages.</h1>
        <p>
          These articles explain how handwriting OCR works, where it fails, and how students,
          parents, tutors, and teachers can create better digital study records from ordinary paper.
        </p>
      </section>

      <section className="guide-grid" aria-label="Karigari guides">
        {guides.map((guide) => (
          <article className="guide-card" key={guide.slug}>
            <BookOpen aria-hidden="true" size={22} />
            <p className="guide-card-meta">
              {guide.audience} · {guide.readTime}
            </p>
            <h2>{guide.title}</h2>
            <p>{guide.description}</p>
            <a href={`/guides/${guide.slug}/`}>
              Read guide <ArrowRight aria-hidden="true" size={16} />
            </a>
          </article>
        ))}
      </section>

      <section className="guide-footer-note">
        <CheckCircle2 aria-hidden="true" size={22} />
        <div>
          <h2>Built around reviewable transcription</h2>
          <p>
            Karigari articles are written for real note-taking situations: uneven lighting, pencil
            marks, equations, diagrams, screenshots, and handwritten corrections on printed pages.
          </p>
        </div>
      </section>
    </main>
  );
}
