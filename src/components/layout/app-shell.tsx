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

  const userName = user?.displayName || user?.email?.split('@')[0] || "Administrateur";
  const userInitials = userName.substring(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar - Desktop */}
      <aside className="w-80 border-r bg-card hidden md:flex flex-col sticky top-0 h-screen shadow-2xl">
        <Link 
          href="/dashboard" 
          className="h-40 border-b flex items-center px-10 gap-5 hover:bg-primary/5 transition-all group"
        >
          <div className="h-20 w-20 bg-primary rounded-[24px] flex items-center justify-center text-primary-foreground shadow-2xl group-hover:scale-105 group-hover:rotate-3 transition-all duration-300 shrink-0">
             <div className="relative">
              <Glasses className="h-12 w-12" />
              <ThumbsUp className="h-6 w-6 absolute -top-2 -right-2 bg-primary p-1 rounded-full border-2 border-white" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-headline font-black text-4xl tracking-tighter text-primary leading-none uppercase">{APP_NAME}</span>
            <span className="text-[11px] font-black text-primary/40 uppercase tracking-[0.4em] mt-2">Optique Pro</span>
          </div>
        </Link>
        <div className="flex-1 py-10 overflow-y-auto px-4">
          <SidebarNav role={role} />
        </div>
        <div className="p-8 border-t mt-auto bg-slate-50/50">
          <div className="flex items-center gap-5 px-6 py-5 bg-white rounded-[28px] border border-primary/10 shadow-sm">
            <Avatar className="h-14 w-14 border-4 border-primary/5 shadow-inner">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-black">{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-base font-black truncate capitalize text-slate-900 leading-tight">{userName}</span>
              <span className="text-[11px] font-black text-primary/60 uppercase tracking-widest">{role}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-28 border-b bg-card flex items-center justify-between px-8 md:px-14 sticky top-0 z-30 shadow-sm backdrop-blur-xl bg-white/80">
          <div className="flex items-center gap-6">
            {/* Mobile Menu Trigger */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-14 w-14 hover:bg-primary/10 rounded-2xl">
                  <Menu className="h-8 w-8 text-primary" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80">
                <SheetHeader className="p-10 border-b text-left bg-slate-50">
                  <SheetTitle className="flex items-center gap-5">
                    <div className="h-16 w-16 bg-primary rounded-[20px] flex items-center justify-center text-primary-foreground shadow-xl">
                       <div className="relative">
                        <Glasses className="h-10 w-10" />
                        <ThumbsUp className="h-5 w-5 absolute -top-2 -right-2 bg-primary p-0.5 rounded-full" />
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-headline font-black text-3xl text-primary tracking-tighter leading-none uppercase">{APP_NAME}</span>
                      <span className="text-[10px] font-black text-primary/40 uppercase tracking-[0.3em] mt-1">Optique Pro</span>
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <div className="py-10 overflow-y-auto max-h-[calc(100vh-160px)] px-4" onClick={() => setOpen(false)}>
                  <SidebarNav role={role} />
                </div>
              </SheetContent>
            </Sheet>

            <Link href="/dashboard" className="flex items-center gap-5 group md:hidden">
              <div className="h-16 w-16 bg-primary rounded-[20px] flex items-center justify-center text-primary-foreground shrink-0 shadow-xl group-hover:scale-105 transition-all">
                <div className="relative">
                  <Glasses className="h-10 w-10" />
                  <ThumbsUp className="h-5 w-5 absolute -top-1.5 -right-1.5 bg-primary p-1 rounded-full border-2 border-white" />
                </div>
              </div>
              <div className="flex flex-col">
                <h2 className="text-3xl font-black text-primary truncate tracking-tighter leading-none uppercase">
                  {APP_NAME}
                </h2>
                <span className="text-[10px] font-black text-primary/40 uppercase tracking-[0.3em] mt-1">Optique Pro</span>
              </div>
            </Link>

            <div className="hidden md:block">
              <h2 className="text-[11px] font-black text-primary/40 uppercase tracking-[0.5em] mb-1.5">Système de Gestion</h2>
              <p className="text-3xl font-black text-slate-800 tracking-tighter">Espace Professionnel</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild className="text-slate-500 hover:text-destructive hover:bg-destructive/5 h-14 px-6 rounded-2xl transition-all">
              <Link href="/login">
                <LogOut className="h-6 w-6 md:mr-3.5" />
                <span className="hidden md:inline text-[11px] font-black uppercase tracking-[0.2em]">Se Déconnecter</span>
              </Link>
            </Button>
          </div>
        </header>
        <main className="flex-1 p-8 md:p-14 overflow-y-auto bg-slate-50/70">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
