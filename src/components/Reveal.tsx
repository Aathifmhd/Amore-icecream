import React, { useEffect, useRef, useState } from 'react';

/**
 * Wraps content that fades and rises into view the first time it scrolls on screen.
 * `delay` (ms) staggers items in a row.
 */
export const Reveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'footer';
}> = ({ children, delay = 0, className = '', as = 'div' }) => {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return React.createElement(
    as,
    {
      ref,
      className: `reveal ${visible ? 'is-visible' : ''} ${className}`,
      style: { '--reveal-delay': `${delay}ms` } as React.CSSProperties,
    },
    children
  );
};
