import React from 'react';

interface AmoreLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'badge' | 'text-only' | 'light';
  className?: string;
  showShadow?: boolean;
}

export const AmoreLogo: React.FC<AmoreLogoProps> = ({
  size = 'md',
  variant = 'badge',
  className = '',
  showShadow = true,
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-11 h-11',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const textSizes = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-12',
    xl: 'h-16',
  };

  // When rendered as pure text wordmark without circle badge
  if (variant === 'text-only' || variant === 'light') {
    const textColor = variant === 'light' ? '#FFFFFF' : '#8C102A';
    return (
      <div className={`inline-flex items-center select-none ${textSizes[size]} ${className}`}>
        <svg
          viewBox="28 120 264 60"
          className="h-full w-auto"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Amore Logo Wordmark"
        >
          {/* 'a' letter: clean bold single-story geometric sans */}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="
              M 78.5 127
              V 173
              H 70.5
              V 165.5
              C 67.5 171, 61.5 173.8, 55 173.8
              C 42.5 173.8, 33 163.5, 33 150
              C 33 136.5, 42.5 126.2, 55 126.2
              C 61.5 126.2, 67.5 129, 70.5 134.5
              V 127
              H 78.5
              Z
              M 70.5 150
              C 70.5 141.6, 63.8 134.8, 55.5 134.8
              C 47.2 134.8, 41.2 141.6, 41.2 150
              C 41.2 158.4, 47.2 165.2, 55.5 165.2
              C 63.8 165.2, 70.5 158.4, 70.5 150
              Z
            "
            fill={textColor}
          />

          {/* 'm' letter: The iconic wavy ribbon from Amore's official logo */}
          <path
            d="
              M 87 168.8
              C 94 168.8, 102 168, 109 152
              C 113 143, 116.5 131.2, 122 131.2
              C 127.5 131.2, 133 139, 139.5 151
              C 146 139, 151.5 131.2, 157 131.2
              C 162.5 131.2, 167 142.5, 172.5 168.8
            "
            fill="none"
            stroke={textColor}
            strokeWidth="8.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 'o' letter: bold geometric oval */}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="
              M 215 150
              C 215 163.2, 205 173.8, 192.5 173.8
              C 180 173.8, 170 163.2, 170 150
              C 170 136.8, 180 126.2, 192.5 126.2
              C 205 126.2, 215 136.8, 215 150
              Z
              M 206.8 150
              C 206.8 141.6, 200.5 134.8, 192.5 134.8
              C 184.5 134.8, 178.2 141.6, 178.2 150
              C 178.2 158.4, 184.5 165.2, 192.5 165.2
              C 200.5 165.2, 206.8 158.4, 206.8 150
              Z
            "
            fill={textColor}
          />

          {/* 'r' letter: vertical stem + top arch */}
          <path
            d="
              M 221 127
              H 229.2
              V 135
              C 232 129.5, 237.2 126.5, 243 126.5
              C 245 126.5, 246.5 126.8, 247.5 127.2
              V 135.5
              C 246 135, 244.2 134.6, 242.5 134.6
              C 235.8 134.6, 229.2 139.8, 229.2 147.5
              V 173
              H 221
              Z
            "
            fill={textColor}
          />

          {/* 'e' letter: matching geometric sans with crossbar */}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="
              M 281.5 155.5
              H 256.2
              C 257 162.5, 262.2 166.2, 268.5 166.2
              C 273 166.2, 276.8 163.8, 279.2 160.2
              L 285.5 164.2
              C 281.8 170.2, 275.8 173.8, 268 173.8
              C 255.5 173.8, 247.5 163.5, 247.5 150
              C 247.5 136.5, 255.8 126.2, 268 126.2
              C 280 126.2, 287.5 136.5, 287.5 150
              C 287.5 152.2, 287.3 154.2, 287 155.5
              Z
              M 256.2 148.5
              H 279
              C 278.2 141.5, 273.8 134.8, 267.8 134.8
              C 261.8 134.8, 257 141.5, 256.2 148.5
              Z
            "
            fill={textColor}
          />
        </svg>
      </div>
    );
  }

  // Official Circular Badge Logo (matching exact uploaded logo sticker)
  return (
    <div
      className={`relative rounded-full flex items-center justify-center select-none transition-transform duration-200 hover:scale-105 shrink-0 ${sizeClasses[size]} ${className}`}
      style={{
        boxShadow: showShadow ? '0 4px 16px -2px rgba(140, 16, 42, 0.35)' : 'none',
      }}
    >
      <svg
        viewBox="0 0 300 300"
        className="w-full h-full drop-shadow-sm"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Amore Official Logo"
      >
        {/* Background Deep Crimson Circle: #8C102A */}
        <circle cx="150" cy="150" r="144" fill="#8C102A" />

        {/* Wordmark centered inside badge circle */}
        <g transform="translate(-10.25, 0)">
          {/* 'a' letter: clean bold single-story geometric sans */}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="
              M 78.5 127
              V 173
              H 70.5
              V 165.5
              C 67.5 171, 61.5 173.8, 55 173.8
              C 42.5 173.8, 33 163.5, 33 150
              C 33 136.5, 42.5 126.2, 55 126.2
              C 61.5 126.2, 67.5 129, 70.5 134.5
              V 127
              H 78.5
              Z
              M 70.5 150
              C 70.5 141.6, 63.8 134.8, 55.5 134.8
              C 47.2 134.8, 41.2 141.6, 41.2 150
              C 41.2 158.4, 47.2 165.2, 55.5 165.2
              C 63.8 165.2, 70.5 158.4, 70.5 150
              Z
            "
            fill="#FFFFFF"
          />

          {/* 'm' letter: The iconic wavy ribbon from Amore's official logo */}
          <path
            d="
              M 87 168.8
              C 94 168.8, 102 168, 109 152
              C 113 143, 116.5 131.2, 122 131.2
              C 127.5 131.2, 133 139, 139.5 151
              C 146 139, 151.5 131.2, 157 131.2
              C 162.5 131.2, 167 142.5, 172.5 168.8
            "
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="8.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 'o' letter: bold geometric oval */}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="
              M 215 150
              C 215 163.2, 205 173.8, 192.5 173.8
              C 180 173.8, 170 163.2, 170 150
              C 170 136.8, 180 126.2, 192.5 126.2
              C 205 126.2, 215 136.8, 215 150
              Z
              M 206.8 150
              C 206.8 141.6, 200.5 134.8, 192.5 134.8
              C 184.5 134.8, 178.2 141.6, 178.2 150
              C 178.2 158.4, 184.5 165.2, 192.5 165.2
              C 200.5 165.2, 206.8 158.4, 206.8 150
              Z
            "
            fill="#FFFFFF"
          />

          {/* 'r' letter: vertical stem + top arch */}
          <path
            d="
              M 221 127
              H 229.2
              V 135
              C 232 129.5, 237.2 126.5, 243 126.5
              C 245 126.5, 246.5 126.8, 247.5 127.2
              V 135.5
              C 246 135, 244.2 134.6, 242.5 134.6
              C 235.8 134.6, 229.2 139.8, 229.2 147.5
              V 173
              H 221
              Z
            "
            fill="#FFFFFF"
          />

          {/* 'e' letter: matching geometric sans with crossbar */}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="
              M 281.5 155.5
              H 256.2
              C 257 162.5, 262.2 166.2, 268.5 166.2
              C 273 166.2, 276.8 163.8, 279.2 160.2
              L 285.5 164.2
              C 281.8 170.2, 275.8 173.8, 268 173.8
              C 255.5 173.8, 247.5 163.5, 247.5 150
              C 247.5 136.5, 255.8 126.2, 268 126.2
              C 280 126.2, 287.5 136.5, 287.5 150
              C 287.5 152.2, 287.3 154.2, 287 155.5
              Z
              M 256.2 148.5
              H 279
              C 278.2 141.5, 273.8 134.8, 267.8 134.8
              C 261.8 134.8, 257 141.5, 256.2 148.5
              Z
            "
            fill="#FFFFFF"
          />
        </g>
      </svg>
    </div>
  );
};
