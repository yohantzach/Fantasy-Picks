import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TermsAndConditions() {
  return (
    <Card className="w-full bg-white/95 border-white/20">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-black text-center">
          Terms & Conditions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6 text-black text-sm">
          <div>
            <h3 className="font-semibold text-fpl-green mb-3 text-base">1. ACCEPTANCE OF TERMS</h3>
            <p className="leading-relaxed">
              By accessing and using Fantasy Picks, you accept and agree to be bound by the terms and provision of this agreement.
              These terms and conditions are applicable to the website https://fantasy-picks.onrender.com/.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-fpl-green mb-3 text-base">2. ELIGIBILITY</h3>
            <div className="space-y-2">
              <p>• Users must be 18 years or older to participate</p>
              <p>• Users must be residents of India</p>
              <p>• Employees and family members of Fantasy Picks are not eligible to participate in paid contests</p>
              <p>• Users from Andhra Pradesh, Assam, Nagaland, Odisha, Sikkim, and Telangana are not allowed to participate in paid contests</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-fpl-green mb-3 text-base">3. GAME RULES</h3>
            <div className="space-y-2">
              <p>• Each contest has a maximum team limit and entry fee</p>
              <p>• Users can create multiple teams for a single contest (subject to contest rules)</p>
              <p>• Team selection deadline is before the scheduled match start time</p>
              <p>• Points are awarded based on actual player performance in real matches</p>
              <p>• All team changes must be made before the deadline</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-fpl-green mb-3 text-base">4. PAYMENT AND WITHDRAWALS</h3>
            <div className="space-y-2">
              <p>• Entry fees are charged when joining paid contests</p>
              <p>• Winnings are credited to user accounts after contest completion</p>
              <p>• KYC verification is mandatory for withdrawals above ₹10,000</p>
              <p>• Processing time for withdrawals is 3–7 business days</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-fpl-green mb-3 text-base">5. FAIR PLAY POLICY</h3>
            <div className="space-y-2">
              <p>• Multiple accounts by the same user are strictly prohibited</p>
              <p>• Any form of cheating or unfair practice will result in account suspension</p>
              <p>• Fantasy Picks reserves the right to verify user identity</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-fpl-green mb-3 text-base">6. PRIZES AND TAXATION</h3>
            <div className="space-y-2">
              <p>• TDS (Tax Deducted at Source) is applicable on winnings as per Indian tax laws</p>
              <p>• 30% TDS will be deducted on net winnings exceeding ₹10,000</p>
              <p>• Users are responsible for reporting winnings in their tax returns</p>
              <p>• TDS certificates will be provided for deducted amounts</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-fpl-green mb-3 text-base">7. CANCELLATION AND REFUNDS</h3>
            <div className="space-y-2">
              <p>• Contests may be cancelled due to match cancellation or insufficient participants</p>
              <p>• Entry fees are refunded in case of contest cancellation</p>
              <p>• No refunds for user-initiated withdrawals from contests</p>
              <p>• Refunds are processed within 7 working days</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-fpl-green mb-3 text-base">8. LIMITATION OF LIABILITY</h3>
            <p className="leading-relaxed">
              Fantasy Picks shall not be liable for any direct, indirect, incidental, or consequential damages arising from the use of our platform. Users participate at their own risk.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-fpl-green mb-3 text-base">9. MODIFICATIONS</h3>
            <p className="leading-relaxed">
              Fantasy Picks reserves the right to modify these terms and conditions at any time. Users will be notified of significant changes. Continued use of the platform constitutes acceptance of modified terms.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-fpl-green mb-3 text-base">10. CONTACT INFORMATION</h3>
            <p className="leading-relaxed">
              For questions regarding these terms, please contact us at:
            </p>
            <div className="mt-2 space-y-1">
              <p><strong>Email:</strong> fantasypicks09@gmail.com</p>
              <p><strong>Phone:</strong> +91-7540052627</p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-fpl-green mb-3 text-base">11. NO AFFILIATION WITH PREMIER LEAGUE</h3>
            <p className="leading-relaxed">
              Fantasy Picks is an independent platform and is not in any way affiliated, associated, authorized, endorsed by, or in any way officially connected with the Premier League, or any of its subsidiaries or affiliates.
              All names, marks, emblems, and images are used for identification purposes only and remain the property of their respective owners.
            </p>
          </div>

          <div className="border-t border-gray-300 pt-4 mt-6">
            <p className="text-xs text-gray-600 text-center">
              Last updated: January 2025
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
