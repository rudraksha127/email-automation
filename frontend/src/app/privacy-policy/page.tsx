import React from "react";
import Link from "next/link";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-8">Last Updated: October 10, 2026</p>

        <div className="space-y-6 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Introduction</h2>
            <p>
              Welcome to our Email Automation platform. We respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service, especially concerning your connection to Google services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. Information We Collect</h2>
            <p className="mb-2">When you use our service, we may collect the following types of information:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Account Information:</strong> Your email address and basic profile information when you register or sign in via Google.</li>
              <li><strong>OAuth Tokens:</strong> Securely encrypted access and refresh tokens to interact with your Gmail account on your behalf.</li>
              <li><strong>Email Data:</strong> Information about emails you choose to automate or process using our platform, stored temporarily or persistently based on your automation workflows.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. How We Use Your Information</h2>
            <p className="mb-2">We use the information we collect primarily to provide, maintain, and improve our services. Specifically, we use your data to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Facilitate the core automation features, such as reading, forwarding, and sending emails via your connected Gmail account.</li>
              <li>Authenticate your identity and maintain your session.</li>
              <li>Analyze usage trends to improve the product experience.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Google API Services User Data Policy</h2>
            <p>
              Our application's use and transfer of information received from Google APIs to any other app will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements. We do not use your Google data for any purpose other than providing the email automation features you explicitly configure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your personal information. OAuth tokens are encrypted at rest using strong cryptographic algorithms. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">6. Your Rights and Choices</h2>
            <p>
              You have the right to access, update, or delete your personal information. You can revoke our application's access to your Google account at any time through your Google Account Security settings. Doing so will immediately stop all email automation activities associated with your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">7. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact the platform administrator or support team.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-100">
          <Link href="/login" className="text-brand-600 font-medium hover:text-brand-700 transition-colors">
            &larr; Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
