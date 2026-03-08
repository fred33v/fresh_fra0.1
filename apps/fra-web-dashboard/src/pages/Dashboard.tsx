import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useWorkshopProgress } from '@/hooks/useWorkshopProgress';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { workshopSections } from '@/data/workshopContent';
import {
  Play,
  Clock,
  CheckCircle2,
  BookOpen,
  Award,
  Target,
  ArrowRight,
  FileText,
  Users,
  Loader2,
} from 'lucide-react';

export default function Dashboard() {
  const { user, profile } = useAuth();
  const { progress, isLoading: progressLoading } = useWorkshopProgress();
  const navigate = useNavigate();

  if (progressLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Setting up your dashboard…</p>
        </div>
      </Layout>
    );
  }

  if (!user || !profile) return null;

  const completedCount = progress?.completed_sections?.length || 0;
  const totalSections = workshopSections.length;
  const progressPercent = (completedCount / totalSections) * 100;
  const isCompleted = progress?.completed_at !== null;
  const currentSection = progress?.current_section || 0;

  const getSectorLabel = (sector: string) => {
    switch (sector) {
      case 'public': return 'Public Sector';
      case 'charity': return 'Charity / Non-Profit';
      case 'private': return 'Private Sector';
      default: return sector;
    }
  };

  return (
    <Layout>
      <div className="container py-8 lg:py-12">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Welcome back, {profile.full_name?.split(' ')[0] || 'there'}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <span>{profile.organization_name}</span>
            <span>•</span>
            <Badge variant="secondary">{getSectorLabel(profile.sector)}</Badge>
            {profile.job_title && (
              <>
                <span>•</span>
                <span>{profile.job_title}</span>
              </>
            )}
          </div>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Workshop Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2"
          >
            <Card className="overflow-hidden">
              <div className="gradient-hero p-6 lg:p-8">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-primary-foreground mb-2">
                      Fraud Risk Awareness Workshop
                    </h2>
                    <p className="text-primary-foreground/80 mb-4">
                      Interactive 30-minute training for trustees and leadership
                    </p>
                    <div className="flex items-center gap-4 text-sm text-primary-foreground/70">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" aria-hidden="true" />
                        30 minutes
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" aria-hidden="true" />
                        {totalSections} modules
                      </span>
                    </div>
                  </div>
                  {isCompleted && (
                    <Badge className="bg-success text-success-foreground">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Completed
                    </Badge>
                  )}
                </div>
              </div>
              
              <CardContent className="p-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{completedCount} / {totalSections} modules</span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button size="lg" className="flex-1" asChild>
                    <Link to="/workshop">
                      {completedCount === 0 ? (
                        <>
                          <Play className="mr-2 h-5 w-5" />
                          Start Workshop
                        </>
                      ) : isCompleted ? (
                        <>
                          <BookOpen className="mr-2 h-5 w-5" />
                          Review Workshop
                        </>
                      ) : (
                        <>
                          <ArrowRight className="mr-2 h-5 w-5" />
                          Continue Workshop
                        </>
                      )}
                    </Link>
                  </Button>
                  {isCompleted && (
                    <Button size="lg" variant="outline" asChild>
                      <Link to="/certificate">
                        <Award className="mr-2 h-5 w-5" />
                        View Certificate
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Quiz Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Object.keys(progress?.quiz_scores || {}).length > 0 ? (
                  <div className="text-3xl font-bold">
                    {Math.round(
                      Object.values(progress?.quiz_scores || {}).reduce((a, b) => a + b, 0) /
                      Object.keys(progress?.quiz_scores || {}).length
                    )}%
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">No quizzes taken yet</p>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/workshop">Start Workshop</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Current Section
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="font-medium">
                  {workshopSections[currentSection]?.title || 'Not started'}
                </div>
              </CardContent>
            </Card>

            {isCompleted && (
              <Card className="border-success/50 bg-success/5">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                      <Award className="h-5 w-5 text-success" aria-hidden="true" />
                    </div>
                    <div>
                      <div className="font-medium">Workshop Complete!</div>
                      <div className="text-sm text-muted-foreground">
                        Certificate available
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="hover:shadow-md transition-shadow cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" role="button" tabIndex={0} onClick={() => navigate('/resources')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/resources'); } }}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <div>
                  <div className="font-medium">Resources</div>
                  <div className="text-sm text-muted-foreground">Download materials</div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" role="button" tabIndex={0} onClick={() => navigate('/action-plan')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/action-plan'); } }}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-accent" aria-hidden="true" />
                </div>
                <div>
                  <div className="font-medium">Action Plan</div>
                  <div className="text-sm text-muted-foreground">View your plan</div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" role="button" tabIndex={0} onClick={() => navigate('/workshop')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/workshop'); } }}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-info" aria-hidden="true" />
                </div>
                <div>
                  <div className="font-medium">Join Session</div>
                  <div className="text-sm text-muted-foreground">Live workshop</div>
                </div>
              </CardContent>
            </Card>

            {isCompleted && (
              <Card className="hover:shadow-md transition-shadow cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" role="button" tabIndex={0} onClick={() => navigate('/certificate')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/certificate'); } }}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <Award className="h-5 w-5 text-success" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="font-medium">Certificate</div>
                    <div className="text-sm text-muted-foreground">Download PDF</div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </motion.div>

        {/* Module Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8"
        >
          <h3 className="text-lg font-semibold mb-4">Workshop Modules</h3>
          <div className="grid gap-3">
            {workshopSections.map((section, index) => {
              const isComplete = progress?.completed_sections?.includes(section.id);
              const isCurrent = section.id === currentSection;
              
              return (
                <Card 
                  key={section.id}
                  className={`transition-all ${isCurrent ? 'ring-2 ring-primary' : ''} ${isComplete ? 'bg-success/5' : ''}`}
                >
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-4">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        isComplete 
                          ? 'bg-success text-success-foreground' 
                          : isCurrent 
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                      }`}>
                        {isComplete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{section.title}</div>
                        <div className="text-sm text-muted-foreground">{section.duration}</div>
                      </div>
                    </div>
                    {isCurrent && !isComplete && (
                      <Badge>In Progress</Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}