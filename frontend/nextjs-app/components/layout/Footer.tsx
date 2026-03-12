import React from 'react';
import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 border-t mt-auto">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">
              About
            </h3>
            <div className="mt-4 space-y-2">
              <Link
                href="/about"
                className="block text-sm text-gray-600 hover:text-primary-600"
              >
                About Us
              </Link>
              <Link
                href="/how-it-works"
                className="block text-sm text-gray-600 hover:text-primary-600"
              >
                How It Works
              </Link>
              <Link
                href="/careers"
                className="block text-sm text-gray-600 hover:text-primary-600"
              >
                Careers
              </Link>
            </div>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">
              Support
            </h3>
            <div className="mt-4 space-y-2">
              <Link
                href="/help"
                className="block text-sm text-gray-600 hover:text-primary-600"
              >
                Help Center
              </Link>
              <Link
                href="/contact"
                className="block text-sm text-gray-600 hover:text-primary-600"
              >
                Contact Us
              </Link>
              <Link
                href="/faq"
                className="block text-sm text-gray-600 hover:text-primary-600"
              >
                FAQ
              </Link>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">
              Legal
            </h3>
            <div className="mt-4 space-y-2">
              <Link
                href="/privacy"
                className="block text-sm text-gray-600 hover:text-primary-600"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="block text-sm text-gray-600 hover:text-primary-600"
              >
                Terms of Service
              </Link>
              <Link
                href="/cookies"
                className="block text-sm text-gray-600 hover:text-primary-600"
              >
                Cookie Policy
              </Link>
            </div>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">
              Stay Updated
            </h3>
            <p className="mt-4 text-sm text-gray-600">
              Subscribe to our newsletter for updates and tips.
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-8">
          <p className="text-sm text-gray-500 text-center">
            © {currentYear} Local Service Marketplace. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
