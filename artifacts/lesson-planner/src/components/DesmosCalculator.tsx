import React, { useEffect, useRef, useState } from 'react';
import { Calculator, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Desmos: any;
  }
}

const DESMOS_SCRIPT = 'https://www.desmos.com/api/v1.8/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fac6';

export function DesmosCalculator() {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const calcRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instanceRef = useRef<any>(null);

  // Load Desmos script once
  useEffect(() => {
    if (window.Desmos) { setLoaded(true); return; }
    if (document.querySelector('script[data-desmos]')) return;

    const script = document.createElement('script');
    script.src = DESMOS_SCRIPT;
    script.setAttribute('data-desmos', '1');
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Init or destroy calculator when panel opens/closes
  useEffect(() => {
    if (open && loaded && calcRef.current) {
      if (!instanceRef.current) {
        instanceRef.current = window.Desmos.GraphingCalculator(calcRef.current, {
          keypad: true,
          expressions: true,
          settingsMenu: false,
          zoomButtons: true,
          border: false,
        });
      }
    }
    if (!open && instanceRef.current) {
      // keep instance alive so state is preserved when reopened
    }
  }, [open, loaded]);

  return (
    <>
      {/* Floating toggle button */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, type: 'spring' }}
        className="fixed bottom-6 right-6 z-40"
      >
        <Button
          onClick={() => setOpen(o => !o)}
          size="lg"
          variant={open ? 'default' : 'outline'}
          className="rounded-full w-14 h-14 shadow-xl border-2 p-0"
          title="Desmos Graphing Calculator"
        >
          {open ? <X className="w-5 h-5" /> : <Calculator className="w-6 h-6" />}
        </Button>
      </motion.div>

      {/* Calculator panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-6 z-40 w-[min(520px,calc(100vw-3rem))] rounded-2xl shadow-2xl border bg-card overflow-hidden flex flex-col"
            style={{ height: 'min(480px, 60vh)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30 flex-shrink-0">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Calculator className="w-4 h-4 text-primary" />
                Desmos Graphing Calculator
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-2">Powered by Desmos</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Calculator mount point */}
            <div className="flex-1 relative">
              {!loaded && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm gap-2">
                  <span className="animate-spin">⏳</span> Loading calculator…
                </div>
              )}
              <div
                ref={calcRef}
                className="w-full h-full"
                style={{ visibility: loaded ? 'visible' : 'hidden' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
