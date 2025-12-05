import React from "react";

const Logo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className || "w-full h-full text-intuition-primary"}
    >
      {/* Outer Hex/Shield Shape */}
      <path 
        d="M 22 10 H 38 V 40 L 30 50 L 38 60 V 82 L 22 95 V 10 Z" 
        fill="currentColor"
        className="opacity-80"
      />
      {/* Inner Circuit Path */}
      <path 
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 44 10 H 75 L 88 23 V 47 L 75 60 H 60 L 80 95 H 60 L 48 65 H 44 V 10 Z M 54 22 V 45 H 72 V 22 H 54 Z" 
        fill="currentColor"
      />
      {/* Glow Effect Def */}
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
};

export default Logo;