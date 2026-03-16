
"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "full" | "icon";
  color?: string;
}

export function Logo({ className, variant = "full", color = "#76933C" }: LogoProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      {/* Eyeglasses Icon - Modern Square Outline Style */}
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 100 60" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={variant === "icon" ? "w-full h-full" : "w-16 h-10"}
      >
        {/* Left Lens Frame */}
        <rect 
          x="10" y="15" width="32" height="28" 
          rx="6" 
          stroke={color} 
          strokeWidth="4" 
        />
        {/* Right Lens Frame */}
        <rect 
          x="58" y="15" width="32" height="28" 
          rx="6" 
          stroke={color} 
          strokeWidth="4" 
        />
        {/* Bridge */}
        <path 
          d="M42 28C42 28 45 24 50 24C55 24 58 28 58 28" 
          stroke={color} 
          strokeWidth="4" 
          strokeLinecap="round" 
        />
        {/* Decorative Detail (Square feel) */}
        <rect x="6" y="26" width="4" height="4" fill={color} rx="1" />
        <rect x="90" y="26" width="4" height="4" fill={color} rx="1" />
      </svg>

      {/* Typography */}
      {variant === "full" && (
        <span 
          className="font-black text-[10px] sm:text-[12px] uppercase tracking-[0.3em] whitespace-nowrap"
          style={{ color }}
        >
          LIKE VISION
        </span>
      )}
    </div>
  );
}
