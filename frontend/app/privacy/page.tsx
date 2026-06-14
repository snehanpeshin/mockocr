export default function PrivacyPage() {
  return (
    <main className="policy-shell">
      <article className="policy-content">
        <p className="eyebrow">Cleanote</p>
        <h1>Privacy Policy</h1>
        <p className="policy-date">Last updated: June 14, 2026</p>

        <section>
          <h2>What Cleanote Does</h2>
          <p>
            Cleanote helps users turn handwritten notes into editable and searchable text.
            Users can upload or capture note images, run optical character recognition, edit
            the extracted text, and save notes for later search.
          </p>
        </section>

        <section>
          <h2>Information We Collect</h2>
          <p>
            Cleanote may collect the name, email address, and role that you provide when
            requesting beta access. If you use the app, we process images or files that you
            choose to upload for OCR. We may also process extracted note text, edited note text,
            filenames, selected subject labels, and basic timestamps.
          </p>
        </section>

        <section>
          <h2>How We Use Information</h2>
          <p>
            We use your information to provide OCR, generate editable text, send beta access
            links, save notes when you choose to use cloud search, troubleshoot the service,
            and improve Cleanote.
          </p>
        </section>

        <section>
          <h2>Cloud Processing And Storage</h2>
          <p>
            Cleanote uses Amazon Web Services to run the backend. Uploaded note images may be
            sent to AWS services such as Amazon Textract for OCR. If AI cleanup is enabled,
            extracted text may be processed with Amazon Bedrock. If you save notes to cloud
            search, note text and related metadata may be stored in Amazon DynamoDB.
          </p>
        </section>

        <section>
          <h2>Local Storage</h2>
          <p>
            Cleanote may store saved notes and beta access status locally on your device or in
            your browser so the app can reopen notes and keep your session state.
          </p>
        </section>

        <section>
          <h2>Sharing</h2>
          <p>
            We do not sell your personal information. We share information only with service
            providers needed to operate Cleanote, comply with law, protect the service, or with
            your direction.
          </p>
        </section>

        <section>
          <h2>Your Choices</h2>
          <p>
            You can choose not to upload note images or not to save notes to cloud search. You
            can request deletion of beta access information or saved cloud notes by contacting
            us.
          </p>
        </section>

        <section>
          <h2>Children</h2>
          <p>
            Cleanote is intended for students, researchers, and professionals. It is not directed
            to young children. Users under the age required by local law should use Cleanote only
            with permission from a parent, guardian, school, or organization.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            For privacy questions or deletion requests, contact the Cleanote developer at the
            support email listed in Google Play Console.
          </p>
        </section>

        <a href="/">Back to Cleanote</a>
      </article>
    </main>
  );
}
