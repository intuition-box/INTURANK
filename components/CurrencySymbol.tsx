import React from 'react';
import { CURRENCY_SYMBOL } from '../constants';

type Size = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

const sizeClasses: Record<Size, string> = {
  sm: 'text-sm align-middle',
  md: 'text-base align-middle font-semibold',
  lg: 'text-xl align-middle font-bold',
  xl: 'text-2xl align-middle font-bold',
  '2xl': 'text-4xl align-middle font-bold leading-none',
  '3xl': 'text-6xl align-middle font-bold leading-none',
};

/** Spacing: when symbol is after the number (default) use margin-left; when leading (before number) use margin-right. */
const spacingClasses: Record<Size, { after: string; before: string }> = {
  sm: { after: 'ml-0.5', before: 'mr-0.5' },
  md: { after: 'ml-1', before: 'mr-1' },
  lg: { after: 'ml-1.5', before: 'mr-1.5' },
  xl: { after: 'ml-2', before: 'mr-2' },
  '2xl': { after: 'ml-2', before: 'mr-2' },
  '3xl': { after: 'ml-3', before: 'mr-3' },
};

interface CurrencySymbolProps {
  size?: Size;
  /** When true, symbol is shown before the amount (e.g. ₸ 27.05). Use for currency-style display. */
  leading?: boolean;
  className?: string;
}

/** Renders the TRUST currency symbol (₸) at a readable size. Use leading for symbol-before-amount (e.g. ₸ 27.05). */
export const CurrencySymbol: React.FC<CurrencySymbolProps> = ({ size = 'md', leading = false, className = '' }) => {
  const spacing = spacingClasses[size];
  const marginClass = leading ? spacing.before : spacing.after;
  return (
    <span
      className={`inline-block ${sizeClasses[size]} ${marginClass} text-intuition-primary/90 ${className}`}
      aria-label="TRUST"
    >
      {CURRENCY_SYMBOL}
    </span>
  );
};

export default CurrencySymbol;
