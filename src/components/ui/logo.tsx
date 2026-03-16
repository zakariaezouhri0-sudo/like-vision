"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "full" | "icon";
  color?: string;
}

export function Logo({ className, variant = "full", color = "#76933C" }: LogoProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      {/* Eyeglasses Icon - High-End Minimalist Style */}
      <svg 
        width="100%" 
        height="100%" 
        viewBox="0 0 100 45" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={variant === "icon" ? "w-full h-full" : "w-20 h-12"}
      >
        {/* Left Lens Frame - Soft Rectangular Profile */}
        <rect 
          x="8" y="12" width="34" height="24" 
          rx="10" 
          stroke={color} 
          strokeWidth="3.5" 
        />
        {/* Right Lens Frame */}
        <rect 
          x="58" y="12" width="34" height="24" 
          rx="10" 
          stroke={color} 
          strokeWidth="3.5" 
        />
        {/* Bridge - Elegant Curved Arch */}
        <path 
          d="M42 22C42 22 45 18 50 18C55 18 58 22 58 22" 
          stroke={color} 
          strokeWidth="3.5" 
          strokeLinecap="round" 
        />
        {/* Decorative Temple Pins (Small dots for premium feel) */}
        <circle cx="14" cy="24" r="1.5" fill={color} />
        <circle cx="86" cy="24" r="1.5" fill={color} />
        
        {/* Subtle Temple Arms start */}
        <path d="M2 20H8" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
        <path d="M92 20H98" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      </svg>

      {/* Typography - Modern Bold Sans-Serif */}
      {variant === "full" && (
        <div className="flex flex-col items-center mt-1">
          <span 
            className="font-black text-[9px] sm:text-[10px] uppercase tracking-wider whitespace-nowrap leading-none text-center"
            style={{ color }}
          >
            HAHIA BLAST LOGO AUCUN CHANGEMENT
          </span>
          <div className="h-0.5 w-8 mt-1.5 rounded-full" style={{ backgroundColor: color, opacity: 0.3 }} />
        </div>
      )}
    </div>
  );
}
