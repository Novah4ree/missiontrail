import { Text, View } from "react-native";

import { LegalDocumentScreen, legalStyles } from "@/components/legal-document-screen";

const EFFECTIVE_DATE = "September 14, 2026";

export default function PrivacyPolicyScreen() {
  return (
    <LegalDocumentScreen
      title="Privacy Policy"
      effectiveDate={EFFECTIVE_DATE}
      intro="Mission Trails is a location-based exploration app. This policy explains the information Mission Trails processes, why it is needed, the services that help process it, and the choices available to you."
      sections={[
        {
          heading: "1. Information You Provide",
          body: (
            <View>
              <Text style={legalStyles.bullet}>• Account and profile information, such as email address, display name, username, profile details, city, and state.</Text>
              <Text style={legalStyles.bullet}>• Onboarding information used for age and identity checks, including name, date of birth, city, state, and country.</Text>
              <Text style={legalStyles.bullet}>• If adult identity verification is used, the front image of the identity document you choose to submit. The image is transmitted for verification processing and is not intended to become a public profile image.</Text>
              <Text style={legalStyles.bullet}>• Support messages and other information you voluntarily provide to Mission Trails.</Text>
            </View>
          ),
        },
        {
          heading: "2. Location and Activity Data",
          body: (
            <View>
              <Text style={legalStyles.paragraph}>Mission Trails uses location because walking, trail discovery, relic proximity, and location verification are core features of the app.</Text>
              <Text style={legalStyles.bullet}>• Precise foreground location may be used when a feature needs to verify your current position, calculate proximity to a discovery, create a walking route, or track a trail you choose to start.</Text>
              <Text style={legalStyles.bullet}>• Approximate location may be sufficient for features that only need a general nearby area.</Text>
              <Text style={legalStyles.bullet}>• Motion or step information may be used to measure walking progress and mission progress.</Text>
              <Text style={legalStyles.bullet}>• Mission Trails does not display another user’s live precise GPS location as a public profile or map location.</Text>
            </View>
          ),
        },
        {
          heading: "3. Cameras, Photos, Microphone, and AR",
          body: "Camera access may be used for augmented-reality relic experiences and for identity-document submission when that verification flow is used. Photo-library access is used only when you choose a feature that requires selecting an image. Microphone or speech-recognition access is used only for voice features that you choose to use.",
        },
        {
          heading: "4. How We Use Information",
          body: "We use information to create and secure accounts; provide trails, discoveries, missions, companions, and purchases; verify proximity and walking progress; reduce spoofing, abuse, and fraud; perform age or identity-related access checks; provide support; maintain reliability and security; and comply with legal obligations.",
        },
        {
          heading: "5. Service Providers and Third Parties",
          body: (
            <View>
              <Text style={legalStyles.paragraph}>Mission Trails relies on service providers to operate core features. Depending on the feature you use, information may be processed by:</Text>
              <Text style={legalStyles.bullet}>• Supabase for authentication, database, storage, and server-side application functions.</Text>
              <Text style={legalStyles.bullet}>• OpenAI as part of the pre-account identity-information matching flow when an identity document is submitted.</Text>
              <Text style={legalStyles.bullet}>• Geoapify for geocoding and walking or hiking route services.</Text>
              <Text style={legalStyles.bullet}>• OpenStreetMap/Overpass services for nearby public trail, park, pedestrian, and map data.</Text>
              <Text style={legalStyles.bullet}>• Apple and Google for platform sign-in, app distribution, purchases, and platform services where applicable.</Text>
              <Text style={legalStyles.paragraph}>Mission Trails does not sell precise location data or identity-document images for advertising.</Text>
            </View>
          ),
        },
        {
          heading: "6. Discovery and Location Safety",
          body: "Production discoveries are intended to use server-verified public, pedestrian-accessible locations. Mission Trails is designed to reject locations that are inside buildings, on inaccessible or restricted property, in or over unsafe bodies of water, or near high-speed roads or dangerous intersections. Safety data can be incomplete or change in the real world, so users must obey signs, property boundaries, traffic laws, closures, and local conditions and must never enter an unsafe or unauthorized area to collect an item.",
        },
        {
          heading: "7. Retention",
          body: "We retain account and gameplay data while your account is active and as needed to provide the service. Location-verification records are designed to store verification summaries rather than raw route histories when possible. Some security, fraud-prevention, purchase, tax, legal, or transaction records may be retained for the period reasonably necessary for those purposes. Data that is no longer needed should be deleted or de-identified according to operational retention rules.",
        },
        {
          heading: "8. Account and Data Deletion",
          body: "You may initiate permanent account deletion from Privacy & Account > Delete Account. Deleting an account removes the Mission Trails authentication account and user-linked data that is not required to be retained for security, fraud prevention, legal, accounting, or transaction-record obligations. Records controlled independently by Apple, Google, or another provider are subject to that provider’s policies.",
        },
        {
          heading: "9. Children and Age-Based Access",
          body: "Mission Trails may limit features based on age or verification status. Location-based social, trail, meetup, or other restricted features should not be made available to a child account unless the feature is specifically designed and legally permitted for that age group. The app should not be used to publicly expose a child’s precise location.",
        },
        {
          heading: "10. Security",
          body: "Mission Trails uses authenticated server functions, access controls, private database schemas for sensitive discovery coordinates, and other technical safeguards. No system is perfectly secure, and users should protect their login credentials and report suspected unauthorized access.",
        },
        {
          heading: "11. Changes and Contact",
          body: "We may update this policy when Mission Trails changes. Material changes should be reflected by updating the effective date and, where appropriate, providing additional notice. For privacy questions or requests, use the Support page in Privacy & Account.",
        },
      ]}
    />
  );
}
