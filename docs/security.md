# Security model

## Trust boundaries

All public-schema tables have row-level security. Private data is scoped to the authenticated user or an authorized membership. Privileged functions explicitly grant execution to intended roles; anonymous callers cannot invoke security-definer functions. Worker-only helpers are unavailable to application accounts.

Public learning catalogs are readable without signing in. Clients cannot write administrator assignments, invitation ownership, notification jobs, lesson completion, or XP directly. Functions validate authorization and inputs even when the caller bypasses the interface.

## Administrator authentication

Administrator assignment is stored in a server-controlled table. Registration metadata and self-selected teacher status cannot create an administrator. Global administrator checks require the signed session claim `aal2`, established by Supabase after a valid authenticator challenge. The enrollment status endpoint reveals only the caller's assignment and verification state.

An administrator at `aal1` retains ordinary account capabilities, including management of spaces they legitimately own. They cannot use global administrator privileges. Changing frontend state, removing an authenticator, or signing in again does not bypass the server requirement. Backup authenticators support recovery without adding a weaker application-level bypass.

## Deletion and retention

Deleted communities and classrooms are inaccessible through active membership functions. Recovery requires the same ownership or administrative authority as deletion and is available only before the server-recorded seven-day deadline. Clients cannot extend the deadline by repeatedly deleting a space. Permanent cleanup is restricted to the worker service role and runs with the notification schedule; scheduler delays can delay physical removal but never extend recovery access.

Account deletion permanently discards the account's recoverable spaces. Restoring a community does not restore classrooms that were independently deleted. Earned individual learning progress is independent of community deletion.

## Data handling

Public client keys identify the backend and do not bypass row security. Service keys, provider credentials, authenticator setup secrets, and personal release material are never committed. TOTP setup secrets are displayed only during enrollment and are not logged or saved by the application.

Email and push delivery are opt-in. Each delivery verifies the destination and membership again. Sensitive classroom content is excluded from email and lock-screen previews. Server endpoints authenticate before handling user data or calling providers.

The web deployment sets Content Security Policy, HSTS, framing restrictions, MIME-type protections, and browser permission limits. Password length is enforced by Supabase. Compromised-password detection depends on the project's provider plan and is not claimed as an application feature.

## Validation

Tests cover privilege escalation, unauthenticated privileged RPC calls, administrator AAL transitions, cross-community access, invitation rotation, duplicate rewards, deletion and restoration, retention expiry, and delivery authorization. Browser tests cover authentication, classroom management, destructive-action confirmation, and shared navigation at desktop and mobile sizes. These checks reduce known risks; they do not constitute a guarantee against every vulnerability.
