import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useWorkshopProgress } from '@/hooks/useWorkshopProgress';
import { useSession } from '@/hooks/useSession';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { workshopSections, sectionContent, quizQuestions, caseStudies, scenarioExercise } from '@/data/workshopContent';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  MessageSquare,
  Users,
  Loader2,
  AlertCircle,
  Lightbulb,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

export default function Workshop() {
  const [searchParams] = useSearchParams();
  const sessionCode = searchParams.get('session');
  
  const { user, profile } = useAuth();
  const { progress, updateSection, completeSection, saveQuizScore, saveScenarioChoice, isLoading: progressLoading } = useWorkshopProgress(sessionCode);
  const { session, participantCount, joinSession } = useSession(sessionCode || undefined);
  const navigate = useNavigate();

  const [currentSlide, setCurrentSlide] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [scenarioStep, setScenarioStep] = useState(0);
  const [scenarioChoice, setScenarioChoice] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  useEffect(() => {
    if (progress?.current_section !== undefined) {
      const maxSlide = workshopSections.length - 1;
      setCurrentSlide(Math.max(0, Math.min(progress.current_section, maxSlide)));
    }
  }, [progress?.current_section]);

  useEffect(() => {
    if (sessionCode && user) {
      joinSession();
    }
  }, [sessionCode, user, joinSession]);

  if (progressLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-label="Loading workshop">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        </div>
      </Layout>
    );
  }

  if (!user || !profile) return null;

  const totalSlides = workshopSections.length;
  const progressPercent = ((currentSlide + 1) / totalSlides) * 100;
  const currentSection = sectionContent[currentSlide];
  const currentQuiz = quizQuestions[currentSlide];
  const sectorCaseStudy = caseStudies[profile.sector];

  const handleNext = async () => {
    if (currentSlide < totalSlides - 1) {
      await completeSection(currentSlide);
      const nextSlide = currentSlide + 1;
      setCurrentSlide(nextSlide);
      await updateSection(nextSlide);
      setQuizAnswer(null);
      setQuizSubmitted(false);
      setScenarioChoice(null);
      setShowFeedback(false);
    } else {
      // Workshop complete
      await completeSection(currentSlide);
      toast.success('Congratulations! Workshop completed!');
      navigate('/certificate');
    }
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      const prevSlide = currentSlide - 1;
      setCurrentSlide(prevSlide);
      updateSection(prevSlide);
      setQuizAnswer(null);
      setQuizSubmitted(false);
    }
  };

  const handleQuizSubmit = async () => {
    if (quizAnswer === null || !currentQuiz) return;
    
    setQuizSubmitted(true);
    const isCorrect = quizAnswer === currentQuiz.correctAnswer;
    const score = isCorrect ? 100 : 0;
    await saveQuizScore(currentSlide, score);
    
    if (isCorrect) {
      toast.success('Correct! Well done.');
    } else {
      toast.error('Not quite right. Review the explanation.');
    }
  };

  const handleScenarioChoice = (choiceId: string) => {
    setScenarioChoice(choiceId);
    setShowFeedback(true);
    saveScenarioChoice(`step${scenarioStep}`, choiceId);
  };

  const goToSlide = async (index: number) => {
    setCurrentSlide(index);
    await updateSection(index);
    setQuizAnswer(null);
    setQuizSubmitted(false);
  };

  return (
    <Layout showHeader={false}>
      <div className="min-h-screen flex">
        {/* Sidebar */}
        <aside className="hidden lg:flex w-80 flex-col border-r bg-card">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Workshop Progress</h2>
            <div className="mt-2">
              <Progress value={progressPercent} className="h-2" aria-label={`Workshop progress: ${currentSlide + 1} of ${totalSlides} sections`} />
              <p className="text-sm text-muted-foreground mt-1">
                {currentSlide + 1} of {totalSlides} sections
              </p>
            </div>
          </div>
          
          <nav className="flex-1 overflow-y-auto p-2" aria-label="Workshop sections">
            {workshopSections.map((section, index) => {
              const isComplete = progress?.completed_sections?.includes(section.id);
              const isCurrent = index === currentSlide;
              
              return (
                <button
                  key={section.id}
                  onClick={() => goToSlide(index)}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Section ${index + 1}: ${section.title}${isComplete ? ' (completed)' : ''}`}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : isComplete
                        ? 'hover:bg-muted text-foreground'
                        : 'hover:bg-muted text-muted-foreground'
                  }`}
                >
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    isComplete && !isCurrent
                      ? 'bg-success text-success-foreground'
                      : isCurrent
                        ? 'bg-primary-foreground text-primary'
                        : 'bg-muted-foreground/20'
                  }`}>
                    {isComplete && !isCurrent ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{section.title}</div>
                    <div className={`text-xs ${isCurrent ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {section.duration}
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>

          {session && (
            <div className="p-4 border-t">
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4" aria-hidden="true" />
                <span>{participantCount} participants</span>
              </div>
              <Badge variant="secondary" className="mt-2">
                Session: {session.session_code}
              </Badge>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {/* Top Bar */}
          <header className="border-b p-4 flex items-center justify-between bg-card" aria-label="Workshop navigation">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
              Exit Workshop
            </Button>
            
            <div className="flex items-center gap-4">
              <div className="lg:hidden">
                <Progress value={progressPercent} className="w-32 h-2" aria-label={`Workshop progress: ${currentSlide + 1} of ${totalSlides} sections`} />
              </div>
              <span className="text-sm text-muted-foreground">
                {currentSlide + 1} / {totalSlides}
              </span>
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto">
            <div className="container max-w-4xl py-8 lg:py-12">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Section Header */}
                  <div className="mb-8">
                    <Badge variant="secondary" className="mb-4">
                      Section {currentSlide + 1}
                    </Badge>
                    <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mb-2">
                      {currentSection?.title}
                    </h1>
                    <p className="text-lg text-muted-foreground">
                      {currentSection?.subtitle}
                    </p>
                  </div>

                  {/* Key Points */}
                  <Card className="mb-8">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-accent" aria-hidden="true" />
                        Key Learning Points
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {currentSection?.keyPoints.map((point, index) => (
                          <motion.li
                            key={point}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-start gap-3"
                          >
                            <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" aria-hidden="true" />
                            <span>{point}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Discussion Prompt */}
                  <Card className="mb-8 border-accent/50 bg-accent/5">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <MessageSquare className="h-5 w-5 text-accent" aria-hidden="true" />
                        Discussion Prompt
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg italic">"{currentSection?.discussionPrompt}"</p>
                    </CardContent>
                  </Card>

                  {/* Quiz (if available for this section) */}
                  {currentQuiz && (
                    <Card className="mb-8">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <HelpCircle className="h-5 w-5 text-primary" aria-hidden="true" />
                          Quick Quiz
                        </CardTitle>
                        <CardDescription>
                          Test your understanding of this section
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="font-medium mb-4">{currentQuiz.question}</p>
                        <RadioGroup
                          value={quizAnswer?.toString()}
                          onValueChange={(v) => setQuizAnswer(parseInt(v))}
                          disabled={quizSubmitted}
                        >
                          {currentQuiz.options.map((option, index) => (
                            <div
                              key={option}
                              className={`flex items-center space-x-2 p-3 rounded-lg border transition-colors ${
                                quizSubmitted
                                  ? index === currentQuiz.correctAnswer
                                    ? 'border-success bg-success/10'
                                    : quizAnswer === index
                                      ? 'border-destructive bg-destructive/10'
                                      : ''
                                  : quizAnswer === index
                                    ? 'border-primary bg-primary/5'
                                    : 'hover:bg-muted'
                              }`}
                            >
                              <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                              <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                                {option}
                              </Label>
                              {quizSubmitted && index === currentQuiz.correctAnswer && (
                                <CheckCircle2 className="h-4 w-4 text-success" aria-label="Correct answer" />
                              )}
                              {quizSubmitted && quizAnswer === index && index !== currentQuiz.correctAnswer && (
                                <AlertCircle className="h-4 w-4 text-destructive" aria-label="Incorrect answer" />
                              )}
                            </div>
                          ))}
                        </RadioGroup>

                        {!quizSubmitted ? (
                          <Button 
                            className="mt-4" 
                            onClick={handleQuizSubmit}
                            disabled={quizAnswer === null}
                          >
                            Submit Answer
                          </Button>
                        ) : (
                          <div className="mt-4 p-4 rounded-lg bg-muted" role="status" aria-label="Quiz explanation">
                            <p className="font-medium mb-1">Explanation:</p>
                            <p className="text-muted-foreground">{currentQuiz.explanation}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Case Study (only on section 5) */}
                  {currentSlide === 5 && sectorCaseStudy && (
                    <Card className="mb-8">
                      <CardHeader>
                        <CardTitle>Case Study: {sectorCaseStudy.title}</CardTitle>
                        <CardDescription>
                          A real-world example from the {profile.sector} sector
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="p-4 bg-muted rounded-lg">
                          <p>{sectorCaseStudy.scenario}</p>
                        </div>

                        <div>
                          <h4 className="font-medium mb-3">Discussion Questions:</h4>
                          <ul className="space-y-2">
                            {sectorCaseStudy.questions.map((q, qIndex) => (
                              <li key={q} className="flex items-start gap-2">
                                <span className="font-medium text-primary">{qIndex + 1}.</span>
                                <span>{q}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h4 className="font-medium mb-3">Key Learning Points:</h4>
                          <ul className="space-y-2">
                            {sectorCaseStudy.learningPoints.map((point) => (
                              <li key={point} className="flex items-start gap-2">
                                <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-1" aria-hidden="true" />
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Interactive Scenario */}
                        <div className="border-t pt-6">
                          <h4 className="font-medium mb-4">Interactive Scenario: {scenarioExercise.title}</h4>
                          <p className="text-muted-foreground mb-4">{scenarioExercise.introduction}</p>

                          {scenarioStep < scenarioExercise.steps.length && (
                            <Card>
                              <CardContent className="pt-6">
                                <p className="mb-4">{scenarioExercise.steps[scenarioStep].description}</p>
                                
                                <div className="space-y-2">
                                  {scenarioExercise.steps[scenarioStep].options.map((option) => (
                                    <button
                                      type="button"
                                      key={option.id}
                                      onClick={() => handleScenarioChoice(option.id)}
                                      disabled={showFeedback}
                                      className={`w-full text-left p-4 rounded-lg border transition-colors ${
                                        showFeedback
                                          ? option.isCorrect
                                            ? 'border-success bg-success/10'
                                            : scenarioChoice === option.id
                                              ? 'border-destructive bg-destructive/10'
                                              : ''
                                          : 'hover:bg-muted hover:border-primary'
                                      }`}
                                    >
                                      {option.text}
                                    </button>
                                  ))}
                                </div>

                                {showFeedback && (
                                  <div className="mt-4 p-4 rounded-lg bg-muted" role="status" aria-live="polite">
                                    <p className="font-medium mb-1">
                                      {scenarioExercise.steps[scenarioStep].options.find(o => o.id === scenarioChoice)?.isCorrect
                                        ? '✓ Good choice!'
                                        : '✗ Consider this:'}
                                    </p>
                                    <p className="text-muted-foreground">
                                      {scenarioExercise.steps[scenarioStep].options.find(o => o.id === scenarioChoice)?.feedback}
                                    </p>
                                    
                                    {scenarioStep < scenarioExercise.steps.length - 1 && (
                                      <Button 
                                        className="mt-4" 
                                        onClick={() => {
                                          setScenarioStep(prev => prev + 1);
                                          setScenarioChoice(null);
                                          setShowFeedback(false);
                                        }}
                                      >
                                        Continue Scenario
                                        <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          )}

                          {scenarioStep >= scenarioExercise.steps.length && (
                            <Card className="border-success bg-success/5">
                              <CardContent className="pt-6">
                                <div className="flex items-center gap-2 mb-2">
                                  <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
                                  <span className="font-medium">Scenario Complete!</span>
                                </div>
                                <p className="text-muted-foreground">
                                  You've completed the interactive scenario. Your choices have been recorded.
                                </p>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Navigation Footer */}
          <footer className="border-t p-4 bg-card" aria-label="Workshop section navigation">
            <div className="container max-w-4xl flex items-center justify-between">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentSlide === 0}
              >
                <ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Previous
              </Button>

              <div className="flex items-center gap-2">
                {workshopSections.map((section, index) => (
                  <button
                    key={section.id}
                    onClick={() => goToSlide(index)}
                    aria-label={`Go to section ${index + 1}`}
                    aria-current={index === currentSlide ? 'step' : undefined}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      index === currentSlide
                        ? 'bg-primary'
                        : progress?.completed_sections?.includes(index)
                          ? 'bg-success'
                          : 'bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>

              <Button onClick={handleNext}>
                {currentSlide === totalSlides - 1 ? 'Complete Workshop' : 'Next'}
                <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </footer>
        </main>
      </div>
    </Layout>
  );
}