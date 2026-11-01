import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Header } from './Header';
import { LEGAL } from '@/lib/legal';

interface LayoutProps {
  children: ReactNode;
  showHeader?: boolean;
  /** The home page draws its own, larger footer */
  showFooter?: boolean;
  /** A page's own header, drawn before <main> (used with showHeader={false}) */
  header?: ReactNode;
  /** A page's own footer, drawn after <main> (used with showFooter={false}) */
  footer?: ReactNode;
}

/** First thing a keyboard user reaches: jumps past the header to the page content (WCAG 2.4.1). */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[100] focus:rounded focus:bg-[#ffdd00] focus:px-4 focus:py-2 focus:font-semibold focus:text-[#0b0c0c] focus:outline focus:outline-2 focus:outline-[#0b0c0c]"
    >
      Skip to main content
    </a>
  );
}

function SiteFooter() {
  return (
    <footer className="print:hidden border-t bg-muted/40">
      <div className="container flex flex-col gap-3 py-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2">
          <Link to="/privacy" className="underline hover:text-foreground">Privacy notice</Link>
          <Link to="/terms" className="underline hover:text-foreground">Terms of service</Link>
          <Link to="/accessibility" className="underline hover:text-foreground">Accessibility statement</Link>
        </nav>
        <p>
          Help: <a href={`mailto:${LEGAL.supportEmail}`} className="underline hover:text-foreground">{LEGAL.supportEmail}</a>
        </p>
      </div>
    </footer>
  );
}

export function Layout({ children, showHeader = true, showFooter = true, header, footer }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <SkipLink />
      {showHeader && <Header />}
      {header}
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      {showFooter && <SiteFooter />}
      {footer}
    </div>
  );
}
