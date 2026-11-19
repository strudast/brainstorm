import { useEffect, useState } from 'react';

/** Animates a number from 0 to `target` (ease-out), for the reveal moment. */
export function useCountUp(target: number, duration = 800, delay = 0) {
  const reduceMotion = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (reduceMotion) return;
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setValue(target * (1 - (1 - t) ** 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay, reduceMotion]);
  return reduceMotion ? target : value;
}
