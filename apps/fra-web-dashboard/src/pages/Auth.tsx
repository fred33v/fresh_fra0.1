import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Shield, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const signInSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signUpSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  organization_name: z.string().min(2, 'Organisation name is required'),
  sector: z.enum(['public', 'charity', 'private']),
  job_title: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Passwords don't match",
  path: ['confirmNewPassword'],
});

type SignInFormData = z.infer<typeof signInSchema>;
type SignUpFormData = z.infer<typeof signUpSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'reset'>(() => {
    const m = searchParams.get('mode');
    if (m === 'signup') return 'signup';
    if (m === 'forgot') return 'forgot';
    if (m === 'reset') return 'reset';
    return 'signin';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      full_name: '',
      organization_name: '',
      sector: 'private',
      job_title: '',
    },
  });

  const forgotForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const resetForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: searchParams.get('token') ?? '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const handleForgotPassword = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    try {
      await api.post('/api/v1/auth/forgot-password', { email: data.email });
      setForgotSent(true);
    } catch (_err) {
      // Always show success to prevent email enumeration
      setForgotSent(true);
    }
    setIsLoading(false);
  };

  const handleResetPassword = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    try {
      await api.post('/api/v1/auth/reset-password', {
        token: data.token,
        newPassword: data.newPassword,
      });
      setResetSuccess(true);
      toast.success('Password reset successfully');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_TOKEN') {
        toast.error('Invalid or expired reset link. Please request a new one.');
      } else {
        toast.error('Password reset failed. Please try again.');
      }
    }
    setIsLoading(false);
  };

  const handleSignIn = async (data: SignInFormData) => {
    setIsLoading(true);
    const { error } = await signIn(data.email, data.password);
    
    if (error) {
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        toast.error('Invalid email or password');
      } else if (error instanceof ApiError && error.code === 'ACCOUNT_LOCKED') {
        toast.error('Account temporarily locked. Please try again later.');
      } else {
        toast.error('Sign in failed. Please try again.');
      }
    } else {
      toast.success('Welcome back!');
      navigate('/dashboard');
    }
    setIsLoading(false);
  };

  const handleSignUp = async (data: SignUpFormData) => {
    setIsLoading(true);
    const { error } = await signUp(data.email, data.password, {
      full_name: data.full_name,
      organization_name: data.organization_name,
      sector: data.sector,
      job_title: data.job_title,
    });
    
    if (error) {
      if (error instanceof ApiError && error.code === 'SIGNUP_FAILED') {
        toast.error(error.message);
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } else {
      toast.success('Account created successfully!');
      navigate('/dashboard');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero p-12 flex-col justify-between">
        <div>
          <Button 
            variant="ghost" 
            className="text-primary-foreground hover:bg-white/10"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back to Home
          </Button>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
              <Shield className="h-7 w-7 text-accent-foreground" aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-bold text-primary-foreground">
              Fraud Risk Awareness
            </h1>
          </div>
          <p className="text-lg text-primary-foreground/80 max-w-md">
            Join our interactive workshop platform designed for trustees, leadership, and budget-holders to build fraud resilience.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 text-primary-foreground/80">
            <div className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            <span>Interactive learning modules</span>
          </div>
          <div className="flex items-center gap-3 text-primary-foreground/80">
            <div className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            <span>Real-time collaboration</span>
          </div>
          <div className="flex items-center gap-3 text-primary-foreground/80">
            <div className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            <span>Personalised action plans</span>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <main className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <Button
            variant="ghost"
            className="mb-6 lg:hidden"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back
          </Button>

          <AnimatePresence mode="wait">
            {mode === 'signin' ? (
              <motion.div
                key="signin"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="border-0 shadow-xl">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl">Welcome back</CardTitle>
                    <CardDescription>
                      Sign in to continue your fraud risk awareness journey
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...signInForm}>
                      <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4">
                        <FormField
                          control={signInForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input 
                                  type="email" 
                                  placeholder="you@organisation.com" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={signInForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input 
                                  type="password" 
                                  placeholder="••••••••" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button type="submit" className="w-full" disabled={isLoading} aria-busy={isLoading}>
                          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                          Sign In
                        </Button>
                      </form>
                    </Form>
                    <div className="mt-4 text-center text-sm">
                      <button
                        type="button"
                        onClick={() => setMode('forgot')}
                        className="text-muted-foreground hover:text-primary hover:underline"
                      >
                        Forgot your password?
                      </button>
                    </div>
                    <div className="mt-3 text-center text-sm">
                      Don't have an account?{' '}
                      <button
                        type="button"
                        onClick={() => setMode('signup')}
                        className="text-primary font-medium hover:underline"
                      >
                        Create one
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : mode === 'forgot' ? (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="border-0 shadow-xl">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl">Reset your password</CardTitle>
                    <CardDescription>
                      Enter your email address and we'll send you a reset link
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {forgotSent ? (
                      <div className="text-center space-y-4 py-4" role="status" aria-label="Reset link sent">
                        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" aria-hidden="true" />
                        <p className="text-sm text-muted-foreground">
                          If an account with that email exists, a password reset link has been sent. Please check your inbox.
                        </p>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => { setMode('signin'); setForgotSent(false); }}
                        >
                          Back to Sign In
                        </Button>
                      </div>
                    ) : (
                      <Form {...forgotForm}>
                        <form onSubmit={forgotForm.handleSubmit(handleForgotPassword)} className="space-y-4">
                          <FormField
                            control={forgotForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input
                                    type="email"
                                    placeholder="you@organisation.com"
                                    {...field}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button type="submit" className="w-full" disabled={isLoading} aria-busy={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                            Send Reset Link
                          </Button>
                        </form>
                      </Form>
                    )}
                    {!forgotSent && (
                      <div className="mt-6 text-center text-sm">
                        Remember your password?{' '}
                        <button
                          type="button"
                          onClick={() => setMode('signin')}
                          className="text-primary font-medium hover:underline"
                        >
                          Sign in
                        </button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : mode === 'reset' ? (
              <motion.div
                key="reset"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="border-0 shadow-xl">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl">Set a new password</CardTitle>
                    <CardDescription>
                      Enter your reset token and choose a new password
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {resetSuccess ? (
                      <div className="text-center space-y-4 py-4" role="status" aria-label="Password reset successful">
                        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" aria-hidden="true" />
                        <p className="text-sm text-muted-foreground">
                          Your password has been reset successfully. You can now sign in with your new password.
                        </p>
                        <Button
                          className="w-full"
                          onClick={() => { setMode('signin'); setResetSuccess(false); }}
                        >
                          Sign In
                        </Button>
                      </div>
                    ) : (
                      <Form {...resetForm}>
                        <form onSubmit={resetForm.handleSubmit(handleResetPassword)} className="space-y-4">
                          <FormField
                            control={resetForm.control}
                            name="token"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Reset Token</FormLabel>
                                <FormControl>
                                  <Input placeholder="Paste your reset token" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={resetForm.control}
                            name="newPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>New Password</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="••••••••" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={resetForm.control}
                            name="confirmNewPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Confirm New Password</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="••••••••" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button type="submit" className="w-full" disabled={isLoading} aria-busy={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                            Reset Password
                          </Button>
                        </form>
                      </Form>
                    )}
                    {!resetSuccess && (
                      <div className="mt-6 text-center text-sm">
                        <button
                          type="button"
                          onClick={() => setMode('forgot')}
                          className="text-primary font-medium hover:underline"
                        >
                          Request a new reset link
                        </button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="border-0 shadow-xl">
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl">Create an account</CardTitle>
                    <CardDescription>
                      Join the fraud risk awareness workshop
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...signUpForm}>
                      <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField
                            control={signUpForm.control}
                            name="full_name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Full Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="John Smith" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={signUpForm.control}
                            name="job_title"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Job Title (Optional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="Finance Director" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={signUpForm.control}
                          name="organization_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Organisation Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Your Organisation" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={signUpForm.control}
                          name="sector"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Sector</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select your sector" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="public">Public Sector</SelectItem>
                                  <SelectItem value="charity">Charity / Non-Profit</SelectItem>
                                  <SelectItem value="private">Private Sector</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={signUpForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="you@organisation.com" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField
                            control={signUpForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Password</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="••••••••" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={signUpForm.control}
                            name="confirmPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Confirm Password</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="••••••••" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading} aria-busy={isLoading}>
                          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                          Create Account
                        </Button>
                      </form>
                    </Form>
                    <div className="mt-6 text-center text-sm">
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => setMode('signin')}
                        className="text-primary font-medium hover:underline"
                      >
                        Sign in
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}