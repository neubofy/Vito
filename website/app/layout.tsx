import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Veto - Remote Access Dashboard',
  description: 'Control and monitor your Android device remotely and securely.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
