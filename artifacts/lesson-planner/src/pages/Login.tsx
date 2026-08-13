import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Lock, UserPlus } from 'lucide-react';

export default function Login() {
  const [, setLocation] = useLocation();
  
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Helper function to automatically generate a clean, random secret tracking code
  const generateSecretCode = () => {
    const randomHex = Math.random().toString(16).substring(2, 10).toUpperCase();
    return `TRACKER-${randomHex}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (loading) return;
    setLoading(true);

    const apiBase = import.meta.env.VITE_API_URL || 'https://aicoursecreator-z7jo.onrender.com';
    
    // Determine the route based on current mode
    const targetEndpoint = isSignUpMode ? '/api/signup' : '/api/login';
    
    // Automatically generate the secret code on the fly if registering
    const payload = isSignUpMode 
      ? { username, password, secretCode: generateSecretCode() } 
      : { username, password };

    try {
      const response = await fetch(`${apiBase}${targetEndpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // Handle cases where the server sends back an HTML page instead of JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned an unexpected response. Please try again later.');
      }

      const data = await response.json();

      if (!response.ok) {
        if (data.action === 'redirect_to_signup') {
          setIsSignUpMode(true);
          setError('Account not found. We have switched you to the Sign Up screen to create your profile!');
          setLoading(false);
          return;
        }
        throw new Error(data.error || 'Authentication failed');
      }

      // --- Success Handling for Both Paths ---
      
      // Save authentication metadata to browser memory
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('username', data.user.username);
      localStorage.setItem('secretCode', data.user.secretCode);
      
      // Push the user straight through to their dashboard
      setLocation('/home');

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
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

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