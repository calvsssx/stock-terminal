import "./globals.css";

export const metadata = {
  title: "Market Terminal — Personal Stock & Crypto Analysis",
  description: "Live charts, technicals, fundamentals & AI-powered analysis for stocks and crypto.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
