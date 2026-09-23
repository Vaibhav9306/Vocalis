import React, { useState, useEffect, useRef } from 'react';

interface CountUpProps {
  to?: number;
  end?: number;
  from?: number;
  duration?: number;
  separator?: string;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const CountUp: React.FC<CountUpProps> = ({
  to,
  end,
  from = 0,
  duration = 1.2,
  separator = ',',
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
  style,
}) => {
  const targetValue = to !== undefined ? to : (end !== undefined ? end : 0);
  const [currentValue, setCurrentValue] = useState<number>(from);
  const startTimeRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    let startVal = from;
    let endVal = targetValue;
    startTimeRef.current = null;

    const easeOutExpo = (x: number): number => {
      return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
    };

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = (timestamp - startTimeRef.current) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutExpo(progress);

      const val = startVal + (endVal - startVal) * easedProgress;
      setCurrentValue(val);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setCurrentValue(endVal);
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [targetValue, from, duration]);

  const formattedNumber = currentValue
    .toFixed(decimals)
    .replace(/\B(?=(\d{3})+(?!\d))/g, separator);

  return (
    <span
      className={`count-up ${className}`}
      style={{ fontVariantNumeric: 'tabular-nums', ...style }}
    >
      {prefix}
      {formattedNumber}
      {suffix}
    </span>
  );
};
