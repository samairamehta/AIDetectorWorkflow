import type { Metadata } from "next";
import { Inter, Newsreader, Space_Grotesk, Lora } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Nav } from "@/components/Nav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
});
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk" });
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });

export const metadata: Metadata = {
  title: "DetectDeck",
  description:
    "QA tool that checks written content against AI-detection APIs and reports whether it scores as human-written.",
};

// Applies the saved theme and font before first paint to avoid a flash.
const preInit = `(function(){
  try{var t=localStorage.getItem('dd-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}
  try{var f=localStorage.getItem('dd-font');var m={inter:'var(--font-inter)',grotesk:'var(--font-grotesk)',newsreader:'var(--font-newsreader)',lora:'var(--font-lora)',system:'ui-sans-serif, system-ui, sans-serif'};if(f&&m[f])document.documentElement.style.setProperty('--font-ui',m[f])}catch(e){}
})()`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${inter.variable} ${newsreader.variable} ${grotesk.variable} ${lora.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: preInit }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans">
        <Providers>
          <Nav />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-line">
            <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-[30px] py-3">
              <span className="text-[10.5px] text-faint">
                Powered by the Anto Biosciences workflow engine
              </span>
              <span className="text-[10.5px] text-faint">
                DetectDeck measures and reports. It never rewrites your text.
              </span>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
