# EcoLearn Product Roadmap

_Working roadmap — July 2026. Priorities should be refined with Delaware
Department of Recycling feedback before a public pilot._

## Product principle

EcoLearn should make the correct action easier than the incorrect one:
**identify an item, understand why, find the right next step, and learn a
habit that lasts.** Accuracy, local authority, accessibility, and privacy take
priority over novelty.

## Now: meeting-ready and pilot-safe

### Finish and validate

- [ ] Deploy the **Explain with AI** Edge Function and scanner UI.
- [ ] Verify hourly GitHub Action scheduling and surface batch/run status in
  the admin area.
- [ ] Run end-to-end tests for sign-in, scanner, feedback consent, admin
  review, and retraining using test accounts.
- [ ] Create a small, representative test set of Delaware-relevant items and
  record accuracy, confidence, and incorrect-guidance examples.
- [ ] Add friendly empty, loading, offline, and AI-rate-limit states across
  scanner tools.

### Localize with the department

- [ ] Replace generic disposal guidance with department-approved Delaware
  rules, terminology, material lists, and site information.
- [ ] Establish a data owner and an update process for site hours, accepted
  materials, seasonal programs, and special collection events.
- [ ] Add a visible "verify locally" link for any answer that depends on a
  municipal program.
- [ ] Define how residents report an incorrect location or disposal rule.

### Pilot measurement

- [ ] Define success metrics: completed scans, guidance-view rate, feedback
  rate, repeat usage, lesson completion, and confirmed correct outcomes.
- [ ] Build a privacy-preserving pilot dashboard with aggregate usage and
  accuracy trends—not individual resident tracking.
- [ ] Recruit a small pilot group such as students, families, or a partner
  school/community organization.

## Next: improve guidance and trust

### Scanner intelligence

- [ ] Improve the classifier with only consented, human-reviewed examples.
- [ ] Add a confidence policy: low-confidence results should clearly say
  "uncertain," show alternatives, and recommend a safer next action.
- [ ] Expand label taxonomy carefully, beginning with high-impact categories:
  e-waste, batteries, films/bags, textiles, sharps, and food waste.
- [ ] Add an item-detail page that explains material composition, preparation,
  exceptions, and local alternatives.
- [ ] Add manual correction and better photo-capture tips before saving
  feedback.

### Location and data quality

- [ ] Use authoritative department or municipal datasets for drop-off sites
  and collection programs.
- [ ] Add filters for batteries, e-waste, paint, textiles, organics, bulky
  items, and household hazardous waste.
- [ ] Show hours, accessibility notes, accepted materials, source, and last
  verified date for each location.
- [ ] Support address/postal-code location selection without requiring device
  location access.

### Learning and engagement

- [ ] Make quests respond to real local programs and seasonal campaigns.
- [ ] Add age-appropriate pathways for schools, households, and community
  volunteers.
- [ ] Add badges for verified actions, not merely app activity.
- [ ] Offer classroom/community challenges with clear moderation and opt-in
  participation.

## Later: advanced vision (deferred until after the meeting)

- [ ] **Multi-object detection:** locate multiple discarded objects in one
  photo, draw a box around each, then classify every crop independently.
- [ ] Train the detector with annotated waste imagery such as TACO, keeping
  object localization separate from EcoLearn's disposal-class classifier.
- [ ] Add a review flow for proposed bounding boxes before user images can
  improve the detector.
- [ ] Allow a user to correct a single object in a multi-object image.
- [ ] Evaluate detection accuracy by object size, clutter, lighting, and
  relevant material types before any public claim of capability.

## Professional polish and accessibility

- [ ] Perform a mobile-first visual QA pass across phones, tablets, and
  desktop; test camera capture, keyboard navigation, and slow connections.
- [ ] Meet WCAG 2.2 AA expectations: color contrast, focus states, labels,
  screen-reader descriptions, and reduced-motion support.
- [ ] Add a concise onboarding flow explaining what the scanner can and cannot
  identify.
- [ ] Replace placeholder location text and any demo-only leaderboard entries
  before a public launch.
- [ ] Add operational monitoring: function errors, AI provider outages,
  classifier response times, and scanner failure rates.
- [ ] Establish backups, a security-review cadence, dependency updates, and an
  incident response contact.

## Partnership decisions to request

1. Which Delaware jurisdictions, facilities, and material streams should the
   first pilot cover?
2. Which official data source is the department comfortable EcoLearn using for
   disposal rules and drop-off locations?
3. Which categories create the most resident confusion or contamination today?
4. Could the department provide a small set of validated example items and
   correct outcomes for evaluation?
5. What privacy, youth-use, branding, and accessibility requirements must a
   pilot meet?
6. Who will own updates to changing program information after launch?

## Explicit non-goals for the first pilot

- Do not present AI guidance as legal, safety, or universally local disposal
  advice.
- Do not train on a resident's image without clear, revocable consent.
- Do not auto-promote a retrained model without validation gates and a rollback
  path.
- Do not claim multi-object detection until it has been trained, tested, and
  deployed.
