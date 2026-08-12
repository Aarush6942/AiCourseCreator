import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Lock, UserPlus } from 'lucide-react';

export default function Login() {
  const [, setLocation] = useLocation();
  
  // State to manage toggle between 'login' and 'signup' modes
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  
  // Form input fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secretCode, setSecretCode] = useState('');
  
  // Status states
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const apiBase = import.meta.env.VITE_API_URL || 'https://aicoursecreator-z7jo.onrender.com';
    
    // Determine the route based on current mode
    const targetEndpoint = isSignUpMode ? '/api/signup' : '/api/login';
    const payload = isSignUpMode 
      ? { username, password, secretCode } 
      : { username, password };

    try {
      const response = await fetch(`${apiBase}${targetEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        // 🚀 CRITICAL CHECK: If backend tells us the user wasn't found, flip them automatically to Sign Up mode
        if (data.action === 'redirect_to_signup') {
          setIsSignUpMode(true);
          setError('Account not found. We have switched you to the Sign Up screen to create your profile!');
          setLoading(false);
          return;
        }
        throw new Error(data.error || 'Authentication failed');
      }

      // If they just successfully signed up, let's automatically log them in
      if (isSignUpMode) {
        setIsSignUpMode(false);
        setError('Account created successfully! Please enter your password to log in.');
        setSecretCode('');
        setLoading(false);
        return;
      }

      // Save credentials locally for session tracking
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('secretCode', data.user.secretCode);
      
      // Redirect to dashboard home page
      setLocation('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-primary/20 shadow-xl shadow-primary/5 transition-all duration-300">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto p-3 bg-primary/5 rounded-full text-primary w-fit">
            {isSignUpMode ? <UserPlus className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
          </div>
          <CardTitle className="text-3xl font-serif font-bold">
            {isSignUpMode ? 'Create Account' : 'Welcome Back'}
          </CardTitle>
          <CardDescription>
            {isSignUpMode 
              ? 'Register your profile to secure your custom lessons.' 
              : 'Sign in to manage your AI Lesson Planner'}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Username</label>
              <Input 
                type="text" 
                placeholder="e.g. admin" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Password</label>
              <Input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* 🔑 Dynamic Field: Only visible during Sign Up mode */}
            {isSignUpMode && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="text-sm font-medium text-muted-foreground">Your Secret Tracker Code</label>
                <Input 
                  type="text" 
                  placeholder="e.g. TEACHER-MATH-2026" 
                  value={secretCode} 
                  onChange={(e) => setSecretCode(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  This custom code links specific generated lesson plans to your dashboard account.
                </p>
              </div>
            )}

            {error && (
              <p className={`text-sm font-medium p-2 rounded ${
                error.includes('switched') || error.includes('created')
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'text-destructive'
              }`}>
                {error}
              </p>
            )}

            <Button type="submit" className="w-full h-11 mt-2" disabled={loading}>
              {loading 
                ? (isSignUpMode ? 'Registering...' : 'Signing in...') 
                : (isSignUpMode ? 'Register Account' : 'Sign In')}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center border-t border-border/50 pt-4">
          <button
            type="button"
            onClick={() => {
              setIsSignUpMode(!isSignUpMode);
              setError('');
            }}
            className="text-sm text-primary hover:underline font-medium">
            {isSignUpMode 
              ? 'Already have an account? Sign In' 
              : "Don't have an account yet? Create one"}
          </button>
        </CardFooter>
      </Card>
    </div>
  );
}