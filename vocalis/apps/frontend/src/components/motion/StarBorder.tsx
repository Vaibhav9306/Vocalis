import React from 'react';

interface StarBorderProps {
  children: React.ReactNode;
  as?: React.ElementType;
  className?: string;
  style?: React.CSSProperties;
  color?: string;
  speed?: string;
  onClick?: () => void;
}

export const StarBorder: React.FC<StarBorderProps> = ({
  children,
  as: Component = 'div',
  className = '',
  style,
  color = 'var(--color-accent)',
  speed = '4s',
  onClick,
}) => {
  return (
    <Component
      className={`star-border-container ${className}`}
      onClick={onClick}
      style={
        {
          '--star-color': color,
          '--star-speed': speed,
          ...style,
        } as React.CSSProperties
      }
    >
      <div className="star-border-orbit" />
      <div className="star-border-inner">{children}</div>
    </Component>
  );
};
