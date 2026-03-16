
"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "full" | "icon";
  color?: string;
}

export function Logo({ className, variant = "full", color = "#6a8036" }: LogoProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center w-full", className)}>
      {/* Eyeglasses Icon */}
      <div className={cn(variant === "full" ? "w-24 md:w-28" : "w-full h-full")}>
        <svg 
          width="100%" 
          height="auto" 
          viewBox="0 0 100 45" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
        >
          <rect 
            x="8" y="12" width="34" height="24" 
            rx="10" 
            stroke={color} 
            strokeWidth="3.5" 
          />
          <rect 
            x="58" y="12" width="34" height="24" 
            rx="10" 
            stroke={color} 
            strokeWidth="3.5" 
          />
          <path 
            d="M42 22C42 22 45 18 50 18C55 18 58 22 58 22" 
            stroke={color} 
            strokeWidth="3.5" 
            strokeLinecap="round" 
          />
          <circle cx="14" cy="24" r="1.5" fill={color} />
          <circle cx="86" cy="24" r="1.5" fill={color} />
          <path d="M2 20H8" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.3" />
          <path d="M92 20H98" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.3" />
        </svg>
      </div>

      {/* Typography - Now very explicitly defined */}
      {variant === "full" && (
        <div className="flex flex-col items-center mt-4 w-full space-y-1">
          <h1 
            className="font-black text-2xl md:text-3xl uppercase tracking-tighter whitespace-nowrap leading-tight"
            style={{ color: color }}
          >
            LIKE VISION OPTIQUE
          </h1>
          <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] whitespace-nowrap">
            GESTION OPTIQUE PROFESSIONNELLE
          </p>
        </div>
      )}
    </div>
  );
}
