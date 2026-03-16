"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Palette, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"default" | "elegance">("default");

  useEffect(() => {
    const savedTheme = localStorage.getItem("app_theme") as "default" | "elegance";
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === "elegance") {
        document.body.classList.add("theme-elegance");
      }
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "default" ? "elegance" : "default";
    setTheme(newTheme);
    localStorage.setItem("app_theme", newTheme);
    
    if (newTheme === "elegance") {
      document.body.classList.add("theme-elegance");
    } else {
      document.body.classList.remove("theme-elegance");
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={toggleTheme}
      className={cn(
        "h-10 px-4 rounded-xl font-black text-[10px] uppercase transition-all shadow-sm",
        theme === "elegance" ? "bg-primary text-white border-primary" : "bg-white text-primary border-primary/20"
      )}
    >
      <Palette className="mr-2 h-4 w-4" />
      Style {theme === "default" ? "Classique" : "Elegance"}
    </Button>
  );
}