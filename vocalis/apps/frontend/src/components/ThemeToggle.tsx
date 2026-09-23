import React from 'react';
import { ThemeToggleButton } from './ui/skiper-ui/skiper26';

export const ThemeToggle: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className,
  style,
}) => {
  return (
    <ThemeToggleButton
      variant="circle"
      start="center"
      className={className}
      style={{
        width: '34px',
        height: '34px',
        padding: '5px',
        ...style,
      }}
    />
  );
};

export default ThemeToggle;
