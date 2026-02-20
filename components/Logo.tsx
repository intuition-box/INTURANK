import React from "react";
import logo from "../logo.png";

// Uses the canonical IntuRank brand mark from logo.png
const Logo: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => {
  return (
    <img
      src={logo}
      alt="IntuRank Logo"
      className={className || "w-full h-full"}
      style={style}
    />
  );
};

export default Logo;