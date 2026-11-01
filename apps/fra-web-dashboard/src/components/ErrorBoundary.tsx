import React, { Component, ErrorInfo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { createLogger } from '@/lib/logger';
import { reportError } from '@/lib/errorReporter';
const logger = createLogger('ErrorBoundary');

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('Uncaught error', { error, info });
    reportError('react', error, info.componentStack ?? undefined);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="flex min-h-screen items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-col items-center gap-2">
              <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
              <CardTitle level={1} className="text-center">Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <p className="text-center text-sm text-muted-foreground">
                An unexpected error occurred. Please try again or contact support if the problem persists.
              </p>
              <Button
                onClick={() => this.setState({ hasError: false, error: null })}
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
