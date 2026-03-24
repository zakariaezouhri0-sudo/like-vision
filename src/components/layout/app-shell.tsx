"use client";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { APP_NAME } from "@/lib/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, AlertTriangle, Loader2 } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { useRouter, usePathname } from "next/navigation";
import { Logo } from "@/components/ui/logo";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string>("");
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role')?.toUpperCase();
    if (savedRole) {
      setRole(savedRole);
    }
    setIsHydrated(true);
  }, []);

  const isPrepa = isHydrated && role === "PREPA";
  const isOpticienne = isHydrated && role === "OPTICIENNE";

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: settings, isLoading: settingsLoading } = useDoc(settingsRef);

  const userName = user?.displayName || "Personnel";
  const userInitials = userName.substring(0, 2).toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem('user_role');
    localStorage.removeItem('work_mode');
  };

  const LogoContainer = ({ size = "large" }: { size?: "small" | "large" }) => {
    const isLoading = settingsLoading && !settings;
    
    return (
      <div className="flex items-center gap-3 h-14">
        <div className={cn(
          "flex items-center justify-center shrink-0 relative overflow-hidden rounded-xl transition-all duration-300",
          size === "large" ? "h-14 w-14" : "h-10 w-10",
          "bg-transparent"
        )}>
          {isLoading ? (
            <div className="h-full w-full flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-[#D4AF37]/20 border-t-[#D4AF37] animate-spin" />
            </div>
          ) : settings?.logoUrl ? (
            <img 
              src={settings.logoUrl} 
              alt="Logo" 
              className="h-full w-full object-contain p-1 animate-in fade-in duration-700" 
            />
          ) : (
            <Logo variant="icon" color="#D4AF37" className={size === "large" ? "w-10" : "w-7"} />
          )}
        </div>
        <div className="flex flex-col justify-center pr-1">
          <span className={cn(
            "font-black tracking-tighter text-[#D4AF37] leading-tight uppercase block whitespace-nowrap transition-all duration-500",
            size === "large" ? "text-sm lg:text-base" : "text-xs"
          )}>
            {isLoading ? <div className="h-4 w-24 bg-white/5 animate-pulse rounded" /> : (settings?.name || APP_NAME)}
          </span>
          <span className="text-[7px] font-black text-[#D4AF37]/60 uppercase tracking-[0.3em] mt-0.5 shrink-0">
            Optique Pro
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#0D1B2A] text-white font-body overflow-hidden">
      {/* Sidebar - Desktop (Centered Logo) */}
      <aside className="w-64 border-r border-white/5 bg-[#0D1B2A] hidden md:flex flex-col sticky top-0 h-screen shadow-xl z-40">
        <div 
          className="h-24 border-b border-white/5 flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => router.push(isOpticienne ? "/caisse" : "/dashboard")}
        >
          <LogoContainer size="large" />
        </div>
        
        <div className="flex-1 py-4 overflow-y-auto px-2 mt-2">
          <SidebarNav role={role} />
        </div>

        <div className="p-4 border-t border-white/5 bg-black/20 space-y-3 shrink-0">
          <div className="h-[34px]">
            {isHydrated ? (
              <div className={cn(
                "px-4 py-2 rounded-full border flex items-center gap-2 shadow-sm transition-all duration-500 animate-in fade-in",
                isPrepa ? "bg-orange-500 text-white border-orange-600" : "bg-white/5 text-white border-white/5"
              )}>
                <div className={cn("h-2 w-2 rounded-full bg-current", isPrepa && "animate-pulse")} />
                <span className="text-[9px] font-black uppercase tracking-widest">
                  {isPrepa ? "Espace Brouillon" : "Espace Réel"}
                </span>
              </div>
            ) : (
              <div className="h-full w-full bg-white/5 rounded-full animate-pulse" />
            )}
          </div>

          <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-3xl border border-white/5 shadow-sm min-h-[64px]">
            {isHydrated ? (
              <>
                <Avatar className="h-10 w-10 border-2 border-[#D4AF37]/20 shadow-inner shrink-0">
                  <AvatarFallback className="bg-[#D4AF37] text-[#0D1B2A] text-xs font-black">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0 animate-in fade-in slide-in-from-left-2 duration-500">
                  <span className="text-xs font-black truncate capitalize text-white">{userName}</span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37]">
                    {role === "ADMIN" ? "ADMINISTRATEUR" : (role === "PREPA" ? "ZAKARIAE" : "OPTICIENNE")}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 w-full">
                <div className="h-10 w-10 rounded-full bg-white/5 animate-pulse shrink-0" />
                <div className="space-y-2 w-full">
                  <div className="h-3 w-2/3 bg-white/5 animate-pulse rounded" />
                  <div className="h-2 w-1/3 bg-white/5 animate-pulse rounded" />
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen bg-[#F8F9FA]">
        {isPrepa && (
          <div className="h-10 bg-orange-500 text-white flex items-center justify-center gap-3 px-4 font-black text-[10px] uppercase tracking-[0.2em] shadow-inner shrink-0 animate-in slide-in-from-top duration-500">
            <AlertTriangle className="h-4 w-4" />
            Compte de Préparation : Vos saisies sont isolées (Brouillon).
          </div>
        )}
        
        <header className="h-20 border-b border-border/50 bg-white/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            {isHydrated && (
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden h-11 w-11 hover:bg-primary/5 rounded-xl border border-border shadow-sm">
                    <Menu className="h-6 w-6 text-[#0D1B2A]" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-72 bg-[#0D1B2A] border-none">
                  <SheetHeader className="p-6 border-b border-white/5 text-left">
                    <SheetTitle>
                      <div className="flex justify-start">
                        <LogoContainer size="large" />
                      </div>
                    </SheetTitle>
                  </SheetHeader>
                  <div className="py-4 overflow-y-auto px-2" onClick={() => setOpen(false)}>
                    <SidebarNav role={role} />
                  </div>
                </SheetContent>
              </Sheet>
            )}

            <div className="md:hidden cursor-pointer" onClick={() => router.push(isOpticienne ? "/caisse" : "/dashboard")}>
              <LogoContainer size="small" />
            </div>

            <div className="hidden md:flex items-center gap-4">
              <div className="flex flex-col">
                <h2 className="text-[9px] font-black text-[#D4AF37] uppercase tracking-[0.4em] mb-0.5">Like Vision</h2>
                <p className="text-xl font-black text-[#0D1B2A] tracking-tighter leading-none">Gestion Optique</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 md:gap-6">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 h-11 px-5 rounded-full transition-all" onClick={handleLogout}>
              <Link href="/login">
                <LogOut className="h-4 w-4 md:mr-3" />
                <span className="hidden md:inline text-[10px] font-black uppercase tracking-[0.2em]">Déconnexion</span>
              </Link>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-[#F8F9FA]">
          <div key={pathname} className="max-w-7xl mx-auto animate-page">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
