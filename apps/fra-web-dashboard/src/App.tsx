import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PackageGate } from "@/components/PackageGate";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Workshop = lazy(() => import("./pages/Workshop"));
const Assessment = lazy(() => import("./pages/Assessment"));
const AssessmentResults = lazy(() => import("./pages/AssessmentResults"));
const BudgetGuide = lazy(() => import("./pages/BudgetGuide"));
const Resources = lazy(() => import("./pages/Resources"));
const Certificate = lazy(() => import("./pages/Certificate"));
const ActionPlan = lazy(() => import("./pages/ActionPlan"));
const Facilitator = lazy(() => import("./pages/Facilitator"));
const PackageStarter = lazy(() => import("./pages/PackageStarter"));
const PackageProfessional = lazy(() => import("./pages/PackageProfessional"));
const PackageEnterprise = lazy(() => import("./pages/PackageEnterprise"));
const Checkout = lazy(() => import("./pages/Checkout"));
const EmployerDashboard = lazy(() => import("./pages/EmployerDashboard"));
const RiskRegister = lazy(() => import("./pages/RiskRegister"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Compliance = lazy(() => import("./pages/Compliance"));
const Profile = lazy(() => import("./pages/Profile"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SpeakUp = lazy(() => import("./pages/SpeakUp"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/workshop" element={<ProtectedRoute><PackageGate feature="training"><Workshop /></PackageGate></ProtectedRoute>} />
                <Route path="/assessment" element={<ProtectedRoute><Assessment /></ProtectedRoute>} />
                <Route path="/assessment/:assessmentId/results" element={<ProtectedRoute><AssessmentResults /></ProtectedRoute>} />
                <Route path="/budget-guide/:assessmentId" element={<ProtectedRoute><BudgetGuide /></ProtectedRoute>} />
                <Route path="/resources" element={<ProtectedRoute><Resources /></ProtectedRoute>} />
                <Route path="/certificate" element={<ProtectedRoute><PackageGate feature="certificates"><Certificate /></PackageGate></ProtectedRoute>} />
                <Route path="/action-plan" element={<ProtectedRoute><PackageGate feature="training"><ActionPlan /></PackageGate></ProtectedRoute>} />
                <Route path="/package/starter" element={<PackageStarter />} />
                <Route path="/package/professional" element={<PackageProfessional />} />
                <Route path="/package/enterprise" element={<PackageEnterprise />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/facilitator" element={<ProtectedRoute requiredRole="facilitator"><Facilitator /></ProtectedRoute>} />
                <Route path="/employer" element={<ProtectedRoute requiredUserRole={['employer', 'admin']}><EmployerDashboard /></ProtectedRoute>} />
                <Route path="/risk-register" element={<ProtectedRoute requiredUserRole={['employer', 'admin']}><PackageGate feature="compliance"><RiskRegister /></PackageGate></ProtectedRoute>} />
                <Route path="/compliance" element={<ProtectedRoute requiredUserRole={['employer', 'admin']}><PackageGate feature="compliance"><Compliance /></PackageGate></ProtectedRoute>} />
                <Route path="/integrations" element={<ProtectedRoute requiredUserRole={['employer', 'admin']}><PackageGate feature="compliance"><Integrations /></PackageGate></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                {/* Public speak-up pages: no sign-in, reporters may be anonymous */}
                <Route path="/speak-up/status" element={<SpeakUp mode="follow" />} />
                <Route path="/speak-up/:token" element={<SpeakUp mode="report" />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
