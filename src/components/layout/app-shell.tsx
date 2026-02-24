
"use client";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { APP_NAME } from "@/lib/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Glasses, ThumbsUp, Menu } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useState } from "react";
import { useUser } from "@/firebase";

interface AppShellProps {
  children: React.ReactNode;
  role?: string;
}

export function AppShell({ children, role = "ADMIN" }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const { user } = useUser();

  const userName = user?.displayName || user?.email?.split('@')[0] || "Personnel";
  const userInitials = userName.substring(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-background text-foreground font-body">
      {/* Sidebar - Desktop */}
      <aside className="w-72 border-r bg-card hidden md:flex flex-col sticky top-0 h-screen shadow-2xl">
        <Link 
          href="/dashboard" 
          className="h-32 border-b flex items-center px-8 gap-4 hover:bg-primary/5 transition-all group"
        >
          <div className="h-14 w-14 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-xl group-hover:scale-105 transition-all shrink-0">
             <div className="relative">
              <Glasses className="h-8 w-8" />
              <ThumbsUp className="h-4 w-4 absolute -top-1 -right-1 bg-primary p-0.5 rounded-full border border-white" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-headline font-black text-2xl tracking-tighter text-primary leading-none uppercase">{APP_NAME}</span>
            <span className="text-[10px] font-black text-primary/30 uppercase tracking-[0.3em] mt-1">Optique Pro</span>
          </div>
        </Link>
        <div className="flex-1 py-6 overflow-y-auto px-4">
          <SidebarNav role={role} />
        </div>
        <div className="p-6 border-t mt-auto bg-slate-50/50">
          <div className="flex items-center gap-4 px-4 py-4 bg-white rounded-2xl border border-primary/10 shadow-sm">
            <Avatar className="h-12 w-12 border-2 border-primary/5">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-black">{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-black truncate capitalize text-slate-900 leading-tight">{userName}</span>
              <span className="text-[9px] font-black text-primary/60 uppercase tracking-widest">{role}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-24 border-b bg-card flex items-center justify-between px-6 md:px-10 sticky top-0 z-30 shadow-sm backdrop-blur-xl bg-white/80">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Trigger */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-12 w-12 hover:bg-primary/10 rounded-xl">
                  <Menu className="h-7 w-7 text-primary" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80">
                <SheetHeader className="p-8 border-b text-left bg-slate-50">
                  <SheetTitle className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg">
                       <div className="relative">
                        <Glasses className="h-7 w-7" />
                        <ThumbsUp className="h-3.5 w-3.5 absolute -top-1 -right-1 bg-primary p-0.5 rounded-full" />
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-headline font-black text-2xl text-primary tracking-tighter leading-none uppercase">{APP_NAME}</span>
                      <span className="text-[9px] font-black text-primary/40 uppercase tracking-[0.3em] mt-1">Optique Pro</span>
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <div className="py-6 overflow-y-auto max-h-[calc(100vh-140px)] px-4" onClick={() => setOpen(false)}>
                  <SidebarNav role={role} />
                </div>
              </SheetContent>
            </Sheet>

            <Link href="/dashboard" className="flex items-center gap-4 group md:hidden">
              <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shrink-0 shadow-lg group-hover:scale-105 transition-all">
                <div className="relative">
                  <Glasses className="h-7 w-7" />
                  <ThumbsUp className="h-3.5 w-3.5 absolute -top-1 -right-1 bg-primary p-0.5 rounded-full border border-white" />
                </div>
              </div>
              <div className="flex flex-col">
                <h2 className="text-2xl font-black text-primary truncate tracking-tighter leading-none uppercase">
                  {APP_NAME}
                </h2>
                <span className="text-[9px] font-black text-primary/40 uppercase tracking-[0.3em] mt-1">Optique Pro</span>
              </div>
            </Link>

            <div className="hidden md:block">
              <h2 className="text-[10px] font-black text-primary/40 uppercase tracking-[0.4em] mb-1">Système de Gestion</h2>
              <p className="text-2xl font-black text-slate-800 tracking-tighter">Espace Professionnel</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild className="text-slate-500 hover:text-destructive hover:bg-destructive/5 h-12 px-5 rounded-xl transition-all">
              <Link href="/login">
                <LogOut className="h-5 w-5 md:mr-3" />
                <span className="hidden md:inline text-[10px] font-black uppercase tracking-[0.2em]">Se Déconnecter</span>
              </Link>
            </Button>
          </div>
        </header>
        <main className="flex-1 p-6 md:p-10 overflow-y-auto bg-slate-50/70">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
