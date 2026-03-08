import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { api, connectSSE } from '@/lib/api';
import { createLogger } from '@/lib/logger';
const logger = createLogger('Facilitator');
import { Layout } from '@/components/layout/Layout';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { WorkshopSession, Poll, Question } from '@/types/workshop';
import {
  Plus,
  Users,
  MessageSquare,
  BarChart3,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  Square,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';

export default function Facilitator() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [sessions, setSessions] = useState<WorkshopSession[]>([]);
  const [activeSession, setActiveSession] = useState<WorkshopSession | null>(null);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // New session form
  const [newSessionTitle, setNewSessionTitle] = useState('');

  // New poll form
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState('');

  // Auth and role checks handled by ProtectedRoute in App.tsx
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchPolls = useCallback(async (sessionId: string) => {
    try {
      const data = await api.get<Poll[]>(`/api/v1/workshop/sessions/${sessionId}/polls`);
      if (isMountedRef.current) setPolls(data.map(p => ({ ...p, options: p.options as string[] })));
    } catch (err: unknown) {
      logger.warn('Failed to fetch polls', err);
    }
  }, []);

  const fetchQuestions = useCallback(async (sessionId: string) => {
    try {
      const data = await api.get<Question[]>(`/api/v1/workshop/sessions/${sessionId}/questions`);
      if (isMountedRef.current) setQuestions(data);
    } catch (err: unknown) {
      logger.warn('Failed to fetch questions', err);
    }
  }, []);

  const fetchParticipantCount = useCallback(async (sessionId: string) => {
    try {
      const data = await api.get<{ count: number }>(`/api/v1/workshop/sessions/${sessionId}/participants`);
      if (isMountedRef.current) setParticipantCount(data.count);
    } catch (err: unknown) {
      logger.warn('Failed to fetch participant count', err);
    }
  }, []);

  const fetchSessionData = useCallback(async (sessionId: string) => {
    await Promise.all([
      fetchPolls(sessionId),
      fetchQuestions(sessionId),
      fetchParticipantCount(sessionId),
    ]);
  }, [fetchPolls, fetchQuestions, fetchParticipantCount]);

  const fetchSessions = useCallback(async () => {
    if (!user) return;

    try {
      const data = await api.get<WorkshopSession[]>('/api/v1/workshop/sessions');
      if (!isMountedRef.current) return;
      setSessions(data);
      const active = data.find(s => s.is_active);
      if (active) setActiveSession(active);
    } catch (err: unknown) {
      logger.error('Error fetching sessions', err);
      if (isMountedRef.current) toast.error('Failed to load sessions');
    }
    if (isMountedRef.current) setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchSessions();
    }
  }, [user, fetchSessions]);

  const activeSessionId = activeSession?.id;
  useEffect(() => {
    if (!activeSessionId) return;

    fetchSessionData(activeSessionId);

    // SSE subscription for real-time updates
    const cleanup = connectSSE(`/api/v1/workshop/sessions/${activeSessionId}/events`, {
      session_update: (data) => {
        const updated = data as WorkshopSession;
        setActiveSession(updated);
        setSessions(prev => prev.map(s => s.id === updated.id ? updated : s));
      },
      poll_created: (data) => {
        const poll = data as Poll;
        setPolls(prev => [{ ...poll, options: poll.options as string[] }, ...prev]);
      },
      poll_closed: (data) => {
        const poll = data as Poll;
        setPolls(prev => prev.map(p => p.id === poll.id ? { ...p, is_active: false } : p));
      },
      question_added: () => {
        fetchQuestions(activeSessionId);
      },
      question_updated: () => {
        fetchQuestions(activeSessionId);
      },
      participant_joined: () => {
        fetchParticipantCount(activeSessionId);
      },
    });

    return cleanup;
  }, [activeSessionId, fetchSessionData, fetchQuestions, fetchParticipantCount]);

  const createSession = async () => {
    if (!user || !newSessionTitle.trim()) return;

    setIsCreating(true);

    try {
      const data = await api.post<WorkshopSession>('/api/v1/workshop/sessions', {
        title: newSessionTitle.trim(),
      });
      setSessions(prev => [data, ...prev]);
      setActiveSession(data);
      setNewSessionTitle('');
      toast.success(`Session created! Code: ${data.session_code}`);
    } catch (err: unknown) {
      toast.error('Failed to create session');
      logger.error('Error creating session', err);
    }
    setIsCreating(false);
  };

  const endSession = async (sessionId: string) => {
    try {
      await api.post(`/api/v1/workshop/sessions/${sessionId}/end`, {});
      toast.success('Session ended');
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, is_active: false, ended_at: new Date().toISOString() } : s));
      if (activeSession?.id === sessionId) setActiveSession(null);
    } catch {
      toast.error('Failed to end session');
    }
  };

  const createPoll = async () => {
    if (!activeSession || !pollQuestion.trim() || !pollOptions.trim()) return;

    const options = pollOptions.split('\n').map(o => o.trim()).filter(Boolean);
    if (options.length < 2) {
      toast.error('Please provide at least 2 options');
      return;
    }

    try {
      const data = await api.post<Poll>(`/api/v1/workshop/sessions/${activeSession.id}/polls`, {
        question: pollQuestion.trim(),
        options,
      });
      setPolls(prev => [{ ...data, options: data.options as string[] }, ...prev]);
      setPollQuestion('');
      setPollOptions('');
      setShowPollForm(false);
      toast.success('Poll created and live!');
    } catch {
      toast.error('Failed to create poll');
    }
  };

  const closePoll = async (pollId: string) => {
    try {
      await api.patch(`/api/v1/workshop/polls/${pollId}`, { isActive: false });
      setPolls(prev => prev.map(p => p.id === pollId ? { ...p, is_active: false } : p));
      toast.success('Poll closed');
    } catch {
      toast.error('Failed to close poll');
    }
  };

  const markQuestionAnswered = async (questionId: string) => {
    try {
      await api.patch(`/api/v1/workshop/questions/${questionId}`, { isAnswered: true });
      setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, is_answered: true } : q));
    } catch {
      toast.error('Failed to update question');
    }
  };

  const copySessionCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Session code copied!');
    } catch {
      toast.error('Unable to copy. Please select and copy manually.');
    }
  };

  if (authLoading || isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Loading" />
        </div>
      </Layout>
    );
  }

  if (!user || !profile) return null;

  return (
    <Layout>
      <div className="container py-8 lg:py-12">
        <Button variant="ghost" className="mb-6" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Facilitator Dashboard</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Create and manage live workshop sessions
          </p>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left column: Sessions */}
            <div className="lg:col-span-1 space-y-6">
              {/* Create Session */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">New Session</CardTitle>
                  <CardDescription>Start a live workshop session</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="session-title">Session Title</Label>
                      <Input
                        id="session-title"
                        value={newSessionTitle}
                        onChange={(e) => setNewSessionTitle(e.target.value)}
                        placeholder="e.g., Q1 Board Workshop"
                      />
                    </div>
                    <Button
                      onClick={createSession}
                      disabled={isCreating || !newSessionTitle.trim()}
                      className="w-full"
                    >
                      {isCreating ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Create Session
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Session List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Your Sessions</CardTitle>
                </CardHeader>
                <CardContent>
                  {sessions.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No sessions yet</p>
                  ) : (
                    <div className="space-y-3">
                      {sessions.map(s => (
                        <div
                          key={s.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Select session: ${s.title}`}
                          aria-current={activeSession?.id === s.id ? 'true' : undefined}
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            activeSession?.id === s.id ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                          }`}
                          onClick={() => setActiveSession(s)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveSession(s); } }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm">{s.title}</span>
                            {s.is_active ? (
                              <Badge className="bg-success text-success-foreground">Live</Badge>
                            ) : (
                              <Badge variant="secondary">Ended</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{s.session_code}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); copySessionCode(s.session_code); }}
                              className="hover:text-foreground"
                              aria-label={`Copy session code ${s.session_code}`}
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(s.created_at).toLocaleDateString('en-GB')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right column: Active session management */}
            <div className="lg:col-span-2 space-y-6">
              {activeSession ? (
                <>
                  {/* Session Info */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{activeSession.title}</CardTitle>
                          <CardDescription>
                            Session Code:{' '}
                            <span className="font-mono font-medium text-foreground">
                              {activeSession.session_code}
                            </span>
                            <button
                              onClick={() => copySessionCode(activeSession.session_code)}
                              className="ml-2 text-muted-foreground hover:text-foreground"
                              aria-label="Copy session code"
                            >
                              <Copy className="h-3.5 w-3.5 inline" />
                            </button>
                          </CardDescription>
                        </div>
                        {activeSession.is_active && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Square className="mr-2 h-4 w-4" />
                                End Session
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>End this session?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will disconnect all {participantCount} participant{participantCount !== 1 ? 's' : ''} and close any active polls. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className={buttonVariants({ variant: 'destructive' })}
                                  onClick={() => endSession(activeSession.id)}
                                >
                                  End Session
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                          <Users className="h-5 w-5 text-primary" />
                          <div>
                            <div className="text-2xl font-bold">{participantCount}</div>
                            <div className="text-xs text-muted-foreground">Participants</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                          <BarChart3 className="h-5 w-5 text-primary" />
                          <div>
                            <div className="text-2xl font-bold">{polls.length}</div>
                            <div className="text-xs text-muted-foreground">Polls Created</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                          <MessageSquare className="h-5 w-5 text-primary" />
                          <div>
                            <div className="text-2xl font-bold">{questions.length}</div>
                            <div className="text-xs text-muted-foreground">Questions</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Polls */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Live Polls</CardTitle>
                        {activeSession.is_active && (
                          <Button size="sm" onClick={() => setShowPollForm(!showPollForm)}>
                            <Plus className="mr-2 h-4 w-4" />
                            New Poll
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {showPollForm && (
                        <div className="mb-6 p-4 rounded-lg border space-y-3">
                          <div>
                            <Label htmlFor="poll-question">Question</Label>
                            <Input
                              id="poll-question"
                              value={pollQuestion}
                              onChange={(e) => setPollQuestion(e.target.value)}
                              placeholder="What is your organisation's biggest fraud risk?"
                            />
                          </div>
                          <div>
                            <Label htmlFor="poll-options">Options (one per line)</Label>
                            <Textarea
                              id="poll-options"
                              value={pollOptions}
                              onChange={(e) => setPollOptions(e.target.value)}
                              placeholder={"Procurement fraud\nPayroll fraud\nCyber fraud\nExpense fraud"}
                              rows={4}
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={createPoll} size="sm">
                              <Play className="mr-2 h-4 w-4" />
                              Launch Poll
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setShowPollForm(false)}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {polls.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No polls yet</p>
                      ) : (
                        <div className="space-y-3">
                          {polls.map(poll => (
                            <div key={poll.id} className="p-3 rounded-lg border">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-sm">{poll.question}</span>
                                {poll.is_active ? (
                                  <div className="flex items-center gap-2">
                                    <Badge className="bg-success text-success-foreground">Live</Badge>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="sm" aria-label="Close poll">
                                          <XCircle className="h-4 w-4" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Close this poll?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Participants will no longer be able to submit responses. Results will still be visible.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => closePoll(poll.id)}>
                                            Close Poll
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                ) : (
                                  <Badge variant="secondary">Closed</Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {(poll.options as string[]).join(' | ')}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Q&A */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Questions from Participants</CardTitle>
                      <CardDescription>
                        {questions.filter(q => !q.is_answered).length} unanswered
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {questions.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No questions yet</p>
                      ) : (
                        <div className="space-y-3">
                          {questions.map(q => (
                            <div
                              key={q.id}
                              className={`p-3 rounded-lg border flex items-start justify-between gap-3 ${
                                q.is_answered ? 'opacity-60' : ''
                              }`}
                            >
                              <div className="flex-1">
                                <p className="text-sm">{q.question_text}</p>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                  <span>{q.upvotes} upvotes</span>
                                  <span>{new Date(q.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              </div>
                              {!q.is_answered ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => markQuestionAnswered(q.id)}
                                >
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Answered
                                </Button>
                              ) : (
                                <Badge variant="secondary">
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Done
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="flex items-center justify-center min-h-[300px]">
                  <CardContent className="text-center">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Session Selected</h3>
                    <p className="text-muted-foreground">
                      Create a new session or select an existing one to manage it.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
