import React from "react";

const Logo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className || "w-full h-full"}
      aria-label="IntuRank Logo"
    >
      {/* The "I" component of the logo - Cyan */}
      <path
        d="M22 10H38V40L30 50L38 60V82L22 95V10Z"
        fill="#00f3ff"
        fillOpacity="0.8"
      />
      {/* The "R" component of the logo - Pink */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M44 10H75L88 23V47L75 60H60L80 95H60L48 65H44V10ZM54 22V45H72V22H54Z"
        fill="#ff1e6d"
      />
    </svg>
  );
};

export default Logo;