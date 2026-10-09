import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hacktoberfest Islamabad — Kiro Voucher Claim Portal',
  description: 'Official Kiro voucher distribution portal for registered Hacktoberfest Islamabad attendees.',
  keywords: ['Hacktoberfest', 'Islamabad', 'Kiro', 'Voucher', 'Developer Community'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-gray-100 bg-mesh min-h-screen flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
