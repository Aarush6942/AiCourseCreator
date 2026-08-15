import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'wouter';
import { 
  useListLessonPlans, 
  useCreateLessonPlan, 
  useDeleteLessonPlan,
  getListLessonPlansQueryKey 
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { BookOpen, Sparkles, Trash2, ArrowRight, CheckCircle2, Loader2, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
} from "@/components/ui/alert-dialog";
import { Skeleton } from '@/components/ui/skeleton';

type LearningDepth = 'quick' | 'standard' | 'deep';

const GENERATION_STEPS = [
  { label: 'Building course outline…', pct: 5 },
  { label: 'Writing Day 1 lesson…',    pct: 14 },
  { label: 'Writing Day 2 lesson…',    pct: 23 },
  { label: 'Writing Day 3 lesson…',    pct: 32 },
  { label: 'Writing Day 4 lesson…',    pct: 41 },
  { label: 'Writing Day 5 lesson…',    pct: 50 },
  { label: 'Writing Day 6 lesson…',    pct: 59 },
  { label: 'Writing Day 7 lesson…',    pct: 68 },
  { label: 'Writing Day 8 lesson…',    pct: 77 },
  { label: 'Writing Day 9 lesson…',    pct: 86 },
  { label: 'Writing Day 10 lesson…',   pct: 93 },
  { label: 'Saving your plan…',        pct: 97 },
];

function GenerationProgress({ topic, onCancel }: { topic: string; onCancel: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setStepIndex(i => Math.min(i + 1, GENERATION_STEPS.length - 1));
      setElapsedSec(s => s + 12);
    }, 12_000);
    const secTick = setInterval(() => setElapsedSec(s => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearInterval(secTick);
    };
  }, []);

  const step = GENERATION_STEPS[stepIndex];
  const mins = Math.floor(elapsedSec / 60);
  const secs = elapsedSec % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="max-w-2xl mx-auto bg-card border-2 border-primary/20 rounded-2xl p-8 shadow-xl shadow-primary/5"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-full bg-primary/10 text-primary animate-pulse">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Generating your plan</p>
          <p className="text-sm text-muted-foreground truncate max-w-xs" title={topic}>"{topic}"</p>
        </div>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{timeStr}</span>
      </div>

      <div className="relative h-2.5 bg-muted rounded-full overflow-hidden mb-4">
        <motion.div
          className="absolute inset-y-0 left-0 bg-primary rounded-full"
          animate={{ width: `${step.pct}%` }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        />
      </div>

      <div className="space-y-2 mt-5">
        {GENERATION_STEPS.slice(0, Math.min(stepIndex + 3, GENERATION_STEPS.length)).map((s, i) => {
          const done = i < stepIndex;
          const active = i === stepIndex;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-center gap-2.5 text-sm ${done ? 'text-muted-foreground' : active ? 'text-foreground font-medium' : 'text-muted-foreground/50'}`}
            >
              {done ? (
                <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
              ) : active ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
              )}
              {s.label}
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-6 pt-4 border-t">
        <p className="text-xs text-muted-foreground">
          This takes 1–3 minutes depending on depth.
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onCancel}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          Cancel Generation
        </Button>
      </div>
    </motion.div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState<LearningDepth>('standard');
  const [dayCount, setDayCount] = useState<1 | 10>(10);
  const [generatingTopic, setGeneratingTopic] = useState('');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('Explorer');
  
  const secretCode = typeof window !== 'undefined' ? localStorage.getItem('secretCode') || '' : '';
  const { data: allPlans, isLoading } = useListLessonPlans();

  // Filter on the client side, excluding nulls and non-matching codes
  const plans = allPlans?.filter((plan: any) => {
  const planCode = plan.secret_code || plan.secretCode;
  return planCode && planCode === secretCode;
  });
  const createPlan = useCreateLessonPlan();
  const deletePlan = useDeleteLessonPlan();
  
  useEffect(() => {
    const savedUsername = localStorage.getItem('username');
    if (savedUsername) {
      setDisplayName(savedUsername);
    }
  }, []);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setGeneratingTopic(topic);
    setGenerationError(null);

    const secretCode = localStorage.getItem('secretCode');
    if (!secretCode) {
      setGeneratingTopic('');
      setGenerationError('Please sign in again before generating a lesson plan.');
      return;
    }

    createPlan.mutate(
      { data: { topic, depth, dayCount, secretCode } },
      {
        onSuccess: (newPlan) => {
          queryClient.invalidateQueries({ queryKey: getListLessonPlansQueryKey() });
          setLocation(`/plans/${newPlan.id}`);
        },
        onError: (error) => {
          setGeneratingTopic('');
          setGenerationError(
            error instanceof Error
              ? `Could not generate the lesson plan: ${error.message}`
              : 'Could not generate the lesson plan. Please try again.',
          );
        },
      }
    );
  };

  const handleCancelGeneration = () => {
    createPlan.reset();
    setGeneratingTopic('');
    setGenerationError('Generation was cancelled.');
  };

  const handleDelete = (id: number) => {
    deletePlan.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLessonPlansQueryKey() });
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-16">
        
        {/* Header Area */}
        <header className="mb-16 text-center space-y-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-2 border border-primary/20 shadow-sm"
          >
            <User className="w-4 h-4" />
            <span>Hi, <b className="capitalize font-semibold">{displayName}</b> 👋</span>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center p-3 bg-primary/5 rounded-full mx-auto text-primary w-fit"
          >
            <BookOpen className="w-8 h-8" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-serif font-bold text-foreground"
          >
            AI Lesson Planner
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
          >
            Your personal study companion. Enter any topic and we'll craft a beautiful, 10-day structured curriculum just for you.
          </motion.p>
        </header>

        {/* Generator Input / Progress */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="max-w-2xl mx-auto mb-20"
        >
          <AnimatePresence mode="wait">
            {createPlan.isPending ? (
              <GenerationProgress 
                key="progress" 
                topic={generatingTopic} 
                onCancel={handleCancelGeneration} 
              />
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleGenerate}
                className="relative shadow-xl shadow-primary/5 rounded-2xl p-2"
              >
                <div className="flex items-center bg-card border-2 border-primary/20 rounded-full p-2 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 transition-all">
                  <div className="pl-4 pr-2 text-primary/50">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <input
                    type="text"
                    placeholder="What do you want to learn? e.g. Quantum Physics, French Revolution..."
                    className="flex-1 bg-transparent border-none outline-none focus:ring-0 text-lg py-3 px-2 text-foreground placeholder:text-muted-foreground/70 font-medium"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    data-testid="input-topic"
                  />
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="rounded-full px-8 text-base font-medium h-12"
                    disabled={!topic.trim()}
                    data-testid="button-generate"
                  >
                    <span className="flex items-center gap-2">
                      Generate <ArrowRight className="w-5 h-5" />
                    </span>
                  </Button>
                </div>
                <label className="flex items-center justify-between gap-3 px-4 pt-3 pb-1 text-sm text-muted-foreground">
                  <span>Lesson depth</span>
                  <select
                    value={depth}
                    onChange={(e) => setDepth(e.target.value as LearningDepth)}
                    className="bg-transparent font-medium text-foreground outline-none"
                    data-testid="select-lesson-depth"
                  >
                    <option value="quick">Quick overview</option>
                    <option value="standard">Average session</option>
                    <option value="deep">Deep dive</option>
                  </select>
                </label>
                <label className="flex items-center justify-between gap-3 px-4 pt-2 pb-1 text-sm text-muted-foreground">
                  <span>Course length</span>
                  <select
                    value={dayCount}
                    onChange={(e) => setDayCount(Number(e.target.value) as 1 | 10)}
                    className="bg-transparent font-medium text-foreground outline-none"
                    data-testid="select-course-length"
                  >
                    <option value={10}>10 days</option>
                    <option value={1}>1 day — quick test</option>
                  </select>
                </label>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>

        {generationError && (
          <p role="alert" className="mt-4 text-center text-sm text-destructive">
            {generationError}
          </p>
        )}

        {/* Saved Plans */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-2xl font-serif font-semibold text-foreground">Your Learning Journeys</h2>
            {plans && plans.length > 0 && (
              <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded-full">
                {plans.length} {plans.length === 1 ? 'Plan' : 'Plans'}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-[200px] w-full rounded-xl" />
              ))}
            </div>
          ) : plans && plans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {plans.map((plan) => (
                  <motion.div
                    key={plan.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                    whileHover={{ y: -4 }}
                  >
                    <Card className="h-full flex flex-col overflow-hidden hover:shadow-lg transition-all duration-300 border-primary/10 hover:border-primary/30">
                      <CardHeader className="flex-1 pb-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                            {plan.dayCount} Days
                          </div>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8 -mt-1 -mr-1" data-testid={`button-delete-${plan.id}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this lesson plan?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the 10-day plan for "{plan.topic}" and all its contents. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(plan.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>

                        </div>
                        <CardTitle className="text-xl font-serif leading-tight line-clamp-2" title={plan.topic}>
                          {plan.topic}
                        </CardTitle>
                        <CardDescription className="text-sm mt-2 flex items-center text-muted-foreground/80">
                          Created {format(new Date(plan.createdAt), 'MMM d, yyyy')}
                        </CardDescription>
                      </CardHeader>
                      <CardFooter className="pt-0 border-t bg-muted/20 mt-auto p-4">
                        <Button asChild variant="ghost" className="w-full justify-between font-medium group hover:bg-primary/5 hover:text-primary">
                          <Link href={`/plans/${plan.id}`}>
                            Continue Learning
                            <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                          </Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 px-4 border-2 border-dashed border-muted rounded-2xl bg-muted/5"
            >
              <div className="inline-flex items-center justify-center p-4 bg-muted rounded-full mb-4">
                <BookOpen className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-serif font-medium text-foreground mb-2">No plans yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Your library is empty. Enter a topic above to generate your first 10-day lesson plan and start learning.
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}