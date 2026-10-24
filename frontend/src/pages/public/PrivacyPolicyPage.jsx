import { motion } from 'framer-motion'
import Footer from '../../components/layout/Footer'

const LAST_UPDATED = 'October 19, 2026'

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 40 }}>
    <h2 style={{ fontSize: 18, marginBottom: 12, borderBottom: '2px solid var(--ms-blue-light)', paddingBottom: 8 }}>{title}</h2>
    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.9, fontSize: 14 }}>{children}</div>
  </div>
)

export default function PrivacyPolicyPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <section style={{ background: 'var(--gradient-hero)', padding: '56px 24px 40px', color: 'white', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="container-custom">
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔒</div>
          <h1 style={{ color: 'white', marginBottom: 10 }}>Privacy Policy</h1>
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
          <Section title="1. Introduction">
            <p>
              AI CreatorHub ("we", "us", "our") is a marketplace platform that connects clients
              with AI-powered content creators. This Privacy Policy explains how we collect,
              use, store, and protect information when you use our platform.
            </p>
            <p style={{ marginTop: 12 }}>
              By registering an account or using any part of the platform, you agree to the
              practices described in this policy. If you do not agree, do not use the platform.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p><strong>Account Information:</strong> When you register, we collect your name, email address, and hashed password. We never store your password in plain text.</p>
            <p style={{ marginTop: 10 }}><strong>Profile Information:</strong> Creators may provide a bio, skills, portfolio items, pricing, and profile photos. This information is visible to other users on the platform.</p>
            <p style={{ marginTop: 10 }}><strong>Order and Project Data:</strong> We store order briefs, requirements, messages exchanged in project chats, delivery submission metadata, and review content.</p>
            <p style={{ marginTop: 10 }}><strong>Delivery Files:</strong> Video files uploaded as project deliveries are stored in a private, server-side location not accessible via public URLs. Access is controlled via authenticated API endpoints.</p>
            <p style={{ marginTop: 10 }}><strong>Support Tickets:</strong> Messages sent via the contact form or support page are stored in our database with your name and email.</p>
            <p style={{ marginTop: 10 }}><strong>Usage Data:</strong> We may log actions such as login, order creation, delivery access, and admin actions for audit purposes. IP addresses may be logged by the web server.</p>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li>To operate and deliver the platform's core functionality (orders, chat, deliveries, payments)</li>
              <li>To authenticate your identity and protect your account</li>
              <li>To facilitate project assignments between clients and creators</li>
              <li>To conduct admin reviews of video deliveries before client access</li>
              <li>To respond to support tickets and inquiries</li>
              <li>To maintain platform integrity and prevent abuse</li>
              <li>To improve the platform based on how it is used</li>
            </ul>
            <p style={{ marginTop: 12 }}>
              We do not sell your personal information to third parties. We do not use your data for advertising targeting.
            </p>
          </Section>

          <Section title="4. Video Delivery File Security">
            <p>
              All video files submitted by creators as project deliveries are stored in a private
              server-side directory that is not accessible through any public URL. The only way
              to access a delivery file is through an authenticated API endpoint that validates
              your identity and role on every request.
            </p>
            <p style={{ marginTop: 10 }}>
              <strong>Clients</strong> can only access delivery files that have been approved by an admin.
              Unapproved, pending, or rejected files are never exposed to clients.
            </p>
            <p style={{ marginTop: 10 }}>
              <strong>Creators</strong> can access their own delivery files in any status via the
              authenticated endpoint.
            </p>
            <p style={{ marginTop: 10 }}>
              <strong>Admins</strong> can access all delivery files for review and quality assurance.
            </p>
            <p style={{ marginTop: 10 }}>
              All file access events are logged in an immutable audit trail.
            </p>
          </Section>

          <Section title="5. Data Retention">
            <p>
              We retain account and project data for the duration of your account's existence.
              If you request account deletion, your personal information will be removed from
              production systems. Project data may be retained for audit and legal compliance
              purposes in anonymized or aggregated form.
            </p>
            <p style={{ marginTop: 10 }}>
              Delivery files are retained for the duration of the project relationship.
              Contact us if you need specific files deleted.
            </p>
          </Section>

          <Section title="6. Cookies and Local Storage">
            <p>
              We use browser local storage to maintain your login session (JWT authentication token)
              and theme preference. We do not use third-party tracking cookies or advertising
              cookies. You can clear local storage at any time through your browser settings,
              which will log you out.
            </p>
          </Section>

          <Section title="7. Third-Party Services">
            <p>
              The platform uses the following third-party services which may process data:
            </p>
            <ul style={{ paddingLeft: 20, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li><strong>Razorpay:</strong> Payment processing. We pass minimal required information to process transactions. Razorpay's own privacy policy governs how they handle payment data.</li>
            </ul>
          </Section>

          <Section title="8. Previously Used AI Services">
            <p>
              The platform no longer sends any of your data to third-party AI providers.
              Features that previously did so — the website help chatbot, the creator
              project assistant, script and brief generation, and image and video
              generation — have been removed, and no new requests are made to those
              providers.
            </p>
            <p style={{ marginTop: 8 }}>
              Historically, while those features were available, text you entered into
              them (for example a project brief, a bio prompt or a chat message) was sent
              to Google Gemini, and image and video generation prompts were sent to
              Hugging Face, for processing. Those providers handled that data under their
              own privacy policies. We cannot retroactively recall data that was sent to
              them while the features were in use.
            </p>
            <p style={{ marginTop: 8 }}>
              Records of past generation attempts may still exist in our database. Any
              media that was generated and saved into a creator's media library remains
              stored and usable as ordinary uploaded media. You can contact us to request
              deletion of this data.
            </p>
          </Section>

          <Section title="9. Your Rights">
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li><strong>Access:</strong> You can view your account information in the profile settings page.</li>
              <li><strong>Correction:</strong> Update your account information from your profile settings at any time.</li>
              <li><strong>Deletion:</strong> Contact us to request account deletion.</li>
              <li><strong>Data Portability:</strong> Contact us to request a copy of your data in a machine-readable format.</li>
            </ul>
          </Section>

          <Section title="10. Security">
            <p>
              We protect your data using industry-standard measures including hashed passwords
              (bcrypt), JWT-based authentication, role-based access control, and private file
              storage for sensitive project deliveries. We restrict access to personal data to
              authorized administrators only.
            </p>
            <p style={{ marginTop: 10 }}>
              Despite our best efforts, no system is 100% secure. If you believe your account
              has been compromised, contact us immediately.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              For privacy-related questions, requests, or concerns, contact us at:
            </p>
            <div style={{ marginTop: 12, padding: 16, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }}>
              <div><strong>Email:</strong> <a href="mailto:manikandan54431@gmail.com" style={{ color: 'var(--ms-blue)' }}>manikandan54431@gmail.com</a></div>
              <div style={{ marginTop: 6 }}><strong>Phone:</strong> <a href="tel:+916380994709" style={{ color: 'var(--ms-blue)' }}>+91 6380994709</a></div>
            </div>
          </Section>
        </motion.div>
      </section>

      <Footer />
    </div>
  )
}
