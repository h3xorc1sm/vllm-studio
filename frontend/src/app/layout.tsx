// CRITICAL
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#1a1917",
};

export const metadata: Metadata = {
  title: "vLLM Studio",
  description: "Model management for vLLM and SGLang",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "vLLM Studio",
  },
  icons: {
    icon: [
      { url: "/mocks/logo-1.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" data-theme="warm-paper" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" href="/mocks/logo-1.svg" type="image/svg+xml" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var s = JSON.parse(localStorage.getItem('vllm-studio-chat-state') || '{}');
                var state = (s.state || s);
                var t = state.themeId;
                if (t) document.documentElement.setAttribute('data-theme', t);

                var fontFamilyId = state.fontFamilyId;
                var fontSizeId = state.fontSizeId;

                var fontFamilyMap = {
                  geist: "var(--font-geist-sans), system-ui, sans-serif",
                  system: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                  serif: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
                  mono: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                  rounded: "ui-rounded, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', 'Avenir Next Rounded', system-ui, sans-serif"
                };

                var fontSizeMap = {
                  sm: "14px",
                  md: "16px",
                  lg: "17px",
                  xl: "18px",
                  '2xl': "20px"
                };

                if (fontFamilyId && fontFamilyMap[fontFamilyId]) {
                  document.documentElement.style.setProperty('--font-sans', fontFamilyMap[fontFamilyId]);
                } else {
                  document.documentElement.style.setProperty('--font-sans', fontFamilyMap.geist);
                }
                if (fontSizeId && fontSizeMap[fontSizeId]) {
                  document.documentElement.style.setProperty('--app-font-size', fontSizeMap[fontSizeId]);
                } else {
                  document.documentElement.style.setProperty('--app-font-size', fontSizeMap.md);
                }
              } catch(e) {}
              const isProd = ${process.env.NODE_ENV === "production" ? "true" : "false"};
              if (isProd && 'serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
              const setAppHeight = () => {
                document.documentElement.style.setProperty('--app-height', \`\${window.innerHeight}px\`);
              };
              window.addEventListener('resize', setAppHeight);
              window.addEventListener('orientationchange', setAppHeight);
              setAppHeight();
            `,
          }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <AppSidebar>{children}</AppSidebar>
        </Providers>
      </body>
    </html>
  );
}
