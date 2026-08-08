import { ArrowLeft, Leaf, ShieldCheck } from "lucide-react";

type LegalPage = "privacy" | "terms" | "delete-account";

export function Legal({
  page,
  onBack,
}: {
  page: LegalPage;
  onBack: () => void;
}) {
  const privacy = page === "privacy";
  const deletion = page === "delete-account";
  const heading = privacy
    ? "Privacy Policy"
    : deletion
      ? "Delete your EcoLearn account"
      : "Terms of Service";
  return (
    <div className="min-h-screen bg-[#f7f8f4] text-[#16251e]">
      <header className="border-b border-[#e6e9e2] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-3xl items-center justify-between px-5 sm:px-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2.5"
            aria-label="Back to EcoLearn"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#173d2a] text-white">
              <Leaf size={19} fill="currentColor" />
            </span>
            <span className="text-xl font-semibold tracking-[-0.05em]">
              ecolearn
            </span>
          </button>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#42604b] hover:bg-[#eef4eb]"
          >
            <ArrowLeft size={16} /> Back to app
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#e5f2df] px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-[#347443]">
          <ShieldCheck size={14} /> EcoLearn legal
        </span>
        <h1 className="display-serif mt-5 text-4xl tracking-[-.055em] sm:text-5xl">
          {heading}
        </h1>
        <p className="mt-3 text-sm text-[#728076]">
          Last updated: August 7, 2026
        </p>
        {privacy ? <PrivacyContent /> : deletion ? <AccountDeletionContent /> : <TermsContent />}
        <section className="mt-10 rounded-2xl bg-[#e9f4e4] p-5 text-sm leading-6 text-[#42604b]">
          Questions or requests? Contact EcoLearn at{" "}
          <a
            className="font-bold underline underline-offset-2"
            href="mailto:aarushgunjal1@gmail.com"
          >
            aarushgunjal1@gmail.com
          </a>
          .
        </section>
      </main>
    </div>
  );
}

function PrivacyContent() {
  return (
    <article className="legal-copy mt-9 space-y-8 text-[15px] leading-7 text-[#435248]">
      <Section title="1. Overview">
        EcoLearn helps people learn sustainable habits and receive disposal
        guidance. This policy explains what information we collect, why we use
        it, and the choices you have.
      </Section>
      <Section title="2. Information we collect">
        <ul>
          <li>
            <b>Account information:</b> your email address, sign-in provider,
            and the name or profile image your provider shares when you create
            an account.
          </li>
          <li>
            <b>App activity:</b> scans, lesson progress, XP, streaks, settings,
            and feedback you submit.
          </li>
          <li>
            <b>Photos:</b> a scan photo is processed to provide a result. A
            photo is retained for model training only when it is an eligible
            example and you explicitly choose to share it. Those retained photos
            may be kept for up to 24 months for quality review and training.
          </li>
          <li>
            <b>Approximate location:</b> only when you ask to find nearby
            disposal options. It is used for that search and is not retained by
            EcoLearn for this feature.
          </li>
        </ul>
      </Section>
      <Section title="3. How we use information">
        We use information to operate the app, save your progress, improve scan
        guidance, prevent abuse, respond to support requests, and improve the
        classifier using only photos for which you gave the applicable consent.
        We do not sell personal information.
      </Section>
      <Section title="4. Service providers and disclosures">
        EcoLearn uses service providers to deliver the product, including
        Supabase for authentication, database, and storage; Google for optional
        Google sign-in; and, when you enable or separately consent to an AI
        feature, an approved AI provider for that requested analysis. Barcode
        and map features may query public product or map-data services. We share
        only the information needed to provide the feature you requested.
      </Section>
      <Section title="5. Your choices">
        You can choose whether an eligible feedback photo is shared for neural
        network training: always allow, ask every time, or send feedback without
        a photo. You can change the first two choices in Profile settings. You
        can permanently delete your account and associated app data from Profile
        settings in the mobile app. You may also use the public account-deletion
        page or contact us to request access to or correction of your personal
        information, subject to legal and operational limits.
      </Section>
      <Section title="6. Security and retention">
        We use reasonable administrative and technical safeguards. No internet
        service can guarantee absolute security. We retain account and activity
        information while needed to operate EcoLearn; training-consented photos
        are retained for up to 24 months unless a shorter period is required.
      </Section>
      <Section title="7. Children and changes">
        EcoLearn is not directed to children under 13. We may update this policy
        as the product changes and will post the new effective date here.
      </Section>
    </article>
  );
}

function AccountDeletionContent() {
  return (
    <article className="legal-copy mt-9 space-y-8 text-[15px] leading-7 text-[#435248]">
      <Section title="Delete in the mobile app">
        Sign in to EcoLearn, open <b>Profile</b>, select <b>Delete account</b>,
        and confirm the two deletion prompts. The request permanently deletes
        your account, saved progress, settings, activity tied to your account,
        and any training-feedback photos stored under your user ID.
      </Section>
      <Section title="If you cannot access the app">
        Email EcoLearn from the same email address used for your account. Use
        the subject “EcoLearn account deletion request” so we can verify and
        process the request without asking for your password.
        <div className="mt-4">
          <a
            className="inline-flex rounded-xl bg-[#173d2a] px-4 py-3 font-bold text-white"
            href="mailto:aarushgunjal1@gmail.com?subject=EcoLearn%20account%20deletion%20request"
          >
            Request account deletion
          </a>
        </div>
      </Section>
      <Section title="What to expect">
        Account deletion is permanent and cannot be undone. A request may need
        identity verification. Limited records may be retained only when needed
        for security, fraud prevention, legal compliance, or another permitted
        operational reason, and will not remain available as an active account.
      </Section>
    </article>
  );
}

function TermsContent() {
  return (
    <article className="legal-copy mt-9 space-y-8 text-[15px] leading-7 text-[#435248]">
      <Section title="1. Acceptance">
        By accessing or using EcoLearn, you agree to these Terms of Service. If
        you do not agree, do not use the service.
      </Section>
      <Section title="2. The service">
        EcoLearn provides educational content, item-classification tools, and
        disposal guidance. It is designed to help with everyday choices, not to
        replace local government rules, product instructions, or professional
        advice. Always verify hazardous-waste, medical-waste, battery,
        electronics, and chemical disposal requirements with your local program.
      </Section>
      <Section title="3. Accounts and acceptable use">
        You are responsible for activity under your account and for keeping
        credentials secure. Do not misuse the service, interfere with its
        operation, attempt unauthorized access, upload unlawful or harmful
        content, or use EcoLearn to infringe another person's rights.
      </Section>
      <Section title="4. Your content and feedback">
        You retain ownership of content you submit. You grant EcoLearn the
        limited permission needed to process your scans and feedback to operate
        the service. Training use of an eligible photo requires the separate,
        explicit photo choice shown when feedback is submitted; that choice can
        be changed in Profile settings for future submissions.
      </Section>
      <Section title="5. Availability and third-party services">
        We may modify, suspend, or discontinue features. Some features depend on
        third-party providers, public data, and network availability. EcoLearn
        does not guarantee that classification, barcode, map, or disposal
        results are complete, current, or error-free.
      </Section>
      <Section title="6. Disclaimers and liability">
        EcoLearn is provided on an "as is" and "as available" basis to the
        extent permitted by law. To the extent permitted by law, EcoLearn is not
        liable for indirect, incidental, special, consequential, or punitive
        damages arising from use of the service.
      </Section>
      <Section title="7. Changes and contact">
        We may update these terms as the service evolves. Continued use after a
        posted update means you accept the revised terms. Contact us using the
        address below with questions about these Terms.
      </Section>
    </article>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-bold tracking-[-.02em] text-[#173d2a]">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}
