import React from 'react';

interface NexoraLogoProps {
  compact?: boolean;
}

export const NexoraLogo: React.FC<NexoraLogoProps> = ({ compact = false }) => {
  return (
    <div className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <svg
        width={compact ? 26 : 30}
        height={compact ? 26 : 30}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M4 28L11.5 8H18.5L13 21.5L22.5 8H32L24.5 28H17.5L23 14.5L13.5 28H4Z"
          fill="#F97316"
        />
        <path d="M27.5 28L30.5 20H34L31 28H27.5Z" fill="#EF4444" />
      </svg>
      <span className="font-display font-bold tracking-wider text-white text-base sm:text-lg uppercase">
        Nexora Games
      </span>
    </div>
  );
};
