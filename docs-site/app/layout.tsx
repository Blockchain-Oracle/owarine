import type { Metadata } from 'next';
import { RootProvider } from 'fumadocs-ui/provider/next';
import { Archivo, Inter, JetBrains_Mono } from 'next/font/google';
import { site } from '@/lib/site';
import './global.css';
const archivo = Archivo({subsets:['latin'],variable:'--font-archivo',display:'swap',axes:['wdth']});
const inter = Inter({subsets:['latin'],variable:'--font-inter',display:'swap'});
const mono = JetBrains_Mono({subsets:['latin'],variable:'--font-mono',display:'swap'});
export const metadata: Metadata = {
  metadataBase: new URL(site.docs),
  title: { default: 'Owarine Docs — learn one step at a time', template: '%s · Owarine Docs' },
  description: 'Guides to Owarine: make a call, understand the sessions and lanes, and see how the Daml engine, the oracle parties and your seat connect.',
  icons: { icon: '/icon.svg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body className={`${archivo.variable} ${inter.variable} ${mono.variable}`}><a className="skip-link" href="#main-content">Skip to content</a><RootProvider theme={{ defaultTheme:'light', enableSystem:false, storageKey:'owarine-docs-theme' }} search={{links:[['Quickstart','/start/quickstart'],['Your first call','/trading/first-trade'],['How it fits together','/architecture/overview']]}}>{children}</RootProvider></body></html>;
}
