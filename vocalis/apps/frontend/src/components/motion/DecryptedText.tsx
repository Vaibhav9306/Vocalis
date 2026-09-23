import React, { useState, useEffect, useRef } from 'react';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  characters?: string;
  className?: string;
  style?: React.CSSProperties;
  triggerOnHover?: boolean;
  animateOnMount?: boolean;
}

export const DecryptedText: React.FC<DecryptedTextProps> = ({
  text,
  speed = 40,
  maxIterations = 10,
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=~',
  className = '',
  style,
  triggerOnHover = true,
  animateOnMount = true,
}) => {
  const [displayText, setDisplayText] = useState<string>(text);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const iterationRef = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);

  const startDecryption = () => {
    iterationRef.current = 0;
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = window.setInterval(() => {
      setDisplayText(() => {
        return text
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (index < iterationRef.current) {
              return text[index];
            }
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join('');
      });

      if (iterationRef.current >= text.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setDisplayText(text);
      }

      iterationRef.current += 1 / (maxIterations / text.length);
    }, speed);
  };

  useEffect(() => {
    if (animateOnMount) {
      startDecryption();
    } else {
      setDisplayText(text);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [text, animateOnMount]);

  const handleMouseEnter = () => {
    if (triggerOnHover && !isHovered) {
      setIsHovered(true);
      startDecryption();
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <span
      className={`decrypted-text ${className}`}
      style={{
        display: 'inline-block',
        fontVariantNumeric: 'tabular-nums',
        cursor: triggerOnHover ? 'pointer' : 'inherit',
        ...style,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {displayText}
    </span>
  );
};
