import React from 'react';

interface ShinyTextProps {
  children?: React.ReactNode;
  text?: string;
  speed?: number | string;
  color?: string;
  shineColor?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const ShinyText: React.FC<ShinyTextProps> = ({
  children,
  text,
  speed = 3.5,
  color = '#ffffff',
  shineColor = '#ffffff',
  className = '',
  style,
}) => {
  const durationStr = typeof speed === 'number' ? `${speed}s` : speed;
  const content = text || children;

  return (
    <span
      className={`shiny-text-element ${className}`}
      style={
        {
          backgroundImage: `linear-gradient(120deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          display: 'inline-flex',
          alignItems: 'center',
          animation: `shinySweep ${durationStr} linear infinite`,
          fontWeight: 'inherit',
          ...style,
        } as React.CSSProperties
      }
    >
      {content}
    </span>
  );
};
