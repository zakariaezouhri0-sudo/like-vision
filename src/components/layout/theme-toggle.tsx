
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Palette } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="h-10 w-full rounded-xl bg-white/5 animate-pulse" />
    );
  }

  const toggleTheme = () => {
    setTheme(theme === "elegance" ? "light" : "elegance");
  };

  const isElegance = theme === "elegance";

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={toggleTheme}
      className={cn(
        "h-10 w-full justify-start px-4 rounded-xl font-black text-[10px] uppercase transition-all shadow-sm",
        isElegance 
          ? "bg-white/10 text-white border-white/20 hover:bg-white/20" 
          : "bg-white text-primary border-primary/20 hover:bg-slate-50"
      )}
    >
      <Palette className={cn("mr-3 h-4 w-4", isElegance ? "text-white" : "text-primary")} />
      <span>Style {isElegance ? "Elegance" : "Classique"}</span>
    </Button>
  );
}
