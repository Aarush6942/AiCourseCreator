import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Volume2, VolumeX, Square, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

// ── Voice selection helpers ───────────────────────────────────────────────────

/**
 * Score a SpeechSynthesisVoice — higher = more human-sounding.
 * Prefers neural/natural/premium voices in the user's locale.
 */
function scoreVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase();
  let score = 0;

  // Strong preference for known high-quality voices
  if (name.includes('natural'))  score += 100;
  if (name.includes('neural'))   score += 90;
  if (name.includes('premium'))  score += 80;
  if (name.includes('enhanced')) score += 70;
  if (name.includes('google'))   score += 60;  // Chrome neural voices
  // Good macOS/iOS voices
  if (name === 'samantha')       score += 55;
  if (name === 'alex')           score += 40;
  if (name.includes('siri'))     score += 50;
  // Microsoft voices (Edge)
  if (name.includes('microsoft') && name.includes('online')) score += 85;
  if (name.includes('microsoft'))                            score += 50;

  // Prefer voices matching the page language
  const lang = (navigator.language || 'en').toLowerCase().slice(0, 2);
  if (v.lang.toLowerCase().startsWith(lang)) score += 30;
  if (v.lang.toLowerCase().startsWith('en')) score += 20;

  // Prefer remote (usually higher quality) over local
  if (!v.localService) score += 15;

  return score;
}

function useBestVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const load = () => {
      const all = window.speechSynthesis.getVoices();
      if (all.length === 0) return;
      // Sort best-first, deduplicate by name
      const seen = new Set<string>();
      const sorted = [...all]
        .sort((a, b) => scoreVoice(b) - scoreVoice(a))
        .filter(v => {
          if (seen.has(v.name)) return false;
          seen.add(v.name);
          return true;
        });
      setVoices(sorted);
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  return voices;
}

interface SelectionPopoverProps {
  articleRef: React.RefObject<HTMLElement | null>;
}

interface PopoverPos {
  x: number;
  y: number;
  text: string;
}

// ── Speaking status bar ──────────────────────────────────────────────────────

function SpeakingBar({
  text,
  onStop,
  isPaused,
  onTogglePause,
  voices,
  selectedVoice,
  onVoiceChange,
}: {
  text: string;
  onStop: () => void;
  isPaused: boolean;
  onTogglePause: () => void;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  onVoiceChange: (v: SpeechSynthesisVoice) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showVoices, setShowVoices] = useState(false);

  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: 'spring', damping: 22, stiffness: 300 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[min(520px,calc(100vw-3rem))] bg-card border shadow-2xl rounded-2xl overflow-hidden"
    >
      {/* Waveform row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex items-end gap-[3px] h-6 flex-shrink-0">
          {[1, 2, 3, 4, 5].map((i) => (
            <motion.div
              key={i}
              className="w-1 rounded-full bg-primary"
              animate={
                isPaused
                  ? { height: 8 }
                  : { height: [8, 20, 6, 18, 10, 22, 8][i % 7] }
              }
              transition={
                isPaused
                  ? { duration: 0.2 }
                  : {
                      duration: 0.5 + i * 0.07,
                      repeat: Infinity,
                      repeatType: 'mirror',
                      ease: 'easeInOut',
                    }
              }
            />
          ))}
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground">
            {isPaused ? 'Paused' : 'Reading aloud…'}
          </span>
          {selectedVoice && (
            <span className="ml-2 text-xs text-muted-foreground truncate">
              {selectedVoice.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onTogglePause}
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? (
              <Volume2 className="w-4 h-4 text-primary" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:text-destructive"
            onClick={onStop}
            title="Stop"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-8 w-8 ${showVoices ? 'text-primary' : ''}`}
            onClick={() => { setShowVoices(v => !v); setExpanded(false); }}
            title="Change voice"
          >
            <Settings2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => { setExpanded(e => !e); setShowVoices(false); }}
            title={expanded ? 'Hide text' : 'Show text'}
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Voice picker */}
      <AnimatePresence>
        {showVoices && voices.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t"
          >
            <div className="px-3 py-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-1.5">
                Voice
              </p>
              <div className="max-h-44 overflow-y-auto space-y-0.5">
                {voices.map((v) => (
                  <button
                    key={v.name}
                    onClick={() => { onVoiceChange(v); setShowVoices(false); }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center justify-between gap-2 ${
                      selectedVoice?.name === v.name
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <span className="truncate">{v.name}</span>
                    <span className={`text-xs flex-shrink-0 ${selectedVoice?.name === v.name ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {v.lang}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expandable text preview */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="px-4 pb-3 text-xs text-muted-foreground leading-relaxed line-clamp-4 border-t pt-2">
              {text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TextToSpeech({ articleRef }: SelectionPopoverProps) {
  const [popover, setPopover] = useState<PopoverPos | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [speakingText, setSpeakingText] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const voices = useBestVoices();
  // Auto-select the top-scored voice once loaded; user can override
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (voices.length > 0 && !selectedVoice) setSelectedVoice(voices[0]);
  }, [voices, selectedVoice]);

  // ── Speech helpers ──────────────────────────────────────────────────────

  const stopSpeech = useCallback(() => {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setIsPaused(false);
    setSpeakingText('');
  }, []);

  const speak = useCallback(
    (text: string) => {
      stopSpeech();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.92;   // slightly slower = clearer
      utter.pitch = 1.0;
      utter.volume = 1.0;
      if (selectedVoice) utter.voice = selectedVoice;
      utter.onend = () => {
        setSpeaking(false);
        setIsPaused(false);
        setSpeakingText('');
      };
      utter.onerror = () => {
        setSpeaking(false);
        setIsPaused(false);
      };
      utteranceRef.current = utter;
      window.speechSynthesis.speak(utter);
      setSpeaking(true);
      setSpeakingText(text);
      setIsPaused(false);
    },
    [stopSpeech, selectedVoice]
  );

  // Re-speak with new voice when user changes it mid-playback
  const handleVoiceChange = useCallback(
    (v: SpeechSynthesisVoice) => {
      setSelectedVoice(v);
      if (speaking && speakingText) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(speakingText);
        utter.rate = 0.92;
        utter.pitch = 1.0;
        utter.voice = v;
        utter.onend = () => { setSpeaking(false); setIsPaused(false); setSpeakingText(''); };
        utter.onerror = () => { setSpeaking(false); setIsPaused(false); };
        utteranceRef.current = utter;
        window.speechSynthesis.speak(utter);
        setIsPaused(false);
      }
    },
    [speaking, speakingText]
  );

  const togglePause = useCallback(() => {
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, [isPaused]);

  // Stop on unmount or day change
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // ── Selection detection ─────────────────────────────────────────────────

  useEffect(() => {
    const handleMouseUp = () => {
      // Small delay so selection is finalised
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) {
          setPopover(null);
          return;
        }
        const text = sel.toString().trim();
        if (!text || text.length < 2) {
          setPopover(null);
          return;
        }

        // Only trigger inside the article
        const article = articleRef.current;
        if (!article) return;
        const range = sel.getRangeAt(0);
        if (!article.contains(range.commonAncestorContainer)) {
          setPopover(null);
          return;
        }

        const rect = range.getBoundingClientRect();
        setPopover({
          // Centre above the selection
          x: rect.left + rect.width / 2,
          y: rect.top + window.scrollY - 8,
          text,
        });
      }, 50);
    };

    const handleSelectionChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setPopover(null);
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp);
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [articleRef]);

  // Dismiss popover on outside click
  useEffect(() => {
    const hide = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('[data-tts-popover]')) setPopover(null);
    };
    document.addEventListener('mousedown', hide);
    return () => document.removeEventListener('mousedown', hide);
  }, []);

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  if (!supported) return null;

  return (
    <>
      {/* Selection popover */}
      <AnimatePresence>
        {popover && (
          <motion.div
            data-tts-popover
            key="popover"
            initial={{ opacity: 0, scale: 0.85, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 6 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              left: popover.x,
              top: popover.y,
              transform: 'translate(-50%, -100%)',
              zIndex: 60,
            }}
          >
            <button
              onClick={() => {
                speak(popover.text);
                setPopover(null);
                window.getSelection()?.removeAllRanges();
              }}
              className="flex items-center gap-1.5 bg-foreground text-background text-xs font-semibold px-3 py-1.5 rounded-full shadow-xl hover:bg-primary hover:text-primary-foreground transition-colors whitespace-nowrap"
            >
              <Volume2 className="w-3.5 h-3.5" />
              Read aloud
            </button>
            {/* Caret */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-foreground" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Speaking status bar */}
      <AnimatePresence>
        {speaking && (
          <SpeakingBar
            key="bar"
            text={speakingText}
            onStop={stopSpeech}
            isPaused={isPaused}
            onTogglePause={togglePause}
            voices={voices}
            selectedVoice={selectedVoice}
            onVoiceChange={handleVoiceChange}
          />
        )}
      </AnimatePresence>
    </>
  );
}
