import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
}

/** Counts up (or down) smoothly from its previous value to `value`. */
export function AnimatedNumber({ value, duration = 0.7 }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return;
    const controls = animate(from, to, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    prevRef.current = to;
    return () => controls.stop();
  }, [value, duration]);

  return <>{display}</>;
}
