# Mission Trails Store Privacy Disclosure Draft

Updated: September 14, 2026

This checklist is based on the current `Krystal` code plus the `safety-privacy-hardening` changes. Re-check it whenever SDKs, permissions, onboarding, purchases, analytics, advertising, social features, or location behavior changes.

## Required public URLs before store submission

The Expo web build can expose the same legal routes used in the app. After a production web host/domain is configured, publish and verify these HTTPS URLs:

- Privacy Policy: `https://<production-domain>/privacy-policy`
- Account deletion / privacy choices: `https://<production-domain>/account-deletion`
- Support: `https://<production-domain>/support`
- Terms: `https://<production-domain>/terms`

Do not submit placeholder or broken URLs to Apple or Google.

## Google Play Data safety draft

Mission Trails transmits user data off device, so the Data safety form must not claim that no data is collected.

Likely data types to declare based on current code:

| Google data type | Collected? | Likely purpose | Notes |
| --- | --- | --- | --- |
| Precise location | Yes, when location features are used | App functionality; fraud prevention/security | Relic proximity, verified GPS, trail routing/tracking. Permission is foreground. |
| Approximate location | Yes, when location features are used | App functionality | Android declares coarse location as well as fine location. |
| Name | Yes | Account management; app functionality; security | Onboarding/profile and identity matching. |
| Email address | Yes | Account management; authentication | Supabase Auth. |
| User IDs | Yes | Account management; app functionality; security | Supabase Auth user id and user-linked records. |
| Other personal info | Yes | Account management; safety/security | Date of birth, city/state/country and profile fields. |
| Photos | Yes when ID verification is used | Account management; fraud prevention/security | Front of identity document is transmitted for verification processing. |
| Fitness info / physical activity | Yes when activity features are used | App functionality | Step/walking progress is used for missions and progress. Confirm the exact Play category wording in the current form. |
| Purchase history | Yes when purchases are made | App functionality; account management | Store purchase/product/transaction verification. Mission Trails does not directly receive full card details. |
| Other user-generated content | Yes when support is used | Developer communications / app functionality | Support ticket message. |

### Third-party processing to review in Data safety

- Supabase: authentication, database, server functions, and related backend services.
- OpenAI: identity-document information matching in the pre-account verification flow.
- Geoapify: geocoding and hiking/walking routing.
- OpenStreetMap / Overpass: nearby public-place and trail map queries.
- Apple / Google: platform authentication, app distribution, purchases, and platform services as applicable.
- Expo / React Native dependencies: audit each production SDK for any automatic diagnostics, identifiers, or telemetry before final submission.
- `@react-native-voice/voice`: verify whether the platform speech-recognition implementation transmits audio or transcripts off device on each supported OS and disclose as required.

Whether a service-provider transfer must be marked as "shared" in Google Play depends on the current Data safety definitions and whether the recipient qualifies for an applicable service-provider exception. Do not guess; verify the provider relationship and current Google form guidance before submission.

### Account deletion answers

- App supports account creation: **Yes**.
- In-app deletion path: **Yes**, `Profile > Privacy > Delete Account` after this branch is deployed.
- External web deletion resource: use the production HTTPS `/account-deletion` route after web deployment.
- Associated user data deletion: authentication account is hard-deleted; database records configured with `ON DELETE CASCADE` are deleted with the account. Validate any future storage buckets or non-cascading tables before launch.
- Retained data: only disclose a retention exception when it is actually implemented and justified (for example security, fraud prevention, legal, tax, or transaction obligations).

## Apple App Privacy draft

Review these App Privacy categories in App Store Connect based on actual production behavior:

- Contact Info: Name, Email Address.
- Location: Precise Location and Coarse Location when location features are used.
- User Content: Photos (identity-document image when verification is used); Customer Support content.
- Identifiers: User ID.
- Purchases: Purchase History when IAP is used.
- Fitness: steps/walking activity if the current App Privacy form categorizes the transmitted activity data this way.
- Other Data: date of birth and other onboarding/profile fields as required by the current App Privacy definitions.

For each selected data type, mark the actual purposes used by Mission Trails, primarily App Functionality, Account Management, and where applicable Fraud Prevention / Security. Do not mark tracking unless the production app actually uses data to track users across other companies' apps or websites.

App Store Connect also requires a Privacy Policy URL. The optional User Privacy Choices URL is a good place for the public `/account-deletion` route.

## Permission minimization check

Current intended location posture:

- iOS: When-In-Use location only.
- Android: coarse + fine foreground location permissions.
- No background location permission should be added unless a future feature genuinely requires it and policy review is completed first.
- Ask for location at the point the user opens a feature that needs it, not at first launch merely because the app contains location features.
- Features that can work with approximate location should not force precise location. Precise location should be reserved for proximity verification, active trail tracking/routing, or another feature that actually requires it.

## Location privacy and social features

- Relic exact coordinates are server-side/private until the reveal/collection flow permits an appropriate response.
- Meetup coordinates represent the approved public landmark, not an attendee's live location.
- Do not add attendee live latitude/longitude to meetup, friend, leaderboard, chat, or profile payloads.
- If future social proximity is added, return a coarse distance band or server-computed status instead of another user's raw coordinates.

## Final pre-submission audit

1. Deploy migrations and Edge Functions from this branch.
2. Revalidate safe spawn locations. The safety-v2 migration intentionally marks legacy verified rows stale unless the new safety fields explicitly pass.
3. Test account deletion using a disposable account and confirm the Auth user and linked rows disappear.
4. Test support ticket creation and confirm the ticket is stored only in the private schema.
5. Deploy the Expo web legal routes to a real HTTPS domain and test all four public URLs while logged out and logged in as appropriate.
6. Audit every production SDK and native permission in the release build, not just `package.json`.
7. Complete Google Play Data safety and deletion questions from the observed production behavior.
8. Complete Apple App Privacy from the observed production behavior.
9. Add the Privacy Policy URL, Support URL, and deletion/privacy choices URL to store metadata.
10. Re-run this audit whenever a new SDK, analytics tool, ad system, social feature, background task, or permission is introduced.
