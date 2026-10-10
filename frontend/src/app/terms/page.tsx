import React from "react";
import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 p-8 sm:p-12">
        <h1 className="text-3xl font-bold text-slate-900 mb-6">Terms of Service</h1>
        <p className="text-sm text-slate-500 mb-8">Last Updated: October 10, 2026</p>

        <div className="space-y-6 text-slate-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using our Email Automation platform, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access or use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">2. Description of Service</h2>
            <p>
              Our platform provides automated email routing, forwarding, and processing services. It connects to your Gmail account via OAuth to perform actions on your behalf based on the configurations and rules you set up within the application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">3. User Responsibilities</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>You are responsible for maintaining the security of your account and the OAuth authorizations you grant.</li>
              <li>You agree not to use the service for any illegal or unauthorized purpose, including sending spam, phishing emails, or malicious content.</li>
              <li>You must ensure that your use of the service complies with all applicable laws and the Google API Terms of Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">4. Limitation of Liability</h2>
            <p>
              In no event shall the platform, its developers, or its affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">5. Service Availability</h2>
            <p>
              We strive to ensure maximum uptime, but we do not guarantee that the service will be uninterrupted, secure, or free from errors. We reserve the right to modify, suspend, or discontinue the service at any time without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">6. Termination</h2>
            <p>
              We may terminate or suspend your access to the service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the service will cease immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-900 mb-3">7. Changes to Terms</h2>
            <p>
              We reserve the right to modify or replace these Terms at any time. We will try to provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
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
