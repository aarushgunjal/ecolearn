import { ArrowLeft, Leaf, ShieldCheck } from "lucide-react";

type LegalPage = "privacy" | "terms" | "delete-account" | "support" | "licenses";

export function Legal({
  page,
  onBack,
}: {
  page: LegalPage;
  onBack: () => void;
}) {
  const privacy = page === "privacy";
  const deletion = page === "delete-account";
  const support = page === "support";
  const licenses = page === "licenses";
  const heading = privacy
    ? "Privacy Policy"
    : deletion
      ? "Delete your EcoLearn account"
      : support
        ? "EcoLearn Support"
        : licenses
          ? "Open Source Licenses"
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
          Last updated: September 4, 2026
        </p>
        {privacy ? <PrivacyContent /> : deletion ? <AccountDeletionContent /> : support ? <SupportContent /> : licenses ? <LicensesContent /> : <TermsContent />}
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

function LicensesContent() {
  return (
    <article className="legal-copy mt-9 space-y-8 text-[15px] leading-7 text-[#435248]">
      <Section title="EcoLearn software">
        EcoLearn is proprietary software. No permission to copy, modify, or
        redistribute EcoLearn&apos;s own source code is granted by this page.
      </Section>
      <Section title="Open-source components">
        EcoLearn includes open-source software distributed under permissive
        licenses, including React, React Native, Expo, Supabase&apos;s JavaScript
        client, Leaflet, Lucide, Radix UI, and their dependencies. Their
        licenses and copyright notices remain the property of their respective
        authors.
      </Section>
      <Section title="Maps, product data, and educational sources">
        Map data is © OpenStreetMap contributors and is available under the
        Open Database License. Product information may be provided by Open Food
        Facts under its applicable database and content licenses. Delaware
        disposal guidance and linked educational media remain attributed to
        DNREC and DSWA.
      </Section>
      <Section title="Complete notices">
        The complete package list, license texts, source links, and required
        attributions are maintained in EcoLearn&apos;s Third-Party Notices file.
        <div className="mt-4">
          <a
            className="inline-flex rounded-xl bg-[#173d2a] px-4 py-3 font-bold text-white"
            href="/third-party-notices.txt"
          >
            Read Third-Party Notices
          </a>
        </div>
      </Section>
    </article>
  );
}

function SupportContent() {
  return (
    <article className="legal-copy mt-9 space-y-8 text-[15px] leading-7 text-[#435248]">
      <Section title="Get help">
        Email EcoLearn at <a className="font-bold underline underline-offset-2" href="mailto:aarushgunjal1@gmail.com?subject=EcoLearn%20support%20request">aarushgunjal1@gmail.com</a>. Include the device type, app version, what you were trying to do, and the exact error message. Do not include passwords, authentication codes, student records, or photos containing personal information.
      </Section>
      <Section title="Account and access">
        For sign-in trouble, first use <b>Forgot password?</b> in the app. Account deletion is available from Profile and through the public <a className="font-bold underline underline-offset-2" href="/delete-account">account-deletion page</a>.
      </Section>
      <Section title="Scanner and disposal guidance">
        Use one clear photo of a single item. EcoLearn only presents Delaware disposal instructions when it can verify a match against DNREC Recyclopedia data. A no-match response is intentional and safer than guessing. For hazardous, medical, battery, electronics, or chemical waste, confirm requirements with the responsible Delaware program before acting.
      </Section>
      <Section title="Privacy and safety">
        Never send support messages containing a password, precise home address, full student roster, or other sensitive student information. Community members can report an announcement or event and block its publisher directly in Community. Managers and EcoLearn administrators review reported content and may remove it. Review the <a className="font-bold underline underline-offset-2" href="/privacy">Privacy Policy</a> for details about current data handling.
      </Section>
    </article>
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
            <b>App activity:</b> scans, searches, lesson progress, XP, streaks,
            and settings. EcoLearn also records aggregate item-search and scan
            outcomes so administrators can see commonly requested or confusing
            items. Those aggregate events do not include photos, coordinates,
            or account identifiers.
          </li>
          <li>
            <b>Community content and safety records:</b> a student-safe public
            alias, classroom/community membership, manager-published
            announcements and events, event responses, reports, blocks, and
            moderator decisions. Reports include the selected reason and any
            optional details the reporter provides.
          </li>
          <li>
            <b>Photos:</b> a photo you select is processed to provide the scan
            or package-label result you request. The current scanner does not
            store those photos or use them for model training.
          </li>
          <li>
            <b>Location:</b> EcoLearn requests precise location only when you
            ask to find nearby disposal options. Your browser or device may let
            you share approximate location instead. Coordinates are sent to the
            lookup service for that search and are not saved to your EcoLearn
            profile by this feature.
          </li>
        </ul>
      </Section>
      <Section title="3. How we use information">
        We use information to operate the app, save your progress, improve scan
        guidance, prevent abuse, enforce community safety rules, investigate
        reports, hide blocked publishers, and respond to support requests. We do
        not sell personal information.
      </Section>
      <Section title="4. Service providers and disclosures">
        EcoLearn uses service providers to deliver the product, including
        Supabase for authentication, database, storage, and server functions;
        Apple and Google for optional sign-in; and OpenRouter and the selected
        model provider when you request an AI photo or label analysis. Barcode
        lookups may query Open Food Facts, maps may use OpenStreetMap data, and
        embedded educational videos may connect to YouTube. We share only the
        information needed to provide the feature you requested.
      </Section>
      <Section title="5. Your choices">
        You can permanently delete your account and associated app data from
        Profile settings in the mobile app. You may also use the public
        account-deletion page or contact us to request access to or correction
        of your personal information, subject to legal and operational limits.
        You can report community content, block its publisher, and later unblock
        that account from the Safety &amp; moderation section.
      </Section>
      <Section title="6. Security and retention">
        We use reasonable administrative and technical safeguards. No internet
        service can guarantee absolute security. We retain account and activity
        information while needed to operate EcoLearn. The current scanner does
        not retain submitted scan or package-label photos.
      </Section>
      <Section title="7. Elementary students and children under 13">
        EcoLearn is designed for educators, families, communities, and students,
        including elementary-school students. A child under 13 may use an
        account only with authorization and supervision from a parent or legal
        guardian, or through a school or district that is authorized to consent
        for the educational use. Children under 13 should not independently
        create an account or provide a personal email address.
        <p className="mt-3">
          For authorized student use, EcoLearn may process a student-safe alias,
          classroom or community membership, learning progress, XP, scans, and
          the optional photo or location information described above. EcoLearn
          does not sell this information, serve behavioral advertising, or use
          scanner photos to train models. Information authorized by a school is
          used only to provide the requested educational service.
        </p>
        <p className="mt-3">
          Parents, guardians, and authorizing schools may contact EcoLearn to
          review or request deletion of a child&apos;s information, stop further
          collection, or ask questions about the information used by the
          service. Before a classroom rollout, EcoLearn will provide the school
          or parent with direct notice of the applicable collection and obtain
          the authorization required for that deployment.
        </p>
      </Section>
      <Section title="8. Changes">
        We may update this policy as the product changes and will post the new
        effective date here.
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
        and any previously shared training-feedback photos stored under your
        user ID.
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
        Children under 13 may use EcoLearn only through a parent, legal guardian,
        or authorized school arrangement; they may not independently create a
        personal account.
      </Section>
      <Section title="4. Your content">
        You retain ownership of content you submit. You grant EcoLearn the
        limited permission needed to operate, display, protect, and moderate the
        feature you request. Manager-published announcements and events must be
        appropriate for the shared educational space and may be filtered,
        reported, or removed. Members may block a publisher. The current scanner
        does not store scan photos or use them for model training.
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
