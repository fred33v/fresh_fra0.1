/**
 * Assessment Page Component
 * 
 * Main assessment workflow page:
 * 1. Displays one module at a time
 * 2. Shows questions for each module
 * 3. Collects answers
 * 4. Tracks progress
 * 5. Allows navigation between modules
 * 6. Submits answers for risk scoring
 */

import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useAssessment } from '@/hooks/useAssessment';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronLeft, ChevronRight, CheckCircle2, Lock } from 'lucide-react';
import { QuestionRenderer } from '@/components/assessment/QuestionRenderer';
import { PACKAGE_ERROR_CODES } from '@/types/assessment';

export default function Assessment() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const {
    assessment,
    answers,
    isLoading,
    error,
    errorCode,
    currentModule,
    modules,
    currentModuleIndex,
    progressPercent,
    startAssessment,
    updateAnswer,
    nextModule,
    previousModule,
    jumpToModule,
    submitAssessment,
    isCurrentModuleComplete,
  } = useAssessment();

  /**
   * Start assessment on component mount; errors wait for an explicit retry
   */
  useEffect(() => {
    if (!assessment && !isLoading && !error) {
      startAssessment();
    }
  }, [assessment, isLoading, error, startAssessment]);

  const handleSubmit = async () => {
    const results = await submitAssessment();
    if (results) navigate(`/assessment/${results.assessmentId}/results`);
  };

  if (!user || !profile) return null;

  if (!assessment && !error) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading assessment...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error && !assessment && errorCode && (PACKAGE_ERROR_CODES as readonly string[]).includes(errorCode)) {
    return (
      <Layout>
        <div className="container max-w-xl py-16">
          <Card>
            <CardHeader>
              <Lock className="h-8 w-8 text-muted-foreground mb-2" aria-hidden="true" />
              <CardTitle>
                {errorCode === 'ASSESSMENT_LIMIT_REACHED' ? 'Assessment limit reached' : 'A package is required'}
              </CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-3">
              <Button asChild>
                <Link to={errorCode === 'ASSESSMENT_LIMIT_REACHED' ? '/package/professional' : '/package/starter'}>
                  {errorCode === 'ASSESSMENT_LIMIT_REACHED' ? 'Upgrade your package' : 'See packages'}
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/dashboard">Back to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (error && !assessment) {
    return (
      <Layout>
        <div className="container py-8">
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
              <Button onClick={() => startAssessment()} className="mt-4">
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (!assessment || !currentModule || modules.length === 0) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Assessment not found</p>
        </div>
      </Layout>
    );
  }

  const canGoNext = isCurrentModuleComplete() || currentModuleIndex < modules.length - 1;
  const isLastModule = currentModuleIndex === modules.length - 1;
  const canSubmit = modules.every(m => 
    m.questions.every(q => answers[q.id] !== undefined)
  );
  // Next lets people skip ahead, so say what still blocks submitting and where
  const unanswered = modules
    .map(m => ({ name: m.title, count: m.questions.filter(q => answers[q.id] === undefined).length }))
    .filter(m => m.count > 0);
  const unansweredTotal = unanswered.reduce((n, m) => n + m.count, 0);

  return (
    <Layout>
      <div className="container py-8 lg:py-12">
        {/* Header with progress */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">
                Fraud Risk Assessment
              </h1>
              <p className="text-muted-foreground">
                Module {currentModuleIndex + 1} of {modules.length}
              </p>
            </div>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {Math.round(progressPercent)}% Complete
            </Badge>
          </div>

          {/* Progress bar */}
          <Progress value={progressPercent} className="h-2" />
        </motion.div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Module navigation sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden lg:block"
          >
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Modules</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {modules.map((module, idx) => {
                  const moduleComplete = module.questions.every(q => answers[q.id] !== undefined);
                  return (
                    <button
                      key={module.id}
                      onClick={() => jumpToModule(idx)}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                        currentModuleIndex === idx
                          ? 'bg-primary text-primary-foreground'
                          : moduleComplete
                          ? 'bg-success/10 text-success hover:bg-success/20'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {moduleComplete && <CheckCircle2 className="h-4 w-4" />}
                        <div>
                          <div className="text-xs font-medium font-medium">{module.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {module.questions.length} questions
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>

          {/* Main content: Current module */}
          <motion.div
            key={currentModule.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="lg:col-span-3"
          >
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="outline" className="bg-blue-50">
                    {currentModule.category}
                  </Badge>
                </div>
                <CardTitle className="text-2xl">{currentModule.title}</CardTitle>
                <CardDescription className="mt-2">
                  {currentModule.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-8">
                {/* Questions */}
                {currentModule.questions.map((question, idx) => (
                  <motion.div
                    key={question.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <div className="space-y-3">
                      <label className="text-base font-medium">
                        {idx + 1}. {question.text}
                      </label>
                      <QuestionRenderer
                        question={question}
                        value={answers[question.id]}
                        onChange={(value) => updateAnswer(question.id, value)}
                      />
                    </div>
                  </motion.div>
                ))}

                {/* Navigation buttons */}
                <div className="flex items-center justify-between pt-6 border-t mt-8">
                  <Button
                    variant="outline"
                    onClick={previousModule}
                    disabled={currentModuleIndex === 0}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>

                  {isLastModule ? (
                    <div className="flex flex-col items-end gap-2">
                    {!canSubmit && (
                      <p id="submit-hint" className="text-sm text-muted-foreground text-right">
                        {unansweredTotal} question{unansweredTotal === 1 ? '' : 's'} still to answer: {unanswered.map(m => `${m.name} (${m.count})`).join(', ')}
                      </p>
                    )}
                    <Button
                      onClick={handleSubmit}
                      disabled={!canSubmit || isLoading}
                      aria-describedby={!canSubmit ? 'submit-hint' : undefined}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Submit Assessment
                        </>
                      )}
                    </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={nextModule}
                      disabled={!canGoNext}
                    >
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
