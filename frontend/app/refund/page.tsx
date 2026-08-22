import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "Refund information for Karigari purchases made through Stripe or mobile app stores.",
  alternates: { canonical: "/refund/" }
};

export default function RefundPage() {
  return (
    <main className="policy-shell">
      <article className="policy-content">
        <p className="eyebrow">Karigari Home LLC</p>
        <h1>Refund Policy</h1>
        <p className="company-line">Karigari Home LLC</p>
        <p className="policy-date">Last updated: June 20, 2026</p>

        <section>
          <h2>Overview</h2>
          <p>
            Karigari offers digital OCR and note conversion tools. If you are not satisfied
            with a paid Karigari purchase, you may request a refund within 7 days of purchase.
          </p>
        </section>

        <section>
          <h2>Eligible Refunds</h2>
          <p>
            Refunds are reviewed case by case. We may approve refunds for accidental purchases,
            duplicate charges, billing errors, or technical issues that prevent use of the
            service.
          </p>
        </section>

        <section>
          <h2>One-Time Premium</h2>
          <p>
            One-Time Premium is not a recurring subscription. If a refund is approved, it will be
            returned to the original payment method.
          </p>
        </section>

        <section>
          <h2>App Store Purchases</h2>
          <p>
            If you purchased Karigari through Apple App Store or Google Play, refunds may need
            to be requested directly through Apple or Google, depending on where the purchase
            was made.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            To request a refund for a direct Karigari purchase, contact Karigari Home LLC at
            info@cleanote.in and include the email used for purchase, purchase date, and a short
            reason for the request. App Store purchases are handled under the store&apos;s refund process.
          </p>
        </section>

        <a href="/">Back to Karigari</a>
      </article>
    </main>
  );
}
