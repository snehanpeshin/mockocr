import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account and Data Deletion",
  description: "How to request deletion of a Cleanote account and associated saved data.",
  alternates: { canonical: "/delete-account/" }
};

export default function DeleteAccountPage() {
  return (
    <main className="policy-shell">
      <article className="policy-content">
        <p className="eyebrow">Cleanote</p>
        <h1>Account and Data Deletion</h1>
        <p className="company-line">Cleanote, a product of Karigari Home LLC</p>
        <p className="policy-date">Last updated: July 10, 2026</p>

        <section>
          <h2>Request deletion</h2>
          <p>
            Email <a href="mailto:info@cleanote.in?subject=Cleanote%20account%20deletion%20request">info@cleanote.in</a>{" "}
            from the address connected to your Cleanote account. Use the subject “Cleanote account
            deletion request.”
          </p>
        </section>

        <section>
          <h2>What to include</h2>
          <p>
            Include the account email and state whether you want the account, beta signup details,
            saved cloud notes, or all associated data deleted. Do not send passwords or payment-card details.
          </p>
        </section>

        <section>
          <h2>Data stored on your device</h2>
          <p>
            Notes saved only in your browser or mobile device are controlled from that device. Clear
            saved notes in Cleanote before uninstalling, or clear the site&apos;s browser storage.
          </p>
        </section>

        <section>
          <h2>Purchase records</h2>
          <p>
            Some transaction records may be retained when required for accounting, fraud prevention,
            dispute handling, or legal compliance. Mobile app purchase history is also governed by the app store.
          </p>
        </section>

        <p>This page provides product instructions and should be reviewed with qualified legal counsel.</p>
        <a href="/">Back to Cleanote</a>
      </article>
    </main>
  );
}
