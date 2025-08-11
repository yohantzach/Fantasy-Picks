import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PrivacyPolicy() {
  return (
    <Card className="w-full bg-white/95 border-white/20">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-black text-center">
          Privacy Policy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 text-black text-sm">
            <div>
              <h3 className="font-semibold text-fpl-green mb-2">Introduction</h3>
              <p>
                This Privacy Policy describes how MR GANESH B and its affiliates (collectively "MR GANESH B, we, our, us") collect, use, share, protect or otherwise process your information/personal data through our website https://fantasy-picks.onrender.com/ (hereinafter referred to as Platform). We do not offer any product/service under this Platform outside India and your personal data will primarily be stored and processed in India.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-fpl-green mb-2">Information Collection</h3>
              <p>
                We collect your personal data when you use our Platform, services or otherwise interact with us during the course of our relationship. Some of the information that we may collect includes but is not limited to:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Personal data provided during sign-up/registering such as name, date of birth, address, telephone/mobile number, email ID</li>
                <li>Proof of identity or address information</li>
                <li>Bank account or credit/debit card or other payment instrument information (with your consent)</li>
                <li>Behavior, preferences, and other information you choose to provide on our Platform</li>
                <li>Transaction information on Platform and third-party business partner platforms</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-fpl-green mb-2">Usage of Information</h3>
              <p>
                We use personal data to provide the services you request. To the extent we use your personal data to market to you, we will provide you the ability to opt-out of such uses. We use your personal data to:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Assist sellers and business partners in handling and fulfilling orders</li>
                <li>Enhance customer experience and resolve disputes</li>
                <li>Inform you about online and offline offers, products, services, and updates</li>
                <li>Customize your experience and detect fraud and criminal activity</li>
                <li>Enforce our terms and conditions and conduct marketing research</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-fpl-green mb-2">Information Sharing</h3>
              <p>
                We may share your personal data internally within our group entities, our other corporate entities, and affiliates to provide you access to the services and products offered by them. We may disclose personal data to:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Third parties such as sellers, business partners, third party service providers</li>
                <li>Logistics partners, payment instrument issuers, third-party reward programs</li>
                <li>Government agencies or authorized law enforcement agencies if required by law</li>
                <li>Law enforcement offices, third party rights owners in good faith belief to protect rights and safety</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-fpl-green mb-2">Security Precautions</h3>
              <p>
                To protect your personal data from unauthorized access or disclosure, loss or misuse we adopt reasonable security practices and procedures. Once your information is in our possession, we adhere to our security guidelines to protect it against unauthorized access and offer the use of a secure server. However, users are responsible for ensuring the protection of login and password records for their account.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-fpl-green mb-2">Data Deletion and Retention</h3>
              <p>
                You have an option to delete your account by visiting your profile and settings on our Platform, this action would result in you losing all information related to your account. We retain your personal data information for a period no longer than is required for the purpose for which it was collected or as required under any applicable law.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-fpl-green mb-2">Your Rights</h3>
              <p>
                You may access, rectify, and update your personal data directly through the functionalities provided on the Platform.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-fpl-green mb-2">Consent</h3>
              <p>
                By visiting our Platform or by providing your information, you consent to the collection, use, storage, disclosure and otherwise processing of your information on the Platform in accordance with this Privacy Policy. You have an option to withdraw your consent by writing to the Grievance Officer at the contact information provided below.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-fpl-green mb-2">Grievance Officer</h3>
              <div className="space-y-1">
                <p><strong>Name:</strong> Ganesh B</p>
                <p><strong>Address:</strong> Fantasy Picks, G-19 20th Main Road, Palani Mithul Towers 1st floor, Annanagar Chennai 600040</p>
                <p><strong>Phone:</strong> 7540052627</p>
                <p><strong>Time:</strong> Monday - Friday (9:00 - 18:00)</p>
              </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
