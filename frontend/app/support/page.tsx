export default function SupportPage() {
  return (
    <main className="policy-shell">
      <article className="policy-content">
        <p className="eyebrow">Cleanote</p>
        <h1>Support</h1>
        <p className="company-line">Cleanote, a product of Karigari Home LLC</p>
        <p className="policy-date">Last updated: June 25, 2026</p>

        <section>
          <h2>How To Get Help</h2>
          <p>
            For Cleanote support, billing questions, account help, deletion requests, or app
            review access questions, contact Karigari Home LLC at info@cleanote.in.
          </p>
        </section>

        <section>
          <h2>What To Include</h2>
          <p>
            Please include your name, email address, device type, and a short description of the
            issue. If the problem is related to OCR, include whether you were scanning a photo,
            PDF, printed handout, handwritten page, or annotated worksheet.
          </p>
        </section>

        <section>
          <h2>App Review Access</h2>
          <p>
            Cleanote does not require a password for basic note scanning. If Apple or Google
            review needs access to a restricted feature, contact us and we will provide review
            instructions.
          </p>
        </section>

        <section>
          <h2>Response Time</h2>
          <p>
            We aim to respond to support requests within 2 business days. During beta testing,
            response times may vary as we improve the product.
          </p>
        </section>

        <a href="/">Back to Cleanote</a>
      </article>
    </main>
  );
}
