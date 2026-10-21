import React from 'react';
import { LOGO_RED, LOGO_VIEWBOX, LOGO_WORDMARK_PATH } from './amoreLogoData';

interface AmoreLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showShadow?: boolean;
}

const SIZE_CLASSES = {
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

/** The official Amore logo: white "amore" wordmark on the crimson circle. */
export const AmoreLogo: React.FC<AmoreLogoProps> = ({ size = 'md', className = '', showShadow = true }) => (
  <svg
    viewBox={`0 0 ${LOGO_VIEWBOX} ${LOGO_VIEWBOX}`}
    role="img"
    aria-label="Amore"
    className={`shrink-0 select-none rounded-full transition-transform duration-300 hover:scale-105 hover:-rotate-6 ${SIZE_CLASSES[size]} ${className}`}
    style={{ filter: showShadow ? 'drop-shadow(0 4px 10px rgba(129, 0, 30, 0.35))' : undefined }}
  >
    <circle cx={LOGO_VIEWBOX / 2} cy={LOGO_VIEWBOX / 2} r={LOGO_VIEWBOX / 2} fill={LOGO_RED} />
    <path fill="#FFFFFF" fillRule="evenodd" d={LOGO_WORDMARK_PATH} />
  </svg>
);
