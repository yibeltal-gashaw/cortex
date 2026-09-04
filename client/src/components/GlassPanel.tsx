import React from 'react';

export interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  blur?: string;
  opacity?: number;
  border?: boolean;
  onClick?: () => void;
}

/**
 * Reusable Glassmorphism Panel Component
 * Utilizes the Cortex Light "Cloud Grey" base (#F7F8FA @ 70% opacity)
 * with a high-depth backdrop-blur filter.
 */
export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  className = '',
  style = {},
  blur = '16px',
  opacity = 0.70,
  border = true,
  onClick
}) => {
  const dynamicStyle: React.CSSProperties = {
    background: `rgba(247, 248, 250, ${opacity})`,
    backdropFilter: `blur(${blur})`,
    WebkitBackdropFilter: `blur(${blur})`,
    border: border ? '1px solid var(--cortex-grey-matter-border)' : 'none',
    boxShadow: 'var(--shadow-sm)',
    ...style
  };

  return (
    <div
      className={`glass-panel ${className}`}
      style={dynamicStyle}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
