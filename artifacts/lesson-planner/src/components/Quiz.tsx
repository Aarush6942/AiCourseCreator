import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, RotateCcw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { QuizQuestion } from '@workspace/api-client-react';

export function Quiz({ questions }: { questions: QuizQuestion[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);

  const question = questions[currentIndex];

  const handleSelect = (index: number) => {
    if (hasAnswered) return;
    setSelectedOption(index);
    setHasAnswered(true);
    
    if (index === question.correctAnswer) {
      setScore(s => s + 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(c => c + 1);
      setSelectedOption(null);
      setHasAnswered(false);
    } else {
      setFinished(true);
    }
  };

  const handleRetake = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setScore(0);
    setFinished(false);
    setHasAnswered(false);
  };

  if (!questions || questions.length === 0) return null;

  if (finished) {
    return (
      <Card className="border-primary/20 bg-primary/5 shadow-inner">
        <CardContent className="pt-10 pb-10 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-background shadow-md">
            <span className="text-3xl font-bold text-primary">{score}/{questions.length}</span>
          </div>
          <div>
            <h3 className="text-2xl font-serif font-bold text-foreground">Quiz Complete!</h3>
            <p className="text-muted-foreground mt-2">
              {score === questions.length ? 'Perfect score! Exceptional work.' : 
               score >= questions.length / 2 ? 'Great job! You have a solid understanding.' : 
               'Good effort! Review the lesson and try again.'}
            </p>
          </div>
          <Button onClick={handleRetake} size="lg" className="rounded-full px-8 mt-4" data-testid="button-retake">
            <RotateCcw className="w-4 h-4 mr-2" /> Retake Quiz
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-muted/30 px-6 py-4 border-b flex items-center justify-between">
        <h3 className="font-serif font-bold text-lg">Knowledge Check</h3>
        <span className="text-sm font-medium text-muted-foreground">
          Question {currentIndex + 1} of {questions.length}
        </span>
      </div>
      
      <div className="p-6 md:p-8">
        <h4 className="text-xl font-medium text-foreground mb-6 leading-relaxed">
          {question.question}
        </h4>

        <div className="space-y-3">
          {question.options.map((option, idx) => {
            const isSelected = selectedOption === idx;
            const isCorrect = idx === question.correctAnswer;
            const showCorrect = hasAnswered && isCorrect;
            const showWrong = hasAnswered && isSelected && !isCorrect;

            let buttonClass = "w-full text-left p-4 rounded-xl border-2 transition-all duration-200 relative overflow-hidden ";
            
            if (!hasAnswered) {
              buttonClass += "border-muted hover:border-primary/30 hover:bg-muted/20 active:scale-[0.98]";
            } else if (showCorrect) {
              buttonClass += "border-green-500 bg-green-500/10 text-green-900 dark:text-green-100";
            } else if (showWrong) {
              buttonClass += "border-red-500 bg-red-500/10 text-red-900 dark:text-red-100";
            } else {
              buttonClass += "border-muted/50 bg-muted/5 opacity-50";
            }

            return (
              <button
                key={idx}
                onClick={() => handleSelect(idx)}
                disabled={hasAnswered}
                className={buttonClass}
                data-testid={`quiz-option-${idx}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center
                    ${!hasAnswered ? 'border-muted-foreground/30 text-transparent' : ''}
                    ${showCorrect ? 'border-green-500 bg-green-500 text-white' : ''}
                    ${showWrong ? 'border-red-500 bg-red-500 text-white' : ''}
                    ${hasAnswered && !isSelected && !isCorrect ? 'border-muted-foreground/20 text-transparent' : ''}
                  `}>
                    {showCorrect && <CheckCircle2 className="w-4 h-4" />}
                    {showWrong && <XCircle className="w-4 h-4" />}
                  </div>
                  <span className="font-medium flex-1">{option}</span>
                </div>
              </button>
            );
          })}
        </div>

        <AnimatePresence>
          {hasAnswered && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="overflow-hidden"
            >
              <div className={`p-5 rounded-xl border ${selectedOption === question.correctAnswer ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                <p className="font-bold mb-1 text-foreground">
                  {selectedOption === question.correctAnswer ? 'Correct!' : 'Not quite.'}
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {question.explanation}
                </p>
              </div>

              <div className="mt-6 flex justify-end">
                <Button onClick={handleNext} className="rounded-full px-8" size="lg" data-testid="button-next-question">
                  {currentIndex < questions.length - 1 ? 'Next Question' : 'View Results'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}