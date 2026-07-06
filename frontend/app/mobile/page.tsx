import { ArrowRight, Smartphone } from "lucide-react";

const APP_STORE_URL = "https://apps.apple.com/bz/app/cleanote/id6784403759";
const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=com.cleanote.app";

function qrUrl(url: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=12&data=${encodeURIComponent(url)}`;
}

export default function MobileAppPage() {
  const currentYear = new Date().getFullYear();

  return (
    <main className="mobile-download-shell">
      <header className="mobile-download-nav">
        <a className="doc-brand" href="/">
          <img alt="" src="/cleanote-icon.png" />
          <span>Cleanote</span>
        </a>
        <a className="doc-signin-link" href="/">Back to Home</a>
      </header>

      <section className="mobile-download-hero">
        <p className="doc-kicker">Cleanote mobile app</p>
        <h1>Download Cleanote on your phone.</h1>
        <p>
          Scan a QR code or choose your store to install Cleanote on iPhone or Android.
        </p>
      </section>

      <section className="mobile-store-grid" aria-label="Mobile app download links">
        <article>
          <div className="mobile-store-icon">
            <Smartphone aria-hidden="true" size={28} />
          </div>
          <h2>iPhone</h2>
          <p>One-time $0.99 App Store download.</p>
          <img alt="QR code for Cleanote on the App Store" src={qrUrl(APP_STORE_URL)} />
          <a className="doc-primary" href={APP_STORE_URL} rel="noreferrer" target="_blank">
            Open App Store <ArrowRight aria-hidden="true" size={17} />
          </a>
        </article>

        <article>
          <div className="mobile-store-icon android">
            <Smartphone aria-hidden="true" size={28} />
          </div>
          <h2>Android</h2>
          <p>Use Google Play when Cleanote is available in your region.</p>
          <img alt="QR code for Cleanote on Google Play" src={qrUrl(GOOGLE_PLAY_URL)} />
          <a className="doc-secondary" href={GOOGLE_PLAY_URL} rel="noreferrer" target="_blank">
            Open Google Play <ArrowRight aria-hidden="true" size={17} />
          </a>
        </article>
      </section>

      <footer className="mobile-download-footer">
        <span>© {currentYear} KARIGARI HOME LLC DBA CLEANOTE. All Rights Reserved.</span>
        <nav aria-label="Mobile app footer links">
          <a href="/privacy">Privacy Policy</a>
          <a href="/terms">Terms of Service</a>
          <a href="/support">Support</a>
        </nav>
      </footer>
    </main>
  );
}
