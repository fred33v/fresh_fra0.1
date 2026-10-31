import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

// Employers hand out codes like "K7QX-4MPA-9WTD", so spaces and dashes are not part of the code
const normaliseCode = (raw: string) => raw.replace(/[\s-]/g, '').toUpperCase();

const joinSchema = z.object({
  code: z.string().refine((v) => /^[A-Z0-9]{6,64}$/.test(normaliseCode(v)), 'Enter the key-pass your employer gave you'),
  name: z.string().max(200).optional(),
  email: z.string().email('Please enter a valid email address'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type JoinFormData = z.infer<typeof joinSchema>;

/** What to tell someone whose code was refused, by the error the server sent */
function joinErrorMessage(error: Error): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'NOT_FOUND':
        return "We don't recognise that key-pass. Check it against the one your employer gave you.";
      case 'EXPIRED':
        return 'This key-pass has expired. Ask your employer for a new one.';
      case 'NOT_AVAILABLE':
      case 'ALREADY_USED':
        return 'This key-pass has already been used or was withdrawn. Ask your employer for a new one.';
      case 'PACKAGE_INACTIVE':
        return "Your organisation's package is no longer active. Ask your employer to renew it, then try again.";
      case 'ACCOUNT_EXISTS':
        return 'An account with this email already exists. Sign in instead.';
      case 'RATE_LIMITED':
        return 'Too many attempts. Please wait a minute and try again.';
      case 'VALIDATION_ERROR':
        return 'Please check your details and try again.';
    }
  }
  return 'We could not add you just now. Please try again.';
}

export default function Join() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading, joinWithKeypass } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<{ message: string; accountExists: boolean } | null>(null);

  const form = useForm<JoinFormData>({
    resolver: zodResolver(joinSchema),
    defaultValues: {
      code: normaliseCode(searchParams.get('code') ?? ''),
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: JoinFormData) => {
    setSubmitting(true);
    setFormError(null);
    const { error } = await joinWithKeypass({
      code: normaliseCode(data.code),
      email: data.email.trim(),
      password: data.password,
      name: data.name?.trim() || undefined,
    });
    if (error) {
      setFormError({ message: joinErrorMessage(error), accountExists: error instanceof ApiError && error.code === 'ACCOUNT_EXISTS' });
    } else {
      toast.success('Welcome! Your account is ready.');
      navigate('/dashboard');
    }
    setSubmitting(false);
  };

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent">
            <Shield className="h-6 w-6 text-accent-foreground" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold">Join your organisation</h1>
        </div>

        <Card className="border-0 shadow-xl">
          {user && !submitting ? (
            <>
              <CardHeader className="space-y-1">
                <CardTitle level={2} className="text-xl">You are already signed in</CardTitle>
                <CardDescription>
                  You are signed in as {user.email}. Sign out first if you want to join with a different account.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link to="/dashboard">Go to your dashboard</Link>
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="space-y-1">
                <CardTitle level={2} className="text-xl">Use your key-pass</CardTitle>
                <CardDescription>
                  Your employer gave you a key-pass that works once. Choose a password so you can sign back in later.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                    {formError && (
                      <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                        {formError.message}
                        {formError.accountExists && (
                          <>
                            {' '}
                            <Link to="/auth" className="font-medium underline">Go to sign in</Link>
                          </>
                        )}
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Key-pass</FormLabel>
                          <FormControl>
                            <Input autoComplete="off" autoCapitalize="characters" spellCheck={false} className="font-mono uppercase" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Your name (optional)</FormLabel>
                          <FormControl>
                            <Input autoComplete="name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Work email</FormLabel>
                          <FormControl>
                            <Input type="email" autoComplete="email" placeholder="you@organisation.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Choose a password</FormLabel>
                          <FormControl>
                            <Input type="password" autoComplete="new-password" {...field} />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">At least 12 characters, with a capital letter, a lowercase letter and a number.</p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm password</FormLabel>
                          <FormControl>
                            <Input type="password" autoComplete="new-password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                      Join
                    </Button>

                    <p className="text-xs text-muted-foreground">
                      By joining you agree to the <Link to="/terms" className="underline">terms of service</Link> and
                      confirm you have read the <Link to="/privacy" className="underline">privacy notice</Link>.
                    </p>
                  </form>
                </Form>

                <div className="mt-4 text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link to="/auth" className="text-primary font-medium hover:underline">Sign in</Link>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
