import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { getGuide, guides } from "../guideContent";

type GuidePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return guides.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) {
    return {};
  }

  return {
    title: guide.title,
    description: guide.description,
    alternates: {
      canonical: `/guides/${guide.slug}/`
    },
    openGraph: {
      title: `${guide.title} | Karigari Home LLC`,
      description: guide.description,
      type: "article",
      url: `/guides/${guide.slug}/`
    }
  };
}

export default async function GuideArticlePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) {
    notFound();
  }

  const related = guides.filter((item) => item.slug !== guide.slug).slice(0, 3);
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    author: {
      "@type": "Organization",
      name: "Karigari Home LLC"
    },
    publisher: {
      "@type": "Organization",
      name: "Karigari Home LLC",
      logo: {
        "@type": "ImageObject",
        url: "https://www.cleanote.in/cleanote-icon.png"
      }
    },
    mainEntityOfPage: `https://www.cleanote.in/guides/${guide.slug}/`
  };

  return (
    <main className="guide-shell">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
        type="application/ld+json"
      />
      <header className="guide-nav">
        <a className="guide-brand" href="/">
          <img alt="" src="/cleanote-icon.png" />
          <span>Karigari Home LLC</span>
        </a>
        <a className="guide-back-link" href="/guides/">
          <ArrowLeft aria-hidden="true" size={17} />
          Guides
        </a>
      </header>

      <article className="guide-article">
        <p className="guide-card-meta">
          {guide.audience} · {guide.readTime}
        </p>
        <h1>{guide.title}</h1>
        <p className="guide-description">{guide.description}</p>

        <div className="guide-callout">
          <BookOpen aria-hidden="true" size={22} />
          <p>
            Quick idea: use Karigari output as an editable draft. For homework, math, and research
            notes, always compare important text with the original page before relying on it.
          </p>
        </div>

        {guide.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </article>

      <section className="guide-related" aria-label="Related Karigari guides">
        <h2>Related guides</h2>
        <div className="guide-related-grid">
          {related.map((item) => (
            <a href={`/guides/${item.slug}/`} key={item.slug}>
              <span>{item.title}</span>
              <ArrowRight aria-hidden="true" size={16} />
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
