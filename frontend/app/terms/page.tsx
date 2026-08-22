import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using the Karigari app and web note-scanning tools.",
  alternates: { canonical: "/terms/" }
};

export default function TermsPage() {
  return (
    <main className="policy-shell">
      <article className="policy-content">
        <p className="eyebrow">Karigari Home LLC</p>
        <h1>Terms of Service</h1>
        <p className="company-line">Karigari Home LLC</p>
        <p className="policy-date">Last updated: July 28, 2026</p>

        <section>
          <h2>Use of Karigari</h2>
          <p>
            Karigari helps convert notes, documents, screenshots, and study material into readable
            outputs. You are responsible for the files you upload and for reviewing the accuracy of
            any generated text before relying on it.
          </p>
        </section>

        <section>
          <h2>Accounts</h2>
          <p>
            A Karigari account may be used for supported web access and account features. Some
            notes may remain only in the browser unless a cloud-saving feature is explicitly shown.
            Keep your account information secure and contact support if you believe your account
            has been accessed without permission.
          </p>
        </section>

        <section>
          <h2>App Store Purchases</h2>
          <p>
            Karigari for iPhone is distributed through the Apple App Store. App Store purchases,
            refunds, and availability may be subject to Apple&apos;s terms and policies.
          </p>
        </section>

        <section>
          <h2>Accuracy</h2>
          <p>
            OCR and AI-assisted document processing can make mistakes, especially with unclear
            handwriting, complex formatting, equations, or low-quality images. Always review the
            result before using it for important work.
          </p>
        </section>

        <section>
          <h2>Your Files and Permission to Process Them</h2>
          <p>
            You retain ownership of files and text you submit. You give Karigari Home LLC a
            limited permission to process that material only as needed to provide, secure, and
            support the requested Karigari feature. Do not upload another person&apos;s copyrighted
            or confidential material unless you have permission to do so.
          </p>
        </section>

        <section>
          <h2>Karigari Content and Third-Party Marks</h2>
          <p>
            The Karigari name, logo, website design, original software, and original marketing
            materials are owned by Karigari Home LLC or used with permission. Cleanote identifies
            only the company&apos;s physical writing tablet and Slate products; it is not the company
            or website brand. References to Apple, Google, AWS, or other services identify tools
            used in the workflow and do not imply sponsorship, endorsement, or affiliation. Their
            names and marks belong to their respective owners.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            For support, questions, or account help, use the Karigari support page.
          </p>
        </section>

        <a href="/">Back to Karigari</a>
      </article>
    </main>
  );
}
