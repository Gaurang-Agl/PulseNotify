import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  onClick,
  hoverEffect = false,
}) => {
  return (
    <div
      onClick={onClick}
      className={twMerge(
        clsx(
          'bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-xl p-5 shadow-sm',
          hoverEffect &&
            'transition-all duration-200 hover:border-slate-700 hover:bg-slate-900/80 hover:shadow-md cursor-pointer',
          className
        )
      )}
    >
      {children}
    </div>
  );
};
