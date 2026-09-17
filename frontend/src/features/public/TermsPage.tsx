/**
 * Terms of Service Page
 *
 * India-specific Terms of Service for AgentOps Studio.
 * Covers: IT Act 2000, Consumer Protection Act 2019, TRAI regulations,
 * call recording obligations, Stripe billing terms, Grievance Officer contact.
 *
 * ⚠️  FOUNDER ACTION REQUIRED before going live:
 *   1. Replace [REGISTERED ADDRESS] with your company's actual address
 *   2. Replace [GRIEVANCE OFFICER NAME] with the appointed officer's name
 *   3. Replace [LEGAL ENTITY NAME] with the registered company name (e.g. "Foo Technologies Pvt. Ltd.")
 *   4. Replace grievance@agentopsstudio.com / legal@agentopsstudio.com with real email addresses
 *   5. Review Section 16 (Governing Law) — change city if not Bengaluru
 *   6. Have a licensed Indian advocate review before publication
 */

const T = {
  bg:     '#030712',
  bgS:    '#0d1524',
  bgC:    '#111827',
  t1:     '#f8fafc',
  t2:     '#94a3b8',
  t3:     '#475569',
  blue:   '#3b82f6',
  violet: '#8b5cf6',
  border: 'rgba(255,255,255,0.07)',
  borderB:'rgba(59,130,246,0.18)',
};

const S = {
  section: {
    marginBottom: 44,
  } as React.CSSProperties,
  h2: {
    fontSize: 18,
    fontWeight: 700,
    color: T.t1,
    margin: '0 0 14px',
    paddingBottom: 10,
    borderBottom: `1px solid ${T.border}`,
  } as React.CSSProperties,
  h3: {
    fontSize: 14,
    fontWeight: 700,
    color: T.t1,
    margin: '20px 0 8px',
  } as React.CSSProperties,
  p: {
    fontSize: 14,
    color: T.t2,
    lineHeight: 1.75,
    margin: '0 0 12px',
  } as React.CSSProperties,
  li: {
    fontSize: 14,
    color: T.t2,
    lineHeight: 1.75,
    marginBottom: 6,
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 13,
    marginBottom: 14,
  } as React.CSSProperties,
  th: {
    textAlign: 'left' as const,
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 700,
    color: T.t3,
    background: 'rgba(255,255,255,0.03)',
    borderBottom: `1px solid ${T.border}`,
  } as React.CSSProperties,
  td: {
    padding: '8px 12px',
    color: T.t2,
    borderBottom: `1px solid rgba(255,255,255,0.04)`,
    verticalAlign: 'top' as const,
  } as React.CSSProperties,
  highlight: {
    background: 'rgba(59,130,246,0.08)',
    border: `1px solid ${T.borderB}`,
    borderRadius: 10,
    padding: '16px 20px',
    marginBottom: 20,
  } as React.CSSProperties,
  caps: {
    fontSize: 13,
    color: T.t2,
    lineHeight: 1.75,
    fontWeight: 600,
    letterSpacing: '0.01em',
  } as React.CSSProperties,
};

export default function TermsPage() {
  const EFFECTIVE_DATE = '29 July 2026';

  return (
    <div style={{ background: T.bg, minHeight: '100vh', color: T.t1 }}>
      {/* Hero */}
      <div
        style={{
          borderBottom: `1px solid ${T.border}`,
          padding: '56px 20px 40px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(59,130,246,0.12)', color: T.blue, border: `1px solid ${T.borderB}` }}>
              Effective {EFFECTIVE_DATE}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', color: T.t3, border: `1px solid ${T.border}` }}>
              Governing Law: India
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', color: T.t3, border: `1px solid ${T.border}` }}>
              Version 1.0
            </span>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 14px', color: T.t1 }}>
            Terms of Service
          </h1>
          <p style={{ fontSize: 15, color: T.t2, lineHeight: 1.65, maxWidth: 520, margin: '0 auto' }}>
            These Terms govern your use of AgentOps Studio. By using our platform, you agree to be bound by these Terms. Please read them carefully.
          </p>
        </div>
      </div>

      {/* Document Body */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 20px 80px' }}>

        {/* Section 1 */}
        <div style={S.section}>
          <h2 style={S.h2}>1. Agreement to Terms</h2>
          <p style={S.p}>
            These Terms of Service ("Terms") form a legally binding agreement between you ("User," "Customer," or "Organisation") and AgentOps Studio ("[LEGAL ENTITY NAME]," "we," "us," or "our"), governing your access to and use of the AgentOps Studio platform, AI voice agent software, APIs, and related services (collectively, the "Service").
          </p>
          <p style={S.p}>
            By registering an account, clicking "I agree," or otherwise accessing or using the Service, you confirm that you have read, understood, and agree to be bound by these Terms. If you are accepting on behalf of a company or other legal entity, you represent that you have authority to bind that entity, and "you" refers to that entity.
          </p>
          <div style={S.highlight}>
            <p style={{ ...S.p, margin: 0, fontWeight: 600, color: T.t1 }}>
              IF YOU DO NOT AGREE TO THESE TERMS, DO NOT USE THE SERVICE.
            </p>
          </div>
        </div>

        {/* Section 2 */}
        <div style={S.section}>
          <h2 style={S.h2}>2. Definitions</h2>
          <p style={S.p}>"<strong style={{ color: T.t1 }}>Platform</strong>" means the AgentOps Studio web application, APIs, and associated software.</p>
          <p style={S.p}>"<strong style={{ color: T.t1 }}>Voice Agent</strong>" means an AI-powered automated calling agent configured through the Platform.</p>
          <p style={S.p}>"<strong style={{ color: T.t1 }}>Call Data</strong>" means recordings, transcripts, and metadata associated with calls made via the Platform.</p>
          <p style={S.p}>"<strong style={{ color: T.t1 }}>Organisation</strong>" means the account entity created by the first registered user (the "Owner").</p>
          <p style={S.p}>"<strong style={{ color: T.t1 }}>Subscription Plan</strong>" means the Free, Starter, or Growth tier to which an Organisation subscribes.</p>
          <p style={S.p}>"<strong style={{ color: T.t1 }}>SPDI</strong>" or "<strong style={{ color: T.t1 }}>Sensitive Personal Data or Information</strong>" has the meaning ascribed under Rule 3 of the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011.</p>
          <p style={S.p}>"<strong style={{ color: T.t1 }}>TRAI</strong>" means the Telecom Regulatory Authority of India.</p>
        </div>

        {/* Section 3 */}
        <div style={S.section}>
          <h2 style={S.h2}>3. Eligibility</h2>
          <p style={S.p}>You must be at least 18 years of age to use the Service. By using the Service, you represent and warrant that:</p>
          <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
            {[
              'You are at least 18 years old and have legal capacity to enter into this agreement;',
              'You are not located in a jurisdiction where use of the Service would be illegal or violate applicable law;',
              'You are not barred from receiving services under any applicable law, including orders of any Indian regulatory authority.',
            ].map((item, i) => <li key={i} style={S.li}>{item}</li>)}
          </ul>
        </div>

        {/* Section 4 */}
        <div style={S.section}>
          <h2 style={S.h2}>4. Account Registration</h2>
          <p style={S.p}>4.1 You must provide accurate, current, and complete information during registration and keep your account information updated at all times.</p>
          <p style={S.p}>4.2 You are solely responsible for maintaining the confidentiality of your account credentials, including passwords and API keys.</p>
          <p style={S.p}>4.3 You are responsible for all activities that occur under your account, whether or not authorised by you.</p>
          <p style={S.p}>4.4 One Organisation may have multiple team members. The Organisation Owner is responsible for all team members' compliance with these Terms.</p>
          <p style={S.p}>4.5 If you become aware of any unauthorised use of your account, notify us immediately at support@agentopsstudio.com. We are not liable for any loss arising from unauthorised use prior to notification.</p>
        </div>

        {/* Section 5 */}
        <div style={S.section}>
          <h2 style={S.h2}>5. Description of Service</h2>
          <p style={S.p}>AgentOps Studio provides an AI-powered voice agent platform enabling businesses to:</p>
          <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
            {[
              'Deploy automated calling agents for inbound and outbound telephone communications;',
              'Configure knowledge bases to enable AI-assisted, context-aware responses;',
              'Process calls in English, Hindi, and Punjabi;',
              'Monitor call quality, analytics, and agent performance metrics;',
              'Manage team access, integrations with third-party telephony providers, and billing.',
            ].map((item, i) => <li key={i} style={S.li}>{item}</li>)}
          </ul>
          <p style={S.p}>We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time with reasonable prior notice, except where immediate action is required to address security, legal, or compliance concerns.</p>
        </div>

        {/* Section 6 */}
        <div style={S.section}>
          <h2 style={S.h2}>6. Subscription Plans & Billing</h2>
          <h3 style={S.h3}>6.1 Plan Tiers</h3>
          <p style={S.p}>The Service is offered under three plans — Free, Starter (₹4,999/month), and Growth (₹12,999/month). Feature availability and usage limits vary by plan and are described on the Pricing page. We may introduce additional plans or modify existing plans with 30 days' notice.</p>

          <h3 style={S.h3}>6.2 Billing Cycle</h3>
          <p style={S.p}>Paid subscriptions are billed monthly in advance. Your subscription auto-renews on the same calendar day each month unless cancelled before the renewal date.</p>

          <h3 style={S.h3}>6.3 Payment Processing</h3>
          <p style={S.p}>Payments are processed by Stripe, Inc. By providing payment details, you authorise us to charge your payment method for all applicable fees and any taxes. Stripe's Terms of Service and Privacy Policy govern all payment processing. We do not store full payment card numbers; only your Stripe Customer ID is retained in our systems.</p>

          <h3 style={S.h3}>6.4 GST & Invoicing</h3>
          <p style={S.p}>All prices are exclusive of Goods and Services Tax (GST). GST will be applied at the prevailing rate on invoices where required under Indian tax law. GST-compliant invoices are available in your billing dashboard and on request.</p>

          <h3 style={S.h3}>6.5 Price Changes</h3>
          <p style={S.p}>We will provide at least 30 days' advance written notice (via email) of any price changes. Continued use after the new price takes effect constitutes your acceptance of the revised pricing.</p>

          <h3 style={S.h3}>6.6 Failed Payments</h3>
          <p style={S.p}>If a payment fails, we will retry the charge up to three times and notify you by email. Persistent payment failure may result in suspension or downgrade of your account. We are not liable for service disruption caused by your payment failure.</p>

          <h3 style={S.h3}>6.7 Usage Limits & Overages</h3>
          <p style={S.p}>Each plan includes defined call minute limits per month. Call minutes reset on the first day of each calendar month. Calls initiated when your organisation has exhausted its monthly limit may be rejected until the limit resets or you upgrade your plan. We do not automatically charge overages; upgrading to unlock additional capacity is your responsibility.</p>
        </div>

        {/* Section 7 */}
        <div style={S.section}>
          <h2 style={S.h2}>7. Free Trial</h2>
          <p style={S.p}>7.1 We may offer a free trial period for paid plans. During a free trial, you can access the Service without charge for the specified duration.</p>
          <p style={S.p}>7.2 If you do not cancel before the trial ends, your account will automatically convert to the applicable paid plan and your payment method will be charged.</p>
          <p style={S.p}>7.3 We reserve the right to modify or terminate free trial offerings at any time without liability.</p>
        </div>

        {/* Section 8 */}
        <div style={S.section}>
          <h2 style={S.h2}>8. Refund & Cancellation Policy</h2>
          <h3 style={S.h3}>8.1 Cancellation</h3>
          <p style={S.p}>You may cancel your subscription at any time through the Stripe Customer Portal accessible from your Billing page. Upon cancellation, your access to paid features continues until the end of your current billing period. No further charges will be made after cancellation.</p>

          <h3 style={S.h3}>8.2 Refund Policy</h3>
          <p style={S.p}>Subscription fees are non-refundable for the current billing period, except:</p>
          <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
            <li style={S.li}>Where required by applicable consumer protection law in India, including the Consumer Protection Act, 2019; or</li>
            <li style={S.li}>Where you notify us of a material, reproducible service failure within 7 days of occurrence and we are unable to remediate it within a reasonable timeframe.</li>
          </ul>
          <p style={S.p}>Refund requests must be submitted to support@agentopsstudio.com with a description of the issue. We will review and respond within 7 business days.</p>

          <h3 style={S.h3}>8.3 Downgrade</h3>
          <p style={S.p}>Downgrading to a lower plan takes effect at the end of the current billing period. No partial-month refunds are issued for unused days on the higher plan.</p>

          <h3 style={S.h3}>8.4 Account Closure & Data Deletion</h3>
          <p style={S.p}>To permanently delete your account and all associated data, contact support@agentopsstudio.com. Data deletion will be completed within 30 days in accordance with our Privacy Policy and applicable data retention obligations.</p>
        </div>

        {/* Section 9 */}
        <div style={S.section}>
          <h2 style={S.h2}>9. Acceptable Use Policy</h2>
          <p style={S.p}>You agree not to use the Service to:</p>
          <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
            {[
              'Place calls to numbers registered on the TRAI DND (Do Not Disturb) registry in violation of the Telecom Commercial Communications Customer Preference Regulations, 2018;',
              'Conduct unsolicited commercial communications (spam calls, robocalls) in violation of applicable TRAI regulations;',
              'Engage in harassment, abuse, threats, or illegal discrimination against any person or group;',
              'Impersonate any person, organisation, or government authority in a deceptive manner;',
              'Distribute malware, engage in phishing, denial-of-service attacks, or other cyberattacks contrary to the IT Act 2000;',
              'Process calls for illegal purposes, including fraud, money laundering, or financing of terrorism;',
              'Violate the privacy or data protection rights of third parties, including callers or callees;',
              'Resell, sublicense, or white-label the Service without our express written permission;',
              'Reverse engineer, decompile, disassemble, or attempt to extract the source code of the Service;',
              'Use the Service in any manner that may cause harm to minors or expose them to inappropriate content.',
            ].map((item, i) => <li key={i} style={S.li}>{item}</li>)}
          </ul>
          <p style={S.p}>Violation of this Acceptable Use Policy may result in immediate account suspension without refund, and we may report serious violations to relevant Indian authorities including the Ministry of Electronics and Information Technology (MeitY) and TRAI.</p>
        </div>

        {/* Section 10 */}
        <div style={S.section}>
          <h2 style={S.h2}>10. Voice AI Services & Call Recording</h2>
          <h3 style={S.h3}>10.1 Call Recording Obligations</h3>
          <p style={S.p}>The Service enables recording of telephone calls handled by AI Voice Agents. As the deploying business, you are solely responsible for:</p>
          <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
            <li style={S.li}>Informing callers at the commencement of each call that the conversation may be recorded;</li>
            <li style={S.li}>Obtaining legally sufficient consent from all parties to the call before recording, in accordance with the Indian Telegraph Act, 1885 and applicable TRAI regulations;</li>
            <li style={S.li}>Maintaining auditable records of consent where required; and</li>
            <li style={S.li}>Including recording disclosures in your TRAI-compliant telemarketer registration.</li>
          </ul>

          <h3 style={S.h3}>10.2 TRAI Compliance</h3>
          <p style={S.p}>You are responsible for ensuring all outbound calls comply with applicable TRAI regulations, including correct use of approved telemarketer identity headers (CLI/ANI), compliance with calling hour restrictions, and respect for DND preferences.</p>

          <h3 style={S.h3}>10.3 AI Accuracy Disclaimer</h3>
          <p style={S.p}>Voice Agents powered by Large Language Models may occasionally produce inaccurate or unexpected responses. You are responsible for testing agent behaviour before deployment, reviewing AI-generated responses, and maintaining appropriate human oversight for sensitive, regulated, or high-stakes use cases (including financial advice, medical information, and legal guidance).</p>

          <h3 style={S.h3}>10.4 Language Support</h3>
          <p style={S.p}>English, Hindi, and Punjabi are currently supported. Accuracy may vary by language and dialect. We do not warrant that language processing will be free from errors or misinterpretations.</p>
        </div>

        {/* Section 11 */}
        <div style={S.section}>
          <h2 style={S.h2}>11. Intellectual Property Rights</h2>
          <p style={S.p}><strong style={{ color: T.t1 }}>Our IP.</strong> All rights, title, and interest in the Service — including software, algorithms, models, trademarks, logos, and documentation — are owned by or licensed to AgentOps Studio. These Terms do not transfer any ownership rights to you.</p>
          <p style={S.p}><strong style={{ color: T.t1 }}>Your Content.</strong> You retain ownership of all content you upload or create within the Service (knowledge base documents, call scripts, agent configurations) ("User Content"). By uploading User Content, you grant us a limited, non-exclusive, royalty-free licence to use, process, and store it solely to provide and improve the Service for your Organisation.</p>
          <p style={S.p}><strong style={{ color: T.t1 }}>Feedback.</strong> Any feedback, suggestions, or feature ideas you provide may be used by us without obligation or compensation.</p>
          <p style={S.p}><strong style={{ color: T.t1 }}>Restrictions.</strong> You must not remove or alter any proprietary notices, branding, or watermarks on or within the Service.</p>
        </div>

        {/* Section 12 */}
        <div style={S.section}>
          <h2 style={S.h2}>12. Third-Party Services & Data Processors</h2>
          <p style={S.p}>The Service integrates with the following third-party providers to deliver its functionality:</p>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Provider</th>
                <th style={S.th}>Purpose</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Stripe, Inc.', 'Payment processing and subscription management'],
                ['Vapi AI', 'Voice orchestration layer'],
                ['Deepgram, Inc.', 'Speech-to-text transcription'],
                ['OpenAI, LLC', 'Large language model inference'],
                ['ElevenLabs, Inc.', 'Text-to-speech audio synthesis'],
                ['Ilaimitado Private Limited (Vobiz)', 'Telephony and SIP routing'],
              ].map(([p, desc]) => (
                <tr key={p}>
                  <td style={{ ...S.td, fontWeight: 600, color: T.t1 }}>{p}</td>
                  <td style={S.td}>{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={S.p}>Use of each provider's services is subject to their respective terms of service and privacy policies. We are not liable for any acts, omissions, data breaches, or service failures of any third-party provider.</p>
        </div>

        {/* Section 13 */}
        <div style={S.section}>
          <h2 style={S.h2}>13. Disclaimers</h2>
          <div style={{ ...S.highlight, background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}` }}>
            <p style={{ ...S.caps, margin: 0 }}>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE; THAT ERRORS IN THE SERVICE WILL BE CORRECTED; OR THAT THE SERVICE OR THE SERVERS HOSTING IT ARE FREE FROM VIRUSES OR OTHER HARMFUL COMPONENTS.
            </p>
          </div>
        </div>

        {/* Section 14 */}
        <div style={S.section}>
          <h2 style={S.h2}>14. Limitation of Liability</h2>
          <div style={{ ...S.highlight, background: 'rgba(255,255,255,0.02)', border: `1px solid ${T.border}` }}>
            <p style={{ ...S.caps, margin: '0 0 10px' }}>
              14.1 TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, AGENTOPS STUDIO SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS INTERRUPTION, ARISING FROM YOUR USE OF THE SERVICE.
            </p>
            <p style={{ ...S.caps, margin: 0 }}>
              14.2 OUR TOTAL CUMULATIVE LIABILITY ARISING FROM OR RELATING TO THESE TERMS SHALL NOT EXCEED THE GREATER OF: (A) THE TOTAL FEES YOU PAID US IN THE THREE (3) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO LIABILITY; OR (B) ₹10,000.
            </p>
          </div>
          <p style={S.p}>14.3 Nothing in these Terms excludes or limits liability for death or personal injury caused by our negligence, or for any fraudulent misrepresentation, or for any other liability that cannot be excluded under applicable Indian law.</p>
        </div>

        {/* Section 15 */}
        <div style={S.section}>
          <h2 style={S.h2}>15. Indemnification</h2>
          <p style={S.p}>You agree to indemnify, defend, and hold harmless AgentOps Studio and its officers, directors, employees, contractors, and agents from and against any claims, liabilities, damages, losses, penalties, and expenses (including reasonable legal fees) arising from or relating to:</p>
          <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
            {[
              'Your use or misuse of the Service;',
              'Your violation of these Terms or applicable law, including TRAI regulations;',
              'Your violation of any third party\'s rights, including data protection rights of callers and callees;',
              'Any User Content you upload, process, or transmit through the Service; or',
              'Any calls placed by your Voice Agents that violate applicable Indian telecommunications law.',
            ].map((item, i) => <li key={i} style={S.li}>{item}</li>)}
          </ul>
        </div>

        {/* Section 16 */}
        <div style={S.section}>
          <h2 style={S.h2}>16. Governing Law & Dispute Resolution</h2>
          <p style={S.p}><strong style={{ color: T.t1 }}>Governing Law.</strong> These Terms shall be governed by and construed in accordance with the laws of the Republic of India, without regard to its conflict of law provisions.</p>
          <p style={S.p}><strong style={{ color: T.t1 }}>Informal Resolution.</strong> Before initiating formal proceedings, the parties agree to attempt in good faith to resolve any dispute by contacting us at legal@agentopsstudio.com. We will respond within 30 days.</p>
          <p style={S.p}><strong style={{ color: T.t1 }}>Arbitration.</strong> If informal resolution fails within 60 days, any dispute arising out of or in connection with these Terms shall be referred to binding arbitration under the Arbitration and Conciliation Act, 1996 (as amended). The arbitration shall be conducted in English, seated in Bengaluru, Karnataka, by a sole arbitrator mutually agreed upon by the parties. The arbitrator's decision shall be final and binding.</p>
          <p style={S.p}><strong style={{ color: T.t1 }}>Jurisdiction.</strong> For any disputes not subject to arbitration, you irrevocably consent to the exclusive jurisdiction of the civil courts of Bengaluru, Karnataka, India.</p>
          <p style={S.p}><strong style={{ color: T.t1 }}>Injunctive Relief.</strong> Nothing in this section prevents either party from seeking urgent injunctive or other equitable relief from a court of competent jurisdiction.</p>
        </div>

        {/* Section 17 */}
        <div style={S.section}>
          <h2 style={S.h2}>17. Changes to These Terms</h2>
          <p style={S.p}>We may update these Terms from time to time. For material changes, we will notify you by email at the address associated with your account at least 30 days before the changes take effect. Non-material changes (e.g., typo fixes, clarifications) take effect upon posting with the updated effective date.</p>
          <p style={S.p}>Your continued use of the Service after the effective date of revised Terms constitutes your acceptance of those Terms. If you do not agree to the revised Terms, you must stop using the Service before they take effect.</p>
        </div>

        {/* Section 18 */}
        <div style={S.section}>
          <h2 style={S.h2}>18. Termination</h2>
          <p style={S.p}>18.1 We may terminate or suspend your account immediately and without prior notice if you breach any material provision of these Terms, engage in conduct that poses a risk to us or other users, or if required to do so by law or regulatory authority.</p>
          <p style={S.p}>18.2 You may terminate your account at any time by cancelling your subscription via the Customer Portal and contacting support@agentopsstudio.com to request permanent account deletion.</p>
          <p style={S.p}>18.3 Upon termination for any reason: your right to access the Service ceases immediately; data deletion follows the schedule set out in our Privacy Policy; and any outstanding fees become immediately due and payable.</p>
          <p style={S.p}>18.4 Sections 2, 7 (refunds for the current billing period), 10 (recording obligations), 11, 13, 14, 15, 16, and 20 shall survive termination.</p>
        </div>

        {/* Section 19 */}
        <div style={S.section}>
          <h2 style={S.h2}>19. Miscellaneous</h2>
          <p style={S.p}><strong style={{ color: T.t1 }}>Entire Agreement.</strong> These Terms, together with the Privacy Policy and any applicable Order Forms, constitute the entire agreement between you and us regarding the Service and supersede all prior negotiations or agreements.</p>
          <p style={S.p}><strong style={{ color: T.t1 }}>Severability.</strong> If any provision of these Terms is found unenforceable, the remaining provisions shall remain in full force and effect.</p>
          <p style={S.p}><strong style={{ color: T.t1 }}>Waiver.</strong> Failure to enforce any provision of these Terms shall not constitute a waiver of that provision or any other right.</p>
          <p style={S.p}><strong style={{ color: T.t1 }}>Assignment.</strong> You may not assign or transfer your rights or obligations under these Terms without our prior written consent. We may assign our rights and obligations without restriction, including in connection with a merger, acquisition, or sale of assets.</p>
          <p style={S.p}><strong style={{ color: T.t1 }}>Force Majeure.</strong> We shall not be liable for delay or failure in performance due to causes beyond our reasonable control, including natural disasters, acts of government, internet outages, cyberattacks, or pandemic.</p>
          <p style={S.p}><strong style={{ color: T.t1 }}>Language.</strong> These Terms are drafted in English. In the event of any conflict between an English version and a translated version, the English version shall prevail.</p>
        </div>

        {/* Section 20 — Grievance Officer */}
        <div style={S.section}>
          <h2 style={S.h2}>20. Contact & Grievance Officer</h2>
          <p style={S.p}>
            As required under Rule 5(9) of the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, we have designated a Grievance Officer to address complaints and concerns:
          </p>
          <div
            style={{
              background: T.bgS,
              border: `1px solid ${T.borderB}`,
              borderRadius: 12,
              padding: '24px 28px',
              marginBottom: 20,
            }}
          >
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                {[
                  ['Name', '[GRIEVANCE OFFICER NAME]'],
                  ['Designation', 'Grievance Officer, AgentOps Studio'],
                  ['Email', 'grievance@agentopsstudio.com'],
                  ['Postal Address', '[REGISTERED ADDRESS], India'],
                  ['Working Hours', 'Monday – Friday, 10:00 – 18:00 IST'],
                  ['Response Time', 'Acknowledged within 24 hours; resolved within 30 days'],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td style={{ padding: '6px 12px 6px 0', fontSize: 13, fontWeight: 700, color: T.t3, whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                      {label}
                    </td>
                    <td style={{ padding: '6px 0', fontSize: 13, color: T.t1 }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={S.p}>For general support: <span style={{ color: T.blue }}>support@agentopsstudio.com</span></p>
          <p style={S.p}>For billing inquiries: <span style={{ color: T.blue }}>support@agentopsstudio.com</span></p>
          <p style={S.p}>For legal notices: <span style={{ color: T.blue }}>legal@agentopsstudio.com</span></p>
        </div>

        {/* Bottom note */}
        <div
          style={{
            paddingTop: 28,
            borderTop: `1px solid ${T.border}`,
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 12.5, color: T.t3, margin: '0 0 6px' }}>
            These Terms of Service were last updated on <strong style={{ color: T.t2 }}>{EFFECTIVE_DATE}</strong>.
          </p>
          <p style={{ fontSize: 12.5, color: T.t3, margin: 0 }}>
            See also:{' '}
            <a href="/privacy" style={{ color: T.blue, textDecoration: 'none' }}>Privacy Policy</a>
            {' · '}
            <a href="/pricing" style={{ color: T.blue, textDecoration: 'none' }}>Pricing</a>
            {' · '}
            <a href="/contact" style={{ color: T.blue, textDecoration: 'none' }}>Contact Us</a>
          </p>
        </div>
      </div>
    </div>
  );
}
