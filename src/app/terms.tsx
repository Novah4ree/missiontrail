import { Text, View } from "react-native";

import { LegalDocumentScreen, legalStyles } from "@/components/legal-document-screen";

const EFFECTIVE_DATE = "September 14, 2026";

export default function TermsScreen() {
  return (
    <LegalDocumentScreen
      title="Terms of Use"
      effectiveDate={EFFECTIVE_DATE}
      intro="These Terms govern use of Mission Trails. By creating an account or using the app, you agree to follow these rules and all applicable laws."
      sections={[
        {
          heading: "1. Use Mission Trails Safely",
          body: (
            <View>
              <Text style={legalStyles.bullet}>• Never trespass, enter a private home or private property without permission, cross a restricted boundary, or enter a closed area to reach a discovery.</Text>
              <Text style={legalStyles.bullet}>• Never enter a highway, active roadway, railroad area, dangerous intersection, body of water, construction zone, cliff, restricted facility, or other unsafe location to use the app.</Text>
              <Text style={legalStyles.bullet}>• Stay aware of traffic, weather, terrain, people, animals, posted signs, and real-world conditions. The real world always takes priority over an in-app marker.</Text>
              <Text style={legalStyles.bullet}>• Do not use Mission Trails while driving or operating a vehicle.</Text>
              <Text style={legalStyles.bullet}>• If a discovery appears unsafe or inaccessible, do not approach it. Leave the area and report the location through Support.</Text>
            </View>
          ),
        },
        {
          heading: "2. Location Accuracy",
          body: "GPS, map data, trail data, property boundaries, closures, and third-party geographic data can be inaccurate, delayed, or incomplete. Mission Trails does not guarantee that an in-app point is physically reachable or safe at a particular moment. You are responsible for evaluating actual conditions before proceeding.",
        },
        {
          heading: "3. Accounts",
          body: "You must provide accurate account information, protect your credentials, and use only accounts you are authorized to use. You may not impersonate another person, evade age or identity controls, sell accounts, automate abuse, or interfere with authentication or safety systems.",
        },
        {
          heading: "4. Location Spoofing and Abuse",
          body: "You may not falsify GPS, step, proximity, identity, purchase, or mission data; manipulate the app to reveal protected discovery coordinates; scrape private location information; or attempt to locate another user beyond information intentionally shared through an approved feature. Mission Trails may reject suspicious activity, revoke rewards, restrict features, or suspend accounts when reasonably necessary to protect users and the service.",
        },
        {
          heading: "5. Social Features and Meetups",
          body: "Treat other users respectfully and never use Mission Trails to stalk, harass, threaten, exploit, or expose someone’s private location or personal information. Meetups and social interactions are voluntary real-world activities. Use public places, follow age restrictions and local laws, and use independent judgment before meeting another person.",
        },
        {
          heading: "6. Purchases and Virtual Items",
          body: "Explorer coins, food, boosts, relics, companions, and other virtual items are digital features for use within Mission Trails and have no cash value unless the app expressly states otherwise. Purchases processed by Apple or Google are also subject to the applicable store’s payment, refund, and transaction terms.",
        },
        {
          heading: "7. Account Deletion",
          body: "You may permanently delete your Mission Trails account through Privacy & Account > Delete Account. Deletion is intended to remove the active authentication account and associated user-linked data, subject to limited retention required for security, fraud prevention, legal, accounting, or transaction obligations.",
        },
        {
          heading: "8. Intellectual Property",
          body: "Mission Trails software, branding, original artwork, game systems, text, and other original content are protected by applicable intellectual-property laws. Third-party maps, services, libraries, trademarks, and content remain subject to their respective owners’ rights and licenses.",
        },
        {
          heading: "9. Service Changes",
          body: "Features may change, be added, be removed, or become temporarily unavailable for maintenance, safety, security, legal, or technical reasons. Mission Trails may update these Terms when the service changes. Continued use after an effective update means you accept the revised Terms where permitted by law.",
        },
        {
          heading: "10. Disclaimer",
          body: "Mission Trails is an exploration and entertainment service, not an emergency, navigation-safety, law-enforcement, medical, or rescue service. Do not rely on the app for emergency decisions. To the maximum extent permitted by law, the service is provided without a guarantee that every map point, route, discovery, or third-party data source will always be accurate, available, or safe.",
        },
        {
          heading: "11. Support",
          body: "Questions about these Terms, account problems, purchases, unsafe discovery locations, or privacy requests can be submitted through the Support page in Privacy & Account.",
        },
      ]}
    />
  );
}
