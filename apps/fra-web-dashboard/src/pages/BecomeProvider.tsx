import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export const APPLICATION_PATH = '/provider-application';
/** Signed-out visitors create an account (the existing, email-verified route in) and come straight back to the application */
export const SIGN_UP_TO_APPLY = `/auth?mode=signup&returnTo=${encodeURIComponent(APPLICATION_PATH)}`;
export const SIGN_IN_TO_APPLY = `/auth?returnTo=${encodeURIComponent(APPLICATION_PATH)}`;

const steps = [
  ['Create an account', 'Anyone can start. You confirm your email address first; that is how we know the application is yours.'],
  ['Apply', 'Say whether you apply as an individual or as a company, what you want to do (sell, train, or both) and tell us about your experience.'],
  ['Upload evidence', 'Add identity, company registration, qualification or insurance documents (PDF, PNG or JPEG, up to 512 KiB each). A reviewer checks each one.'],
  ['Review', 'A reviewer from our team decides. If something is missing you can amend the application and add documents; you are told the reason for any decision.'],
  ['Start work', 'Approved providers receive a unique provider code. Sales you make are recorded against it, at 17% of the net package price.'],
] as const;

export default function BecomeProvider() {
  const { user } = useAuth();

  return (
    <Layout>
      <main id="main-content" className="mx-auto w-full max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold text-[#0b0c0c]">Become a provider</h1>
        <p className="mt-3 text-lg text-[#0b0c0c]">
          Sell FRAUD-RISK.CO.UK packages to organisations, deliver training, or do both. Applications are open to
          individuals and companies.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {user ? (
            <Button asChild size="lg">
              <Link to={APPLICATION_PATH}>Go to your application</Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg">
                <Link to={SIGN_UP_TO_APPLY}>Create an account and apply</Link>
              </Button>
              <Link to={SIGN_IN_TO_APPLY} className="text-[#1d70b8] underline">
                I already have an account
              </Link>
            </>
          )}
        </div>

        <h2 className="mt-10 text-2xl font-bold text-[#0b0c0c]">How it works</h2>
        <ol className="mt-4 space-y-4">
          {steps.map(([title, text], index) => (
            <li key={title} className="flex gap-4">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1d70b8] font-bold text-white"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="font-semibold text-[#0b0c0c]">{title}</h3>
                <p className="text-[#0b0c0c]">{text}</p>
              </div>
            </li>
          ))}
        </ol>

        <h2 className="mt-10 text-2xl font-bold text-[#0b0c0c]">Things to know</h2>
        <ul className="mt-4 list-disc space-y-2 pl-6 text-[#0b0c0c]">
          <li>Applying does not guarantee approval, and nothing is payable before you are approved.</li>
          <li>Payments are checked by our finance team; nobody can approve their own payout.</li>
          <li>
            Your documents are used only to assess your application and are kept as our records require. See our{' '}
            <Link to="/privacy" className="text-[#1d70b8] underline">
              privacy notice
            </Link>
            .
          </li>
        </ul>
      </main>
    </Layout>
  );
}
