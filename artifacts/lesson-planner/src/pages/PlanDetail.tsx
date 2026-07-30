import React, { useEffect, useState } from 'react';
import { useLocation, useParams, Link } from 'wouter';
import {
  useGetLessonPlan,
  useDeleteLessonDay,
  useDeleteLessonPlan,
  useRegenerateQuiz,
  getGetLessonPlanQueryKey,
  getListLessonPlansQueryKey,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Trash2, Menu, X, BookOpen, Clock, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { SimpleMarkdown } from '@/lib/markdown';
import { Quiz } from '@/components/Quiz';
import { DesmosCalculator } from '@/components/DesmosCalculator';
import { TextToSpeech } from '@/components/TextToSpeech';
import { TopicAssistant } from '@/components/TopicAssistant';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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

export default function PlanDetail() {
  const params = useParams<{ id: string; day?: string }>();
  const id = parseInt(params.id || '0', 10);
  const dayParam = params.day ? parseInt(params.day, 10) : null;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Tracks a quiz "generation key" so the Quiz component fully resets after regeneration
  const [quizKey, setQuizKey] = useState(0);
  const articleRef = React.useRef<HTMLElement>(null);

  const { data: plan, isLoading, error } = useGetLessonPlan(id);
  const deleteDay = useDeleteLessonDay();
  const deletePlan = useDeleteLessonPlan();
  const regenerateQuiz = useRegenerateQuiz();

  const sortedDays = plan?.days ? [...plan.days].sort((a, b) => a.dayNumber - b.dayNumber) : [];
  const activeDayNumber = dayParam || (sortedDays.length > 0 ? sortedDays[0].dayNumber : null);
  const activeDay = sortedDays.find(d => d.dayNumber === activeDayNumber);

  useEffect(() => {
    if (plan && sortedDays.length > 0 && !dayParam) {
      setLocation(`/plans/${id}/day/${sortedDays[0].dayNumber}`, { replace: true });
    }
  }, [plan, sortedDays, dayParam, id, setLocation]);

  // Reset quiz component whenever the active day changes
  useEffect(() => {
    setQuizKey(k => k + 1);
  }, [activeDayNumber]);

  const handleDeletePlan = () => {
    deletePlan.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListLessonPlansQueryKey() });
          setLocation('/');
        },
      }
    );
  };

  const handleDeleteDay = (dayNumber: number) => {
    deleteDay.mutate(
      { id, dayNumber },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLessonPlanQueryKey(id) });
          if (activeDayNumber === dayNumber) {
            const remaining = sortedDays.filter(d => d.dayNumber !== dayNumber);
            if (remaining.length > 0) {
              const nextDay = remaining.find(d => d.dayNumber > dayNumber) || remaining[remaining.length - 1];
              setLocation(`/plans/${id}/day/${nextDay.dayNumber}`);
            } else {
              setLocation(`/plans/${id}`);
            }
          }
        },
      }
    );
  };

  const handleRegenerateQuiz = () => {
    if (!activeDayNumber) return;
    regenerateQuiz.mutate(
      { id, dayNumber: activeDayNumber },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetLessonPlanQueryKey(id) });
          setQuizKey(k => k + 1);
        },
      }
    );
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [activeDayNumber]);

  if (isLoading) {
    return (
      <div className="flex h-screen bg-background">
        <div className="w-80 border-r p-4 hidden md:block">
          <Skeleton className="h-10 w-3/4 mb-8" />
          <div className="space-y-3">
            {[1,2,3,4,5,6,7,8,9,10].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        </div>
        <div className="flex-1 p-8">
          <Skeleton className="h-12 w-1/2 mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <div className="bg-destructive/10 text-destructive p-4 rounded-full mb-4">
          <X className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Plan not found</h2>
        <p className="text-muted-foreground mb-6">This lesson plan may have been deleted or doesn't exist.</p>
        <Button asChild><Link href="/">Return Home</Link></Button>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-80 bg-sidebar border-r transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 flex flex-col ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>

        <div className="p-4 border-b bg-sidebar flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
            <Link href="/" className="flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" /> Home
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-6 border-b">
          <div className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5" /> Course
          </div>
          <h2 className="text-xl font-serif font-bold text-foreground line-clamp-3 leading-tight mb-2" title={plan.topic}>
            {plan.topic}
          </h2>
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5 mr-1" />
            {sortedDays.length} Days remaining
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scroll-smooth">
          {sortedDays.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              All days completed or deleted.
            </div>
          ) : (
            sortedDays.map((day) => {
              const isActive = day.dayNumber === activeDayNumber;
              return (
                <div key={day.id} className="group flex items-center relative">
                  <Link href={`/plans/${id}/day/${day.dayNumber}`} className="flex-1">
                    <div className={`flex flex-col py-2.5 px-4 rounded-lg transition-colors ${isActive ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:bg-muted text-sidebar-foreground'}`}>
                      <span className={`text-xs font-bold uppercase tracking-wider mb-1 ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        Day {day.dayNumber}
                      </span>
                      <span className="font-medium line-clamp-2 text-sm">
                        {day.title}
                      </span>
                    </div>
                  </Link>
                  <div className={`absolute right-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`}>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className={`h-8 w-8 hover:bg-destructive hover:text-destructive-foreground ${isActive ? 'hover:bg-primary-foreground/20' : ''}`}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Day {day.dayNumber}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove "{day.title}" from your lesson plan.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteDay(day.dayNumber)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-4 border-t mt-auto">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 justify-start">
                <Trash2 className="w-4 h-4 mr-2" /> Delete Entire Plan
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete entire lesson plan?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the plan "{plan.topic}" and all its {sortedDays.length} days. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeletePlan} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete Plan
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Text-to-speech for highlighted lesson content */}
      <TextToSpeech articleRef={articleRef} />

      {/* AI Tutor assistant */}
      {activeDay && (
        <TopicAssistant
          planId={id}
          dayNumber={activeDay.dayNumber}
          topic={plan.topic}
          dayTitle={activeDay.title}
        />
      )}

      {/* Desmos floating calculator */}
      <DesmosCalculator />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="flex-shrink-0 h-16 border-b flex items-center px-4 bg-background/95 backdrop-blur z-10 sticky top-0 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="mr-2">
            <Menu className="w-5 h-5" />
          </Button>
          <span className="font-serif font-bold text-lg truncate flex-1">{plan.topic}</span>
        </header>

        <div className="flex-1 overflow-y-auto scroll-smooth">
          {activeDay ? (
            <motion.div
              key={activeDay.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="max-w-3xl mx-auto px-6 py-12 md:py-16 pb-32"
            >
              <div className="mb-12">
                <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-sm tracking-wider uppercase mb-4">
                  Day {activeDay.dayNumber}
                </div>
                <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground leading-tight text-balance">
                  {activeDay.title}
                </h1>
              </div>

              <article ref={articleRef} className="prose prose-lg prose-slate dark:prose-invert max-w-none prose-headings:font-serif prose-headings:text-primary prose-a:text-primary">
                <SimpleMarkdown content={activeDay.lessonContent} />
              </article>

              {/* Quiz section */}
              <div className="mt-20 pt-16 border-t">
                <div className="mb-8 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-serif font-bold text-foreground mb-2">Review &amp; Mastery</h2>
                    <p className="text-muted-foreground text-lg">Test your understanding of today's material before moving on.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRegenerateQuiz}
                    disabled={regenerateQuiz.isPending}
                    className="flex-shrink-0 gap-2 mt-1"
                    title="Generate a fresh set of quiz questions for this day"
                  >
                    <RefreshCw className={`w-4 h-4 ${regenerateQuiz.isPending ? 'animate-spin' : ''}`} />
                    {regenerateQuiz.isPending ? 'Generating…' : 'New Quiz'}
                  </Button>
                </div>

                <AnimatePresence mode="wait">
                  {regenerateQuiz.isPending ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="bg-card border rounded-2xl p-12 flex flex-col items-center gap-4 text-muted-foreground"
                    >
                      <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                      <p className="font-medium">Crafting fresh questions…</p>
                      <p className="text-sm text-center max-w-xs">A new set of questions is being written specifically for this lesson.</p>
                    </motion.div>
                  ) : activeDay.quiz && activeDay.quiz.length > 0 ? (
                    <motion.div
                      key="quiz"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <Quiz key={quizKey} questions={activeDay.quiz} />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
              <BookOpen className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-xl font-medium">Select a day from the sidebar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
