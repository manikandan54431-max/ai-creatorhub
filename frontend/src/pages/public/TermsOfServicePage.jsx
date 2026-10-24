import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import Footer from '../../components/layout/Footer'

const LAST_UPDATED = 'October 19, 2026'

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 40 }}>
    <h2 style={{ fontSize: 18, marginBottom: 12, borderBottom: '2px solid var(--ms-blue-light)', paddingBottom: 8 }}>{title}</h2>
    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.9, fontSize: 14 }}>{children}</div>
  </div>
)

export default function TermsOfServicePage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <section style={{ background: 'var(--gradient-hero)', padding: '56px 24px 40px', color: 'white', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="container-custom">
          <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
          <h1 style={{ color: 'white', marginBottom: 10 }}>Terms of Service</h1>
          <p style={{ opacity: 0.85, fontSize: 14 }}>Last updated: {LAST_UPDATED}</p>
        </motion.div>
      </section>

      <section style={{ padding: '56px 24px', flex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="container-custom"
          style={{ maxWidth: 780 }}
        >
          <div style={{
            padding: 16, background: 'var(--info-light)', border: '1px solid var(--ms-blue)',
            borderRadius: 10, marginBottom: 36, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7
          }}>
            Please read these Terms of Service carefully before using AI CreatorHub.
            By creating an account or using the platform in any way, you agree to be bound by these terms.
          </div>

          <Section title="1. Platform Description">
            <p>
              AI CreatorHub is a marketplace platform that connects clients seeking AI-powered content
              creation services with creators who specialize in AI video and content production.
              The platform facilitates project discovery, assignment, communication, delivery review,
              and payment processing between these parties.
            </p>
          </Section>

          <Section title="2. Account Registration">
            <p>You must be at least 18 years old to register an account. By registering, you confirm that:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>You are at least 18 years of age</li>
              <li>The information you provide is accurate and complete</li>
              <li>You will maintain accurate account information</li>
              <li>You are responsible for all activity under your account</li>
              <li>You will not share your login credentials with others</li>
            </ul>
            <p style={{ marginTop: 10 }}>
              We reserve the right to suspend or terminate accounts that violate these terms or
              that are used for fraudulent, abusive, or illegal purposes.
            </p>
          </Section>

          <Section title="3. Creator Obligations">
            <p>If you register as a creator, you agree to:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Provide accurate information about your skills, experience, and AI tools</li>
              <li>Only accept projects you have the skills and capacity to complete</li>
              <li>Communicate professionally and responsively via the project chat</li>
              <li>Submit only original work or work you have the rights to deliver</li>
              <li>Not share client project details, briefs, or materials outside the platform</li>
              <li>Accept that all video deliveries require admin approval before client delivery</li>
              <li>Address admin-requested changes promptly and professionally</li>
            </ul>
          </Section>

          <Section title="4. Client Obligations">
            <p>If you register as a client, you agree to:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Provide accurate and complete project briefs</li>
              <li>Communicate feedback and revision requests clearly and professionally</li>
              <li>Review delivered content within a reasonable timeframe</li>
              <li>Not share or redistribute delivered video content beyond the intended use without appropriate agreements with the creator</li>
              <li>Pay for services in accordance with platform pricing and agreements</li>
            </ul>
          </Section>

          <Section title="5. Video Delivery and Admin Review">
            <p>
              All video deliveries on AI CreatorHub are subject to mandatory admin review before
              a client can access the content. This is a platform-wide requirement and not optional.
            </p>
            <p style={{ marginTop: 10 }}>
              An admin may approve the delivery, making it available to the client, or may request
              changes from the creator. Change requests require written feedback specifying what
              needs to be corrected. The client cannot access any video delivery that has not been
              approved by an admin.
            </p>
            <p style={{ marginTop: 10 }}>
              This process protects clients from receiving substandard work and protects creators
              from disputes arising from unclear expectations.
            </p>
          </Section>

          <Section title="6. Prohibited Conduct">
            <p>You may not use the platform to:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Violate any applicable law or regulation</li>
              <li>Create or deliver content that is defamatory, obscene, or illegal</li>
              <li>Infringe on intellectual property rights of third parties</li>
              <li>Attempt to circumvent the platform's review, payment, or authentication systems</li>
              <li>Harass, threaten, or abuse other users</li>
              <li>Create multiple accounts to bypass restrictions</li>
              <li>Use the platform to conduct transactions outside the platform to avoid fees</li>
            </ul>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              Creators retain intellectual property rights to their work until explicitly transferred
              as part of a project agreement. Clients receive a license to use the delivered content
              for the agreed purpose. Specific IP transfer arrangements must be agreed between
              client and creator directly.
            </p>
            <p style={{ marginTop: 10 }}>
              The AI CreatorHub platform, its brand, design, code, and documentation are the
              intellectual property of AI CreatorHub. You may not copy, distribute, or create
              derivative works from the platform itself.
            </p>
          </Section>

          <Section title="8. Platform Fees and Payments">
            <p>
              The platform charges a commission on successful transactions. The current commission
              rate is displayed in platform settings. All payments are processed through Razorpay.
              Disputes about payments must be raised via the platform's dispute system within the
              project timeframe.
            </p>
            <p style={{ marginTop: 10 }}>
              We do not guarantee refunds outside of the dispute resolution process. Once a delivery
              is accepted by the client, the transaction is considered final.
            </p>
          </Section>

          <Section title="9. Disclaimer of Warranties">
            <p>
              The platform is provided "as is" without warranties of any kind, express or implied.
              We do not guarantee that the platform will be error-free, uninterrupted, or that
              any particular project will be completed to a specific standard.
            </p>
          </Section>

          <Section title="10. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, AI CreatorHub shall not be liable for
              indirect, incidental, special, or consequential damages arising from your use of
              the platform, including but not limited to lost profits, lost data, or reputational harm.
            </p>
          </Section>

          <Section title="11. Changes to These Terms">
            <p>
              We may update these terms from time to time. We will indicate the "last updated"
              date at the top of this page. Continued use of the platform after changes are posted
              constitutes your acceptance of the revised terms.
            </p>
          </Section>

          <Section title="12. Governing Law">
            <p>
              These terms are governed by the laws of India. Disputes shall be resolved in the
              appropriate courts of jurisdiction in India.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>For questions about these Terms of Service:</p>
            <div style={{ marginTop: 12, padding: 16, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
              <div><strong>Email:</strong> <a href="mailto:manikandan54431@gmail.com" style={{ color: 'var(--ms-blue)' }}>manikandan54431@gmail.com</a></div>
              <div style={{ marginTop: 6 }}><strong>Phone:</strong> <a href="tel:+916380994709" style={{ color: 'var(--ms-blue)' }}>+91 6380994709</a></div>
            </div>
            <div style={{ marginTop: 20 }}>
              <Link to="/privacy-policy" style={{ color: 'var(--ms-blue)', fontSize: 14 }}>
                → View Privacy Policy
              </Link>
            </div>
          </Section>
        </motion.div>
      </section>

      <Footer />
    </div>
  )
}
