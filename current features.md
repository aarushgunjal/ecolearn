# EcoLearn — Current Features

_Snapshot for the Delaware Department of Recycling meeting — July 27, 2026_

EcoLearn is a gamified sustainable-action platform centered on making waste
disposal decisions easier, clearer, and more educational.

## Core user experience

- **Image-based waste scanner:** a user can photograph or upload a household
  item and receive an item class, confidence score, recycling status, disposal
  guidance, and practical preparation tips.
- **Text item lookup:** users can search by item name when taking a photo is
  inconvenient.
- **Clear uncertainty signals:** the scanner shows confidence and alternative
  classes instead of presenting every prediction as certain.
- **Explain with AI (ready to deploy):** a user-requested explanation can add
  context to broad classifications. For example, it can distinguish a TV
  remote from a loose battery and direct the user toward general e-waste or
  battery-collection guidance. The image is only sent after the user presses
  the button and is not stored by EcoLearn for this feature.

## Disposal tools

- **Barcode lookup:** supports product identification and material/disposal
  lookup where product data is available.
- **Read a label:** uses AI to read visible package material and recycling
  information from a user-selected image.
- **Disposal-location finder:** users can search for nearby disposal options by
  material category. It uses external place data, so results should always be
  confirmed with the local program before public rollout.
- **Scan history and personal impact:** signed-in users can review scans and
  see progress over time.

## Learning and motivation

- **Structured sustainability lessons:** lesson content includes a real lesson
  experience rather than a one-click completion state.
- **Progression:** lessons unlock in order and completed lessons persist to the
  user account.
- **Quests, XP, streak-style progress, and impact metrics:** the platform makes
  sustainable habits feel achievable and rewarding.
- **Leaderboard:** a community-facing ranking view encourages friendly
  participation.

## Accounts, privacy, and administration

- **Email/password and Google sign-in** through Supabase Authentication.
- **Remember-me session preference** and account/profile settings.
- **Profile controls:** users can update their display name, notification
  preference, and training-photo consent choice.
- **Consent-first feedback:** users can quickly mark a result as correct or
  incorrect. Photos are only retained for future training when the user makes
  an explicit choice to allow it.
- **Admin feedback review:** designated admins can review feedback, approve or
  reject training examples, and correct the label before examples reach the
  training pipeline.
- **Privacy Policy and Terms of Service** are available in the product.
- **Row Level Security and authenticated backend functions** protect user data
  and limit sensitive operations to the right user or admin role.

## Responsible model-improvement pipeline

- **Human-reviewed training data:** only consented images with an approved,
  normalized label are eligible for retraining.
- **Batch automation:** eligible examples are collected into configurable
  batches (currently 20). A GitHub Action checks for a queued batch hourly;
  it only launches training when a full batch exists.
- **Safety gate before promotion:** a candidate model must meet overall and
  hazardous-material recall thresholds before it replaces the active model.
- **Private data flow:** training data is handled as a private dataset, with
  model artifacts versioned before promotion.

## Important scope notes for the meeting

- The current classifier uses broad material/disposal classes. It is useful for
  guidance, but it is not a substitute for official local rules or hazardous
  waste instructions.
- Local acceptance rules, site hours, and special-program eligibility vary by
  jurisdiction. EcoLearn should use department-approved data for any Delaware
  public pilot.
- Multi-object detection (finding several objects in one photo and classifying
  each separately) is intentionally deferred until after the meeting.
- The AI explanation feature is implemented in the codebase and needs its
  normal backend/frontend deployment before it is shown to users.
