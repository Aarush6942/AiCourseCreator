import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { SimpleMarkdown } from '@/lib/markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TopicAssistantProps {
  planId: number;
  dayNumber: number;
  topic: string;
  dayTitle: string;
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '';

export function TopicAssistant({ planId, dayNumber, topic, dayTitle }: TopicAssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Reset conversation when day changes
  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [planId, dayNumber]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${BASE_URL}/api/lesson-plans/${planId}/days/${dayNumber}/ask`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            // send last 10 messages as history (exclude the one we just added above)
            history: messages.slice(-10),
          }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? `Server error ${res.status}`);
      }

      const data = await res.json() as { reply: string };
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, planId, dayNumber]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const suggestedQuestions = [
    `Summarise Day ${dayNumber} in simple terms`,
    'Give me an example I can relate to',
    'What should I focus on most?',
    'How does this connect to real life?',
  ];

  return (
    <>
      {/* Floating toggle button — sits to the left of the Desmos button */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.6, type: 'spring' }}
        className="fixed bottom-6 right-24 z-40"
      >
        <Button
          onClick={() => setOpen(o => !o)}
          size="lg"
          variant={open ? 'default' : 'outline'}
          className="rounded-full w-14 h-14 shadow-xl border-2 p-0"
          title="AI Tutor"
        >
          {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-6 h-6" />}
        </Button>
        {/* Unread dot when closed and there are messages */}
        {!open && messages.length > 0 && (
          <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-primary border-2 border-background" />
        )}
      </motion.div>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-24 z-40 w-[min(400px,calc(100vw-3rem))] rounded-2xl shadow-2xl border bg-card overflow-hidden flex flex-col"
            style={{ height: 'min(520px,65vh)' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30 flex-shrink-0">
              <div className="p-1.5 rounded-full bg-primary/10 text-primary">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">AI Tutor</p>
                <p className="text-xs text-muted-foreground truncate">{topic} · Day {dayNumber}: {dayTitle}</p>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => { setMessages([]); setError(null); }}
                    title="Clear conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.length === 0 && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-foreground leading-relaxed">
                      Hi! I'm your AI tutor for <strong>{topic}</strong>. Ask me anything about this lesson and I'll help you understand it.
                    </div>
                  </div>

                  {/* Suggested questions */}
                  <div className="space-y-2 pl-10">
                    <p className="text-xs text-muted-foreground font-medium">Try asking:</p>
                    {suggestedQuestions.map((q) => (
                      <button
                        key={q}
                        onClick={() => { setInput(q); inputRef.current?.focus(); }}
                        className="block w-full text-left text-xs px-3 py-2 rounded-xl border border-dashed border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/60 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>
                    {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-tr-sm'
                      : 'bg-muted text-foreground rounded-tl-sm'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm prose-slate dark:prose-invert max-w-none prose-p:my-1 prose-headings:text-sm prose-headings:font-semibold prose-li:my-0.5">
                        <SimpleMarkdown content={msg.content} />
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                </motion.div>
              ))}

              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50"
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {error && (
                <div className="text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2">
                  {error}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 px-3 pb-3 pt-2 border-t bg-background/50">
              <div className="flex items-end gap-2 bg-muted rounded-2xl px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30 transition-all">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    // Auto-grow up to 4 rows
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 96)}px`;
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything about this lesson…"
                  className="flex-1 bg-transparent border-none outline-none resize-none text-sm leading-relaxed placeholder:text-muted-foreground/60 min-h-[24px] max-h-24"
                  disabled={loading}
                />
                <Button
                  size="icon"
                  className="w-8 h-8 rounded-xl flex-shrink-0"
                  onClick={send}
                  disabled={!input.trim() || loading}
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
              <p className="text-center text-[10px] text-muted-foreground/50 mt-1.5">Enter to send · Shift+Enter for new line</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
