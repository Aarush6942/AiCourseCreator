import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Redirect, Router as WouterRouter } from 'wouter';

import Home from '@/pages/Home';
import PlanDetail from '@/pages/PlanDetail';
import Login from '@/pages/Login'; 

const queryClient = new QueryClient();

// 🔐 Route Guard: If they aren't logged in, send them to /login
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuth = localStorage.getItem('isAuthenticated') === 'true';
  return isAuth ? <>{children}</> : <Redirect to="/login" />;
}

function Router() {
  return (
    <Switch>
      {/* Public Route */}
      <Route path="/" component={Login} />

      {/* Protected App Routes */}
      <Route path="/home">
        <PrivateRoute>
          <Home />
        </PrivateRoute>
      </Route>
      
      <Route path="/plans/:id">
        {(params) => (
          <PrivateRoute>
            <PlanDetail id={params.id} />
          </PrivateRoute>
        )}
      </Route>

      <Route path="/plans/:id/day/:day">
        {(params) => (
          <PrivateRoute>
            <PlanDetail id={params.id} day={params.day} />
          </PrivateRoute>
        )}
      </Route>

      {/* Fallback 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;