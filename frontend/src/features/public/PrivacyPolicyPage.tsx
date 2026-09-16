/**
 * Privacy Policy Page
 *
 * India-specific Privacy Policy for AgentOps Studio.
 * Covers: IT Act 2000, SPDI Rules 2011, DPDPA 2023, data processors,
 * call recording disclosure, mandatory Grievance Officer contact.
 *
 * ⚠️  FOUNDER ACTION REQUIRED before going live:
 *   1. Replace [REGISTERED ADDRESS] with your company's actual address
 *   2. Replace [LEGAL ENTITY NAME] with your registered company name
 *   3. Replace [YOUR GSTIN] with your actual GSTIN
 *   4. Update Grievance Officer name/contact to real values
 *   5. Update third-party processor links if any have changed
 *   6. Have a licensed Indian advocate review before publication
 */

const T = {
  bg:     '#030712',
  bgS:    '#0d1524',
  t1:     '#f8fafc',
  t2:     '#94a3b8',
  t3:     '#475569',
  blue:   '#3b82f6',
  violet: '#8b5cf6',
  green:  '#22c55e',
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
  warning: {
    background: 'rgba(234,179,8,0.08)',
    border: '1px solid rgba(234,179,8,0.2)',
    borderRadius: 10,
    padding: '16px 20px',
    marginBottom: 20,
  } as React.CSSProperties,
};

/** Reusable right column for a rights card */
function RightCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div
      style={{
        background: T.bgS,
        border: `1px solid ${T.border}`,
        borderRadius: 10,
        padding: '16px 18px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.t1, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: T.t2, lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  );
}

export default function PrivacyPolicyPage() {
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
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(34,197,94,0.1)', color: T.green, border: '1px solid rgba(34,197,94,0.2)' }}>
              SPDI Rules 2011 Compliant
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: 'rgba(34,197,94,0.1)', color: T.green, border: '1px solid rgba(34,197,94,0.2)' }}>
              DPDPA 2023 Aligned
            </span>
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 14px', color: T.t1 }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: 15, color: T.t2, lineHeight: 1.65, maxWidth: 520, margin: '0 auto' }}>
            We respect your privacy and are committed to protecting your personal data. This Policy explains how AgentOps Studio collects, uses, and safeguards your information.
          </p>
        </div>
      </div>

      {/* Document Body */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 20px 80px' }}>

        {/* Section 1 */}
        <div style={S.section}>
          <h2 style={S.h2}>1. Introduction</h2>
          <p style={S.p}>
            AgentOps Studio ("[LEGAL ENTITY NAME]," "we," "our," or "us") is committed to protecting your personal data in accordance with applicable Indian law. This Privacy Policy describes how we collect, use, share, and protect information about you when you use our AI voice agent platform and associated services (the "Service").
          </p>
          <p style={S.p}>We operate under the following Indian legal frameworks:</p>
          <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
            {[
              'Information Technology Act, 2000 and the IT (Amendment) Act, 2008',
              'Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 ("SPDI Rules")',
              'Digital Personal Data Protection Act, 2023 ("DPDPA") — applicable provisions as notified',
              'Telecom Regulatory Authority of India (TRAI) regulations for call recordings and telemarketing',
            ].map((item, i) => <li key={i} style={S.li}>{item}</li>)}
          </ul>
          <p style={S.p}>This Policy applies to all users of the AgentOps Studio platform, including Organisation owners, team members, and visitors to our marketing website.</p>
        </div>

        {/* Section 2 */}
        <div style={S.section}>
          <h2 style={S.h2}>2. Data Controller</h2>
          <div
            style={{
              background: T.bgS,
              border: `1px solid ${T.borderB}`,
              borderRadius: 12,
              padding: '24px 28px',
            }}
          >
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                {[
                  ['Legal Name', '[LEGAL ENTITY NAME]'],
                  ['Trade Name', 'AgentOps Studio'],
                  ['Address', '[REGISTERED ADDRESS], India'],
                  ['GSTIN', '[YOUR GSTIN]'],
                  ['Privacy Contact', 'privacy@agentopsstudio.com'],
                  ['Grievance Officer', 'grievance@agentopsstudio.com'],
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
        </div>

        {/* Section 3 */}
        <div style={S.section}>
          <h2 style={S.h2}>3. Data We Collect</h2>

          <h3 style={S.h3}>3.1 Account & Identity Data</h3>
          <p style={S.p}>When you register for an account, we collect: your full name, email address, mobile number, business name, and your role within your organisation.</p>

          <h3 style={S.h3}>3.2 Billing Data</h3>
          <p style={S.p}>We collect your subscription plan, billing address, and GSTIN (if applicable for B2B invoicing). Payment card details are processed directly by Stripe, Inc. — we store only your Stripe Customer ID and do not have access to full card numbers, CVV, or expiry dates.</p>

          <h3 style={S.h3}>3.3 Voice & Call Data</h3>
          <p style={S.p}>When you deploy Voice Agents, we process and store:</p>
          <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
            <li style={S.li}>Call recordings (audio files)</li>
            <li style={S.li}>Call transcripts generated by our speech-to-text processor</li>
            <li style={S.li}>AI-generated responses and call metadata (duration, timestamp, disposition status)</li>
            <li style={S.li}>Knowledge base documents and agent configurations you upload</li>
          </ul>
          <div style={S.warning}>
            <p style={{ fontSize: 13, color: '#fde68a', margin: 0, fontWeight: 600 }}>
              📞 Important: Third-party callers whose calls are recorded are data subjects whose personal data you — the Organisation — control. You are the data controller for this data. See Section 9 (Call Recording Notice) for your obligations.
            </p>
          </div>

          <h3 style={S.h3}>3.4 Usage & Technical Data</h3>
          <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
            <li style={S.li}>Log data: IP address, browser type, operating system, pages visited, session duration</li>
            <li style={S.li}>Device data: screen resolution, time zone, language preference</li>
            <li style={S.li}>API usage: request timestamps, endpoint access patterns, error rates</li>
          </ul>

          <h3 style={S.h3}>3.5 Communications Data</h3>
          <p style={S.p}>If you contact our support team, we retain the content of those communications (support tickets, emails, chat transcripts) to resolve your inquiry and improve our service.</p>

          <h3 style={S.h3}>3.6 Data We Do Not Collect</h3>
          <p style={S.p}>We do not intentionally collect special categories of sensitive personal data including biometric data, health/medical information, political opinions, religious beliefs, or financial data beyond billing details. If you believe sensitive data has been shared with us inadvertently, contact privacy@agentopsstudio.com immediately.</p>
        </div>

        {/* Section 4 */}
        <div style={S.section}>
          <h2 style={S.h2}>4. How We Use Your Data</h2>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Purpose</th>
                <th style={S.th}>Legal Basis</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Delivering the Service (voice agent processing, API calls, knowledge base retrieval)', 'Contractual necessity'],
                ['Billing, invoicing, subscription management', 'Contractual necessity + Legal obligation (GST)'],
                ['Sending transactional emails (invoices, security alerts, account notifications)', 'Contractual necessity'],
                ['Service announcements and product updates', 'Legitimate interests'],
                ['Security monitoring, fraud detection, and abuse prevention', 'Legitimate interests + Legal obligation'],
                ['Platform analytics and product improvement (aggregated)', 'Legitimate interests'],
                ['Marketing communications', 'Consent (opt-in only)'],
                ['Compliance with legal and regulatory obligations', 'Legal obligation'],
              ].map(([purpose, basis], i) => (
                <tr key={i}>
                  <td style={S.td}>{purpose}</td>
                  <td style={{ ...S.td, fontWeight: 600, color: T.t1, whiteSpace: 'nowrap' }}>{basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={S.p}>We will not use your personal data for purposes incompatible with those stated above without obtaining your prior consent.</p>
        </div>

        {/* Section 5 */}
        <div style={S.section}>
          <h2 style={S.h2}>5. Data Sharing & Third-Party Processors</h2>
          <p style={S.p}>We share your data with third-party processors solely to deliver the Service. All processors are engaged under data processing agreements that require them to apply appropriate security and confidentiality measures.</p>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Processor</th>
                <th style={S.th}>Purpose</th>
                <th style={S.th}>Location</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Stripe, Inc.', 'Payment processing & subscription', 'USA'],
                ['OpenAI, LLC', 'LLM inference — call transcripts are processed', 'USA'],
                ['Deepgram, Inc.', 'Speech-to-text transcription', 'USA'],
                ['ElevenLabs, Inc.', 'Text-to-speech audio synthesis', 'USA'],
                ['Vapi AI', 'Voice orchestration layer', 'USA'],
                ['Exotel Techcom Pvt. Ltd.', 'Telephony routing and SIP', 'India'],
                ['MongoDB Atlas (AWS)', 'Database hosting', 'USA / India'],
                ['Amazon Web Services', 'Cloud infrastructure & storage', 'USA / India'],
                ['Resend, Inc.', 'Transactional email delivery', 'USA'],
              ].map(([p, desc, loc]) => (
                <tr key={p}>
                  <td style={{ ...S.td, fontWeight: 600, color: T.t1, whiteSpace: 'nowrap' }}>{p}</td>
                  <td style={S.td}>{desc}</td>
                  <td style={{ ...S.td, color: T.t3, whiteSpace: 'nowrap' }}>{loc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={S.p}>We do not sell, rent, trade, or share your personal data with third parties for their own marketing or commercial purposes.</p>
          <p style={S.p}>We may disclose personal data if required by a court order, government authority, or applicable law — including Section 69 of the IT Act 2000 or directions from the Department of Telecommunications — and will, where lawfully permitted, notify you of any such disclosure.</p>
        </div>

        {/* Section 6 */}
        <div style={S.section}>
          <h2 style={S.h2}>6. International Data Transfers</h2>
          <p style={S.p}>Several of our processors are located outside India, primarily in the United States. When we transfer personal data internationally, we ensure adequate protection through contractual data processing agreements incorporating standard data protection clauses.</p>
          <p style={S.p}>Specifically, call recordings and transcripts are processed by US-based AI providers (OpenAI, Deepgram, ElevenLabs). If your organisation has data residency requirements that preclude international transfers, contact privacy@agentopsstudio.com before signing up — the Service may not be suitable for your use case.</p>
        </div>

        {/* Section 7 */}
        <div style={S.section}>
          <h2 style={S.h2}>7. Data Retention</h2>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Data Category</th>
                <th style={S.th}>Retention Period</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Account and profile data', 'Duration of subscription + 90 days post-cancellation'],
                ['Call recordings (audio files)', 'Free: 90 days · Starter: 1 year · Growth: 3 years'],
                ['Call transcripts and metadata', 'Same as call recording retention by plan'],
                ['Billing records and GST invoices', '7 years (as required by Indian tax law)'],
                ['Support ticket history', '3 years from ticket creation'],
                ['Technical logs (IP, API logs)', '30 days rolling'],
                ['Marketing consent records', 'Until consent is withdrawn + 3 years'],
              ].map(([cat, period]) => (
                <tr key={cat}>
                  <td style={{ ...S.td, fontWeight: 600, color: T.t1 }}>{cat}</td>
                  <td style={S.td}>{period}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={S.p}>After the applicable retention period, data is securely deleted using industry-standard erasure methods, or anonymised such that it can no longer be linked to you. You may request earlier deletion via the process in Section 8.</p>
        </div>

        {/* Section 8 */}
        <div style={S.section}>
          <h2 style={S.h2}>8. Your Rights</h2>
          <p style={S.p}>Under the DPDPA 2023 and SPDI Rules 2011, you have the following rights with respect to your personal data:</p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <RightCard icon="👁️" title="Right of Access" desc="Request a copy of all personal data we hold about you, including the purposes for which it is processed." />
            <RightCard icon="✏️" title="Right to Correction" desc="Request that we correct inaccurate or incomplete personal data without undue delay." />
            <RightCard icon="🗑️" title="Right to Erasure" desc="Request deletion of your personal data, subject to our legal retention obligations." />
            <RightCard icon="📦" title="Right to Portability" desc="Receive your personal data in a structured, machine-readable format for transfer to another service." />
            <RightCard icon="🚫" title="Withdraw Consent" desc="Where processing is based on consent, you may withdraw it at any time. This does not affect prior lawful processing." />
            <RightCard icon="🧑‍⚖️" title="Grievance Redressal" desc="Lodge a complaint with our Grievance Officer (see Section 14). We respond within 30 days." />
            <RightCard icon="👤" title="Right to Nominate" desc="Under DPDPA 2023, nominate another individual to exercise data rights on your behalf in the event of your death or incapacity." />
          </div>
          <p style={S.p}>To exercise any of these rights, email <span style={{ color: T.blue }}>privacy@agentopsstudio.com</span> with your request and sufficient identification. We will respond within <strong style={{ color: T.t1 }}>30 days</strong> as required by the SPDI Rules. Complex or multi-subject requests may take up to 45 days, with notification of the extension.</p>
        </div>

        {/* Section 9 — Call Recording (critical) */}
        <div id="call-recording" style={S.section}>
          <h2 style={S.h2}>9. Call Recording Notice</h2>
          <div style={S.warning}>
            <p style={{ fontSize: 13, color: '#fde68a', margin: 0, fontWeight: 600 }}>
              ⚠️  This section contains important legal obligations for businesses deploying AI Voice Agents on this platform.
            </p>
          </div>
          <h3 style={S.h3}>9.1 Your Obligations as a Business</h3>
          <p style={S.p}>The AgentOps Studio platform enables automated recording of telephone calls handled by AI Voice Agents. As the Organisation deploying these agents, you are the data controller for all personal data collected from callers and callees. You are legally required to:</p>
          <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
            <li style={S.li}>Inform callers at the commencement of each call that the conversation may be recorded, using a clear IVR announcement or pre-recorded message;</li>
            <li style={S.li}>Obtain legally sufficient consent from all parties to the call before recording begins, in accordance with the Indian Telegraph Act, 1885 and applicable TRAI regulations;</li>
            <li style={S.li}>Include recording disclosures in your TRAI telemarketer registration documents; and</li>
            <li style={S.li}>Ensure your own privacy policy and consent mechanisms address the personal data of third-party callers.</li>
          </ul>
          <h3 style={S.h3}>9.2 Our Role as a Data Processor</h3>
          <p style={S.p}>We act as a data processor for call data collected through your Voice Agents. We process this data on your instructions and do not use it for our own marketing or unrelated purposes. You direct the collection, storage, and deletion of this data.</p>
          <h3 style={S.h3}>9.3 Callee Data Deletion</h3>
          <p style={S.p}>You may delete individual call recordings from your AgentOps Studio dashboard at any time. Recordings are also automatically purged according to the retention schedule in Section 7. To bulk-delete all recordings associated with a caller upon request, contact support@agentopsstudio.com.</p>
        </div>

        {/* Section 10 — Cookies */}
        <div id="cookies" style={S.section}>
          <h2 style={S.h2}>10. Cookies & Tracking</h2>
          <p style={S.p}>We use cookies and similar technologies to operate the platform and improve your experience. The categories of cookies we use are:</p>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Category</th>
                <th style={S.th}>Purpose</th>
                <th style={S.th}>Required?</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Essential', 'Authentication tokens, session management, CSRF protection. The platform cannot function without these.', 'Yes — cannot be disabled'],
                ['Analytics', 'Aggregated, anonymised usage data to understand how users interact with the platform. No cross-site tracking.', 'No — can be declined'],
                ['Preference', 'Stores your UI preferences (theme, language, layout) to improve your experience across sessions.', 'No — can be declined'],
              ].map(([cat, purpose, req]) => (
                <tr key={cat}>
                  <td style={{ ...S.td, fontWeight: 700, color: T.t1, whiteSpace: 'nowrap' }}>{cat}</td>
                  <td style={S.td}>{purpose}</td>
                  <td style={{ ...S.td, color: T.t3, whiteSpace: 'nowrap', fontSize: 12 }}>{req}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={S.p}>We do not use third-party advertising cookies, cross-site tracking cookies, or behavioural profiling cookies. To manage cookie preferences, adjust your browser settings. Disabling essential cookies will impair or prevent platform functionality.</p>
        </div>

        {/* Section 11 */}
        <div style={S.section}>
          <h2 style={S.h2}>11. Security</h2>
          <p style={S.p}>We implement security measures in accordance with the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, including:</p>
          <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
            {[
              'AES-256 encryption for data at rest in our databases',
              'TLS 1.3 for all data in transit',
              'Role-based access control (RBAC) within organisations',
              'API key hashing using bcrypt',
              'Automated security scanning and dependency auditing in our CI/CD pipeline',
              'Access logging and anomaly detection on production systems',
            ].map((item, i) => <li key={i} style={S.li}>{item}</li>)}
          </ul>
          <p style={S.p}>No security system is 100% impenetrable. In the event of a data breach that is likely to result in a risk to your rights or freedoms, we will notify you and relevant authorities within 72 hours of becoming aware, in accordance with applicable law.</p>
        </div>

        {/* Section 12 */}
        <div style={S.section}>
          <h2 style={S.h2}>12. Children's Privacy</h2>
          <p style={S.p}>The Service is not directed at, and is not intended for use by, individuals under 18 years of age. We do not knowingly collect personal data from minors. If you are a parent or guardian and believe your child has provided us with personal data without your consent, contact privacy@agentopsstudio.com and we will promptly investigate and delete such data.</p>
        </div>

        {/* Section 13 */}
        <div style={S.section}>
          <h2 style={S.h2}>13. Changes to This Policy</h2>
          <p style={S.p}>We may update this Privacy Policy from time to time to reflect changes in our practices, the Service, or applicable law. For material changes, we will notify you by email at the address associated with your account at least 30 days before they take effect.</p>
          <p style={S.p}>Non-material changes (such as clarifications or typographical corrections) take effect upon posting, with the "Last Updated" date at the top of this page updated accordingly. Your continued use of the Service after the effective date of changes constitutes your acceptance of the revised Policy.</p>
        </div>

        {/* Section 14 — Grievance Officer (MANDATORY) */}
        <div style={S.section}>
          <h2 style={S.h2}>14. Grievance Officer</h2>
          <p style={S.p}>
            As mandated by Rule 5(9) of the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, we have designated a Grievance Officer to address complaints and concerns regarding the collection, storage, and use of your personal data:
          </p>
          <div
            style={{
              background: T.bgS,
              border: `1px solid ${T.borderB}`,
              borderRadius: 12,
              padding: '24px 28px',
              marginBottom: 16,
            }}
          >
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                {[
                  ['Name', 'Rishabh Sharma'],
                  ['Designation', 'Founder & Grievance Officer'],
                  ['Email', 'grievance@agentopsstudio.com'],
                  ['Postal Address', '[REGISTERED ADDRESS], India'],
                  ['Working Hours', 'Monday – Friday, 10:00 – 18:00 IST'],
                  ['Acknowledgement', 'Within 24 hours of receipt'],
                  ['Resolution Time', 'Within 30 days of receipt (as required by SPDI Rules)'],
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
          <p style={S.p}>
            If you are dissatisfied with the resolution provided by our Grievance Officer, you may approach the relevant judicial authority or, once notified by the Government of India, the <strong style={{ color: T.t1 }}>Data Protection Board of India</strong> established under the Digital Personal Data Protection Act, 2023.
          </p>
        </div>

        {/* Section 15 */}
        <div style={S.section}>
          <h2 style={S.h2}>15. Contact Us</h2>
          <p style={S.p}>For any privacy-related inquiries, data access requests, or concerns about how we handle your personal data, please contact us:</p>
          <ul style={{ paddingLeft: 20, margin: '0 0 12px' }}>
            <li style={S.li}>General privacy inquiries: <span style={{ color: T.blue }}>privacy@agentopsstudio.com</span></li>
            <li style={S.li}>Data access & deletion requests: <span style={{ color: T.blue }}>privacy@agentopsstudio.com</span></li>
            <li style={S.li}>Grievances & complaints: <span style={{ color: T.blue }}>grievance@agentopsstudio.com</span></li>
            <li style={S.li}>General support: <span style={{ color: T.blue }}>support@agentopsstudio.com</span></li>
          </ul>
          <p style={S.p}>We take all privacy inquiries seriously and respond within 30 days.</p>
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
            This Privacy Policy was last updated on <strong style={{ color: T.t2 }}>{EFFECTIVE_DATE}</strong>.
          </p>
          <p style={{ fontSize: 12.5, color: T.t3, margin: 0 }}>
            See also:{' '}
            <a href="/terms" style={{ color: T.blue, textDecoration: 'none' }}>Terms of Service</a>
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
