
"use client";

import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "full" | "icon";
  color?: string;
}

export function Logo({ className, variant = "full", color }: LogoProps) {
  // On utilise la couleur passée (pour le login) ou currentColor (pour s'adapter au parent, ex: sidebar)
  const mainColor = color || "currentColor";

  return (
    <div className={cn("flex flex-col items-center justify-center w-full", className)}>
      {/* Icône des lunettes - Taille ajustée pour laisser de la place au texte */}
      <div className={cn(variant === "full" ? "w-20 md:w-24" : "w-full h-full")}>
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
            stroke={mainColor} 
            strokeWidth="3.5" 
          />
          <rect 
            x="58" y="12" width="34" height="24" 
            rx="10" 
            stroke={mainColor} 
            strokeWidth="3.5" 
          />
          <path 
            d="M42 22C42 22 45 18 50 18C55 18 58 22 58 22" 
            stroke={mainColor} 
            strokeWidth="3.5" 
            strokeLinecap="round" 
          />
          <circle cx="14" cy="24" r="1.5" fill={mainColor} />
          <circle cx="86" cy="24" r="1.5" fill={mainColor} />
          <path d="M2 20H8" stroke={mainColor} strokeWidth="2" strokeLinecap="round" opacity="0.3" />
          <path d="M92 20H98" stroke={mainColor} strokeWidth="2" strokeLinecap="round" opacity="0.3" />
        </svg>
      </div>

      {/* Typographie - Même style que "CONNEXION" pour le titre, gris pour le sous-titre */}
      {variant === "full" && (
        <div className="flex flex-col items-center mt-4 w-full space-y-1">
          <h1 
            className="font-black text-2xl md:text-3xl uppercase tracking-tight whitespace-nowrap leading-tight"
            style={color ? { color: color } : {}}
          >
            LIKE VISION OPTIQUE
          </h1>
          <p className={cn(
            "text-[10px] md:text-[11px] font-black uppercase tracking-[0.25em] whitespace-nowrap transition-colors",
            color ? "text-slate-400" : "opacity-40"
          )}>
            GESTION OPTIQUE PROFESSIONNELLE
          </p>
        </div>
      )}
    </div>
  );
}
