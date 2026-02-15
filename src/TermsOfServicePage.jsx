function TermsOfServicePage() {
  return (
    <section className="legal-page">
      <div className="section-container">
        <div className="legal-header">
          <h1 className="legal-title">Terms of Service</h1>
          <p className="legal-subtitle">Effective Date: February 14, 2026</p>
        </div>

        <div className="legal-content">
          <section className="legal-section">
            <p>
              These Terms of Service ("Terms") govern your access to and use of IJGF's platform and Services. By creating an account or using our Services, you agree to be bound by these Terms. If you do not agree, please do not use the Services. We recommend you review these Terms carefully and print a copy for your records. We may update these Terms occasionally; any changes will be posted on our site.
            </p>
          </section>

          <section className="legal-section">
            <h2>1. Eligibility</h2>
            <p>
              To use our Services, you must be at least 18 years old. You represent and warrant that you are of legal age to form a binding contract and are not a minor. We do not permit individuals under 18 to use our platform. You are also responsible for complying with all applicable laws in your jurisdiction when using our Services. If you register on behalf of a company or entity, you affirm you have authority to do so.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Account Registration and KYC</h2>
            <p>
              You must create an account ("Account") to access the Services. When you register, you agree to:
            </p>
            <ul>
              <li>Provide true, accurate, and complete information about yourself, including any KYC information required (e.g. name, address, date of birth, ID documents). These details are necessary for identity verification and compliance with regulations.</li>
              <li>Keep your account credentials (username, password, API keys, etc.) secure and confidential. You are responsible for all activities that occur under your Account. Notify us immediately if you suspect any unauthorized use.</li>
              <li>Maintain and promptly update your information if it changes. You agree not to impersonate others or use another person's Account.</li>
            </ul>
            <p>
              We use third-party services (Supabase, Vercel, etc.) to host our platform and KYC providers (Sumsub, Onfido, Jumio) to verify identities. By creating an Account, you authorize us to share the personal information you provide with these service providers for identity verification.
            </p>
          </section>

          <section className="legal-section">
            <h2>3. Description of Services</h2>
            <p>
              IJGF provides a global crypto trading analytics platform. Our Services include:
            </p>
            <ul>
              <li><strong>Account Creation & Dashboard:</strong> You can create a user account to manage your profile, preferences, and connections.</li>
              <li><strong>KYC Verification:</strong> To comply with law, we require identity verification for all users. You must complete any KYC steps requested to use the Services.</li>
              <li><strong>Payments and Payouts:</strong> You may pay fees by credit/debit card (processed via Stripe) or other means. Payouts will be made in USDT or USDC to your wallet, as specified by you. We may require additional verification for large transactions.</li>
              <li><strong>Trading Analytics:</strong> We provide real-time trading analytics by connecting to your exchange accounts (Binance, Bybit, OKX, Bitget, etc.) via API. We act only as a data aggregator and do not execute trades for you on these exchanges. You remain solely responsible for your trading accounts and for authorizing any API access.</li>
              <li><strong>Leaderboards:</strong> We may display anonymized performance rankings or leaderboards. Your individual trading results may appear on leaderboards under a username or alias, but your personal identity remains confidential.</li>
              <li><strong>Customer Support:</strong> We provide email support for account issues and technical assistance via support@ijgf.com.</li>
            </ul>
            <p>
              We may introduce additional features or subscription services in the future (e.g. premium analytics). Any such features will be subject to these Terms or a supplemental agreement.
            </p>
          </section>

          <section className="legal-section">
            <h2>4. Fees, Subscriptions, and Profit Sharing</h2>
            <p>
              Some Services require payment:
            </p>
            <ul>
              <li><strong>Challenge/Account Fees:</strong> To participate in funded trading challenges or premium services, you must pay the required one-time fees (typically ranging from $49 to $999 depending on program). These fees are non-refundable except as required by law or at our discretion. Payment is made via Stripe or other payment processors; you agree to Stripe's terms of service and privacy policy for card transactions.</li>
              <li><strong>Subscription Fees:</strong> If we offer subscription-based services (e.g. premium analytics), you agree to pay the subscription fees and taxes as invoiced. Subscriptions automatically renew until canceled. All fees are charged in USD or stablecoin at current rates.</li>
              <li><strong>Profit Sharing:</strong> For certain trading programs (e.g. if you trade our capital or use our strategies), we may charge a share of your profits. You agree that up to 20–30% of any net profits you earn through our programs will be payable to IJGF as a commission, as detailed in the specific program terms. Payment of profit share is due within 30 days of the profit realization.</li>
            </ul>
            <p>
              All fees and payouts are specified on our platform. We reserve the right to change fees or introduce new charges by updating our site; we will provide reasonable notice of any substantial change.
            </p>
          </section>

          <section className="legal-section">
            <h2>5. Payment Authorization and Fraud Prevention</h2>
            <p>
              By providing payment information or linking your exchange and wallet accounts, you authorize IJGF (and its processors, like Stripe) to charge any fees and send payouts as applicable. You agree to immediately notify us of any billing issues or unauthorized charges. We may suspend or close your Account if we suspect fraudulent or unauthorized payment activity.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. User Conduct and Prohibited Activities</h2>
            <p>
              You agree not to use the Services for any illegal or unauthorized purpose. Specifically, you must not:
            </p>
            <ul>
              <li>Violate any laws, regulations, or third-party rights (including intellectual property, privacy, or contractual rights).</li>
              <li>Engage in trading activities that encourage or facilitate fraud, money laundering, or other illicit behavior.</li>
              <li>Provide false or misleading information to obtain KYC clearance or evade sanctions screening.</li>
              <li>Attempt to interfere with or disrupt our platform's security (e.g. hacking, denial-of-service, injecting malicious code).</li>
              <li>Use bots or automated systems to access or copy our content unless expressly authorized.</li>
              <li>Share or sell access to your account, or transfer data to a competitor.</li>
            </ul>
            <p>
              We reserve the right to investigate and take appropriate action (including disabling your account) if you breach these obligations.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Risk Acknowledgment and Disclaimer</h2>
            <p>
              <strong>Use at Your Own Risk:</strong> The Services provided by IJGF are for informational and trading analytics purposes only. We do not provide investment or financial advice. No materials on our site should be taken as investment advice. You acknowledge that trading cryptocurrencies is inherently risky and may result in loss of your capital. By using our Services, you represent that you understand these risks. You should not invest more than you can afford to lose.
            </p>
            <p>
              <strong>No Guarantees:</strong> IJGF does not guarantee the performance or profitability of any trading strategy or outcome. There is no assurance of any particular result. We do not guarantee investment performance, earnings or return of collateral. Past performance on leaderboards or analytics does not predict future results.
            </p>
            <p>
              <strong>Service Interruption:</strong> We do not promise uninterrupted or error-free operation of our platform. Our Services are provided "as is," and we disclaim all warranties (express or implied). We are not liable for losses due to service outages, errors, security breaches, or third-party failures.
            </p>
            <p>
              <strong>Not Responsible for Exchanges:</strong> If you link your accounts on other exchanges, you interact with those platforms at your own risk. IJGF is not responsible for any downtime, security breach, or decisions by those third-party exchanges.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Intellectual Property</h2>
            <p>
              All content, software, and trademarks on the IJGF platform are the property of IJGF or its licensors. You are granted a limited, revocable license to access and use the platform in accordance with these Terms. You agree not to reproduce, distribute, or create derivative works of our content without our permission.
            </p>
          </section>

          <section className="legal-section">
            <h2>9. Limitation of Liability</h2>
            <p>
              To the maximum extent allowed by law, IJGF (and its officers, employees, affiliates, agents, successors) will not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Services. Our total liability for any claim arising in connection with these Terms or the Services will not exceed the amount you have paid us in fees over the prior six months.
            </p>
          </section>

          <section className="legal-section">
            <h2>10. Indemnification</h2>
            <p>
              You agree to defend, indemnify, and hold harmless IJGF and its affiliates from any claims, losses, liabilities, damages, and expenses (including attorney's fees) arising from your violation of these Terms, your misuse of the Services, or your infringement of any rights of another.
            </p>
          </section>

          <section className="legal-section">
            <h2>11. Termination</h2>
            <p>
              We may suspend or terminate your access to the Services at any time, for any reason (including if you violate these Terms), without notice. Upon termination, your right to use the Services immediately ceases, but your payment obligations (e.g. for fees already incurred) and certain provisions (e.g. limitations of liability, dispute resolution) will survive. You may request account closure at any time by contacting support@ijgf.com.
            </p>
          </section>

          <section className="legal-section">
            <h2>12. Dispute Resolution</h2>
            <p>
              <strong>Governing Law:</strong> These Terms are governed by and construed in accordance with the laws of the State of Delaware, USA, without regard to conflict-of-law rules.
            </p>
            <p>
              <strong>Arbitration:</strong> Any dispute arising out of or relating to these Terms or your use of the Services will be resolved by binding arbitration administered by the American Arbitration Association ("AAA") under its Consumer Arbitration Rules. The arbitration will take place in Delaware. If the parties do not agree on an arbitrator within thirty (30) days of the demand for arbitration, the AAA will appoint one. The arbitrator shall apply Delaware law.
            </p>
            <p>
              <strong>Opt-Out:</strong> You have the right to opt out of arbitration. To opt out, you must send a written notice (by email to legal@ijgf.com) within 30 days of account registration stating your intent to opt out. If you opt out, disputes will be resolved in court as an individual.
            </p>
            <p>
              <strong>Small Claims:</strong> Under AAA rules, if the claimed amount is less than $10,000, the dispute will default to a document-only arbitration (no in-person hearing) unless one party requests a hearing. In that case, the hearing may proceed by telephone or video conference to minimize cost.
            </p>
            <p>
              <strong>No Class Actions:</strong> You and IJGF agree that any arbitration will proceed on an individual basis, and neither party will consolidate claims or participate in a class action.
            </p>
          </section>

          <section className="legal-section">
            <h2>13. Changes to Terms</h2>
            <p>
              IJGF may update these Terms from time to time. We will post any changes on our website or notify you by email if we have your contact information. You are responsible for reviewing updates. Continued use of the Services after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section className="legal-section">
            <h2>14. Miscellaneous</h2>
            <ul>
              <li><strong>Assignability:</strong> IJGF may assign or transfer these Terms in connection with a merger or sale. You may not assign your rights or obligations without our consent.</li>
              <li><strong>Severability:</strong> If any provision of these Terms is found unenforceable, that provision will be limited or eliminated to the minimum extent necessary so that the rest of the Terms remain in effect.</li>
              <li><strong>Waiver:</strong> Failure to enforce any right is not a waiver of that right.</li>
              <li><strong>Contact:</strong> For questions about these Terms, please contact us at legal@ijgf.com or support@ijgf.com.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>15. Acknowledgment</h2>
            <p>
              By using IJGF's Services, you acknowledge that you have read and agree to these Terms of Service and the Privacy Policy. Thank you for choosing IJGF for your trading analytics needs.
            </p>
            <p>
              <strong>IJGF is incorporated in Delaware, USA</strong>, and plans to pursue VARA (Virtual Assets Regulatory Authority) licensing in Dubai, UAE to expand as a globally regulated crypto proprietary trading platform.
            </p>
          </section>
        </div>
      </div>
    </section>
  )
}

export default TermsOfServicePage
