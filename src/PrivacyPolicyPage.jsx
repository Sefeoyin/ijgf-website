function PrivacyPolicyPage() {
  return (
    <section className="legal-page">
      <div className="section-container">
        <div className="legal-header">
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-subtitle">Effective Date: February 14, 2026</p>
        </div>

        <div className="legal-content">
          <section className="legal-section">
            <h2>1. Introduction</h2>
            <p>
              Welcome to IJGF ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our crypto trading analytics platform at ijgf-website.vercel.app ("Platform").
            </p>
            <p>
              IJGF is incorporated in Delaware, USA, and plans to pursue VARA (Virtual Assets Regulatory Authority) licensing in Dubai, UAE to expand as a globally regulated crypto proprietary trading platform.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. Information We Collect</h2>
            <p>We collect information that you provide directly to us, including:</p>
            <ul>
              <li><strong>Account Information:</strong> Name, email address, password, and profile picture</li>
              <li><strong>KYC/Identity Verification:</strong> Government-issued ID, proof of address, date of birth for identity verification and regulatory compliance</li>
              <li><strong>Financial Information:</strong> Trading account balances, transaction history, profit/loss records, debit/credit card details (processed securely through Stripe), and crypto wallet addresses for USDT/USDC payouts</li>
              <li><strong>Trading Data:</strong> Real-time trading performance, exchange API connections (Binance, Bybit, OKX, Bitget), and trading statistics</li>
              <li><strong>Payment Information:</strong> Debit/credit card details via Stripe for challenge fee payments, crypto wallet addresses for payouts</li>
              <li><strong>Communication Data:</strong> Messages, feedback, support requests, and email communications</li>
              <li><strong>Usage Data:</strong> Information about how you use our Platform, including access times, pages viewed, IP address, browser type, and device information</li>
              <li><strong>Geolocation Data:</strong> For compliance, fraud prevention, and regulatory requirements</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, operate, and maintain our trading analytics platform</li>
              <li>Process KYC/identity verification through third-party providers (Sumsub, Onfido, or Jumio)</li>
              <li>Process challenge fee payments via Stripe and manage USDT/USDC payouts</li>
              <li>Connect to exchange APIs for real-time trading analytics and monitoring</li>
              <li>Display performance rankings on leaderboards (anonymized or by username)</li>
              <li>Evaluate trading performance and determine funding eligibility</li>
              <li>Process payments, withdrawals, and profit sharing (20-30% revenue share)</li>
              <li>Send you updates, security alerts, and administrative messages</li>
              <li>Respond to your comments, questions, and customer service requests via support@ijgf.com</li>
              <li>Improve our services and develop new features including premium analytics tools</li>
              <li>Prevent fraud, ensure platform security, and comply with legal obligations</li>
              <li>Enforce our Terms of Service and protect our rights</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>4. Information Sharing and Disclosure</h2>
            <p>We may share your information with the following third parties:</p>
            <ul>
              <li><strong>Payment Processors:</strong> Stripe (for debit/credit card payments - PCI-DSS compliant), crypto payment processors for USDT/USDC transactions</li>
              <li><strong>KYC/Verification Providers:</strong> Sumsub, Onfido, or Jumio for identity verification and regulatory compliance</li>
              <li><strong>Cloud Infrastructure:</strong> Vercel (hosting), Supabase (backend/database)</li>
              <li><strong>Exchange APIs:</strong> Binance, Bybit, OKX, Bitget for trade execution monitoring and analytics</li>
              <li><strong>Analytics Services:</strong> Google Analytics or similar for platform performance and user behavior analysis</li>
              <li><strong>Email Services:</strong> For transactional emails and notifications</li>
              <li><strong>Customer Support Tools:</strong> For ticket management and user assistance</li>
              <li><strong>Legal Requirements:</strong> When required by law, regulatory authorities, or to protect our rights and safety</li>
              <li><strong>Business Transfers:</strong> In connection with any merger, sale of assets, financing, or acquisition of all or a portion of our business</li>
              <li><strong>With Your Consent:</strong> When you explicitly agree to share your information</li>
            </ul>
            <p><strong>We do not sell your personal information to third parties.</strong></p>
          </section>

          <section className="legal-section">
            <h2>5. Data Security</h2>
            <p>
              We implement appropriate technical and organizational security measures to protect your personal information, including encryption, secure API connections, and access controls. Payment information is processed through Stripe using industry-standard PCI-DSS compliance. However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section className="legal-section">
            <h2>6. Data Retention</h2>
            <p>We retain your personal information as follows:</p>
            <ul>
              <li><strong>Active accounts:</strong> Data retained for the duration of account activity</li>
              <li><strong>Closed accounts:</strong> 7 years after account closure (for financial/tax compliance and legal requirements)</li>
              <li><strong>Trading records:</strong> 7 years (standard financial industry requirement)</li>
              <li><strong>KYC documents:</strong> 7 years after account closure (regulatory compliance)</li>
              <li><strong>Marketing communications:</strong> Until you unsubscribe or request deletion</li>
              <li><strong>Support tickets:</strong> 3 years after resolution</li>
            </ul>
            <p>
              You may request earlier deletion where legally permissible, subject to our regulatory and legal obligations. Contact privacy@ijgf.com to request data deletion.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Your Rights</h2>
            <p>Depending on your location, you may have the following rights:</p>
            <ul>
              <li><strong>Access:</strong> Request access to your personal information</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your data (subject to legal retention requirements)</li>
              <li><strong>Objection:</strong> Object to processing of your data</li>
              <li><strong>Restriction:</strong> Request restriction of processing</li>
              <li><strong>Data Portability:</strong> Request a copy of your data in a portable format</li>
              <li><strong>Withdraw Consent:</strong> Where we rely on consent, you may withdraw it at any time</li>
              <li><strong>Complaint:</strong> Lodge a complaint with a supervisory authority in your jurisdiction</li>
            </ul>
            <p>To exercise these rights, contact us at privacy@ijgf.com.</p>
          </section>

          <section className="legal-section">
            <h2>8. Cookies and Tracking Technologies</h2>
            <p>
              We use cookies and similar tracking technologies (including Google Analytics) to collect information about your browsing activities, improve user experience, and analyze platform performance. You can control cookies through your browser settings. Disabling cookies may affect certain features of the Platform.
            </p>
          </section>

          <section className="legal-section">
            <h2>9. Third-Party Services</h2>
            <p>
              Our Platform integrates with third-party services including Stripe (payments), Supabase (backend), Vercel (hosting), exchange APIs (Binance, Bybit, OKX, Bitget), and KYC providers. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies.
            </p>
          </section>

          <section className="legal-section">
            <h2>10. Children's Privacy</h2>
            <p>
              Our services are not directed to individuals under 18. We do not knowingly collect personal information from minors. If you are under 18, do not use our Platform or provide any personal information. If we learn we have collected information from a minor, we will delete it promptly.
            </p>
          </section>

          <section className="legal-section">
            <h2>11. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in the United States and other countries where our service providers operate. We ensure appropriate safeguards are in place for such transfers in accordance with applicable data protection laws, including GDPR for EU users.
            </p>
          </section>

          <section className="legal-section">
            <h2>12. GDPR Compliance (EU Users)</h2>
            <p>
              If you are located in the European Economic Area (EEA), we process your data in accordance with GDPR. Our legal bases for processing include:
            </p>
            <ul>
              <li><strong>Consent:</strong> For optional features and marketing communications</li>
              <li><strong>Contract Performance:</strong> To provide our services under our Terms of Service</li>
              <li><strong>Legal Obligation:</strong> To comply with KYC/AML regulations</li>
              <li><strong>Legitimate Interest:</strong> For fraud prevention and platform security</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>13. California Privacy Rights (CCPA)</h2>
            <p>
              California residents have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect, the right to delete information, and the right to opt-out of sales (though we do not sell personal information).
            </p>
          </section>

          <section className="legal-section">
            <h2>14. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. We will notify you of material changes by posting the updated policy on this page with a new "Effective Date" and, where appropriate, by email notification. Your continued use of the Platform after changes constitutes acceptance of the updated Privacy Policy.
            </p>
          </section>

          <section className="legal-section">
            <h2>15. Contact Us</h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
            </p>
            <p>
              <strong>Email:</strong><br />
              Privacy inquiries: privacy@ijgf.com<br />
              General support: support@ijgf.com<br />
              Legal matters: legal@ijgf.com
            </p>
            <p>
              <strong>Business Address:</strong><br />
              IJGF<br />
              Delaware, USA<br />
              (Full address to be provided)
            </p>
          </section>
        </div>
      </div>
    </section>
  )
}

export default PrivacyPolicyPage
