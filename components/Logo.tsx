import React, { useState } from "react";

const Logo: React.FC = () => {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    // Fallback High-Fidelity SVG if image fails
    return (
      <svg
        width="24"
        height="24"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-8 h-8 text-intuition-primary animate-[spin_10s_linear_infinite]"
      >
        <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="8" strokeDasharray="20 10" />
        <circle cx="50" cy="50" r="25" stroke="currentColor" strokeWidth="4" />
        <circle cx="50" cy="50" r="10" fill="currentColor" />
        <path d="M50 0 L50 20 M50 80 L50 100 M0 50 L20 50 M80 50 L100 50" stroke="currentColor" strokeWidth="8" />
      </svg>
    );
  }

  return (
    <img 
      src="/logo.png" 
      alt="IntuRank"
      className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(0,243,255,0.8)]"
      onError={() => setImgError(true)}
    />
  );
};

export default Logo;