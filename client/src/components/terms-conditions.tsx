import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogScrollArea } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function TermsAndConditions() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" className="text-fpl-green hover:text-green-400 p-0 text-xs">
          Terms & Conditions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Terms and Conditions</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4 text-sm text-black">
            <section>
              <h3 className="font-bold text-lg mb-2 text-black">1. ACCEPTANCE OF TERMS</h3>
              <p className="text-black">
                By accessing and using Fantasy Picks, you accept and agree to be bound by the terms and provision of this agreement.
                These terms and conditions are applicable to the website www.fantasypicks.com and the mobile application.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-black">2. ELIGIBILITY</h3>
              <ul className="list-disc pl-6 space-y-1 text-black">
                <li>Users must be 18 years or older to participate</li>
                <li>Users must be residents of India</li>
                <li>Employees and family members of Fantasy Picks are not eligible to participate in paid contests</li>
                <li>Users from Andhra Pradesh, Assam, Nagaland, Odisha, Sikkim, and Telangana are not allowed to participate in paid contests</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-black">3. GAME RULES</h3>
              <ul className="list-disc pl-6 space-y-1 text-black">
                <li>Each contest has a maximum team limit and entry fee</li>
                <li>Users can create multiple teams for a single match (subject to contest rules)</li>
                <li>Team selection deadline is before the scheduled match start time</li>
                <li>Points are awarded based on actual player performance in real matches</li>
                <li>All team changes must be made before the deadline</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-black">4. PAYMENT AND WITHDRAWALS</h3>
              <ul className="list-disc pl-6 space-y-1 text-black">
                <li>Entry fees are charged when joining paid contests</li>
                <li>Winnings are credited to user accounts after contest completion</li>
                <li>Minimum withdrawal amount is ₹200</li>
                <li>KYC verification is mandatory for withdrawals above ₹10,000</li>
                <li>Processing time for withdrawals is 3-7 business days</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-black">5. FAIR PLAY POLICY</h3>
              <ul className="list-disc pl-6 space-y-1 text-black">
                <li>Multiple accounts by the same user are strictly prohibited</li>
                <li>Sharing of team information is not allowed</li>
                <li>Any form of cheating or unfair practice will result in account suspension</li>
                <li>Fantasy Picks reserves the right to verify user identity</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-black">6. PRIZES AND TAXATION</h3>
              <ul className="list-disc pl-6 space-y-1 text-black">
                <li>TDS (Tax Deducted at Source) is applicable on winnings as per Indian tax laws</li>
                <li>30% TDS will be deducted on net winnings exceeding ₹10,000</li>
                <li>Users are responsible for reporting winnings in their tax returns</li>
                <li>TDS certificates will be provided for deducted amounts</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-black">7. CANCELLATION AND REFUNDS</h3>
              <ul className="list-disc pl-6 space-y-1 text-black">
                <li>Contests may be cancelled due to match cancellation or insufficient participants</li>
                <li>Entry fees are refunded in case of contest cancellation</li>
                <li>No refunds for user-initiated withdrawals from contests</li>
                <li>Refunds are processed within 7 working days</li>
              </ul>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-black">8. PRIVACY POLICY</h3>
              <p className="text-black">
                We are committed to protecting user privacy. Personal information is used only for account management,
                contest participation, and legal compliance. We do not share user data with third parties without consent,
                except as required by law.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-black">9. LIMITATION OF LIABILITY</h3>
              <p className="text-black">
                Fantasy Picks shall not be liable for any direct, indirect, incidental, or consequential damages arising
                from the use of our platform. Users participate at their own risk.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-black">10. MODIFICATIONS</h3>
              <p className="text-black">
                Fantasy Picks reserves the right to modify these terms and conditions at any time. Users will be notified
                of significant changes. Continued use of the platform constitutes acceptance of modified terms.
              </p>
            </section>

            <section>
              <h3 className="font-bold text-lg mb-2 text-black">11. CONTACT INFORMATION</h3>
              <p className="text-black">
                For questions regarding these terms, please contact us at:
                <br />
                Email: support@fantasypicks.com
                <br />
                Phone: +91-8000-123-456
              </p>
            </section>

            <p className="text-center text-xs text-gray-500 mt-8">
              Last updated: January 2025
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
