"use client";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { APP_NAME } from "@/lib/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Glasses, ThumbsUp, Menu } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useState, useEffect } from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<string>("OPTICIENNE");
  const { user } = useUser();
  const db = useFirestore();

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role');
    if (savedRole) {
      setRole(savedRole.toUpperCase());
    }
  }, []);

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: settings } = useDoc(settingsRef);

  const userName = user?.displayName || "Personnel";
  const userInitials = userName.substring(0, 2).toUpperCase();
  const displayRole = role === "ADMIN" ? "ADMINISTRATEUR" : "OPTICIENNE";

  const handleLogout = () => {
    localStorage.removeItem('user_role');
  };

  const LogoContainer = ({ size = "large" }: { size?: "small" | "large" }) => (
    <div className="flex items-center gap-3 min-w-0">
      <div className={cn(
        "flex items-center justify-center shrink-0 relative overflow-hidden bg-white rounded-xl shadow-sm border border-slate-100",
        size === "large" ? "h-12 w-12" : "h-9 w-9"
      )}>
        {settings?.logoUrl ? (
          <img 
            src={settings.logoUrl} 
            alt="Logo" 
            className="h-full w-full object-contain p-1" 
          />
        ) : (
          <div className={cn(
            "h-full w-full bg-primary flex items-center justify-center text-primary-foreground",
            size === "large" ? "p-2" : "p-1.5"
          )}>
            <div className="relative">
              <Glasses className={size === "large" ? "h-7 w-7" : "h-5 w-5"} />
              <ThumbsUp className={cn("absolute -top-1 -right-1 bg-primary p-0.5 rounded-full border border-white", size === "large" ? "h-3.5 w-3.5" : "h-2.5 w-2.5")} />
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col justify-center min-w-0 pr-2">
        <span className={cn(
          "font-black tracking-tighter text-primary leading-tight uppercase block whitespace-nowrap",
          size === "large" ? "text-sm lg:text-base" : "text-xs"
        )}>
          {settings?.name || APP_NAME}
        </span>
        <span className="text-[7px] font-black text-primary/30 uppercase tracking-[0.3em] mt-0.5 shrink-0">
          Optique Pro
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50/50 text-foreground font-body overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="w-72 border-r bg-white hidden md:flex flex-col sticky top-0 h-screen shadow-xl z-40">
        <Link 
          href="/dashboard" 
          className="h-24 border-b flex items-center px-6 hover:bg-slate-50 transition-all"
        >
          <LogoContainer size="large" />
        </Link>
        <div className="flex-1 py-6 overflow-y-auto px-2">
          <SidebarNav role={role} />
        </div>
        <div className="p-4 border-t bg-slate-50/50">
          <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <Avatar className="h-10 w-10 border-2 border-primary/10 shadow-inner">
              <AvatarFallback className="bg-primary text-white text-xs font-black">{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-black truncate capitalize text-slate-900">{userName}</span>
              <span className="text-[9px] font-black text-primary/60 uppercase tracking-widest">{displayRole}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <header className="h-20 border-b bg-white/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Trigger */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-11 w-11 hover:bg-primary/5 rounded-xl border border-slate-100 shadow-sm">
                  <Menu className="h-6 w-6 text-primary" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80">
                <SheetHeader className="p-6 border-b text-left bg-white">
                  <SheetTitle>
                    <LogoContainer size="large" />
                  </SheetTitle>
                </SheetHeader>
                <div className="py-6 overflow-y-auto px-2" onClick={() => setOpen(false)}>
                  <SidebarNav role={role} />
                </div>
              </SheetContent>
            </Sheet>

            <Link href="/dashboard" className="md:hidden">
              <LogoContainer size="small" />
            </Link>

            <div className="hidden md:block">
              <h2 className="text-[9px] font-black text-primary/40 uppercase tracking-[0.4em] mb-0.5">Tableau de Bord</h2>
              <p className="text-xl font-black text-slate-800 tracking-tighter">Gestion Magasin</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="text-slate-400 hover:text-destructive hover:bg-destructive/5 h-11 px-5 rounded-xl transition-all" onClick={handleLogout}>
              <Link href="/login">
                <LogOut className="h-4 w-4 md:mr-3" />
                <span className="hidden md:inline text-[10px] font-black uppercase tracking-[0.2em]">Déconnexion</span>
              </Link>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-50/30">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
