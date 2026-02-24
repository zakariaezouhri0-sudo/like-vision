
"use client";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { APP_NAME } from "@/lib/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Glasses, ThumbsUp, Menu } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useState } from "react";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import Image from "next/image";

interface AppShellProps {
  children: React.ReactNode;
  role?: string;
}

export function AppShell({ children, role = "ADMIN" }: AppShellProps) {
  const [open, setOpen] = useState(false);
  const { user } = useUser();
  const db = useFirestore();

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: settings } = useDoc(settingsRef);

  const userName = user?.displayName || user?.email?.split('@')[0] || "Personnel";
  const userInitials = userName.substring(0, 2).toUpperCase();

  return (
    <div className="flex min-h-screen bg-background text-foreground font-body">
      {/* Sidebar - Desktop */}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col sticky top-0 h-screen shadow-2xl">
        <Link 
          href="/dashboard" 
          className="h-28 border-b flex items-center px-6 gap-4 hover:bg-primary/5 transition-all group"
        >
          <div className="h-16 w-16 flex items-center justify-center shrink-0 relative">
            {settings?.logoUrl ? (
              <Image src={settings.logoUrl} alt="Logo" fill className="object-contain" />
            ) : (
              <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-xl group-hover:scale-105 transition-all">
                <div className="relative">
                  <Glasses className="h-7 w-7" />
                  <ThumbsUp className="h-3.5 w-3.5 absolute -top-1 -right-1 bg-primary p-0.5 rounded-full border border-white" />
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-headline font-black text-xl tracking-tighter text-primary leading-tight uppercase truncate">{settings?.name || APP_NAME}</span>
            <span className="text-[8px] font-black text-primary/30 uppercase tracking-[0.3em] mt-0.5">Optique Pro</span>
          </div>
        </Link>
        <div className="flex-1 py-4 overflow-y-auto px-3">
          <SidebarNav role={role} />
        </div>
        <div className="p-4 border-t mt-auto bg-slate-50/50">
          <div className="flex items-center gap-3 px-3 py-3 bg-white rounded-xl border border-primary/10 shadow-sm">
            <Avatar className="h-9 w-9 border-2 border-primary/5">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-black">{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-black truncate capitalize text-slate-900 leading-tight">{userName}</span>
              <span className="text-[8px] font-black text-primary/60 uppercase tracking-widest">{role}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-20 border-b bg-card flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 shadow-sm backdrop-blur-xl bg-white/80">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Trigger */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-10 w-10 hover:bg-primary/10 rounded-xl">
                  <Menu className="h-6 w-6 text-primary" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <SheetHeader className="p-6 border-b text-left bg-slate-50">
                  <SheetTitle className="flex items-center gap-4">
                    <div className="h-14 w-14 flex items-center justify-center shrink-0 relative">
                      {settings?.logoUrl ? (
                        <Image src={settings.logoUrl} alt="Logo" fill className="object-contain" />
                      ) : (
                        <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg">
                          <div className="relative">
                            <Glasses className="h-7 w-7" />
                            <ThumbsUp className="h-3.5 w-3.5 absolute -top-1 -right-1 bg-primary p-0.5 rounded-full border border-white" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-headline font-black text-xl text-primary tracking-tighter leading-none uppercase">{settings?.name || APP_NAME}</span>
                      <span className="text-[8px] font-black text-primary/40 uppercase tracking-[0.3em] mt-1">Optique Pro</span>
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <div className="py-4 overflow-y-auto max-h-[calc(100vh-120px)] px-3" onClick={() => setOpen(false)}>
                  <SidebarNav role={role} />
                </div>
              </SheetContent>
            </Sheet>

            <Link href="/dashboard" className="flex items-center gap-4 group md:hidden">
              <div className="h-12 w-12 flex items-center justify-center shrink-0 relative">
                {settings?.logoUrl ? (
                  <Image src={settings.logoUrl} alt="Logo" fill className="object-contain" />
                ) : (
                  <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shrink-0 shadow-lg group-hover:scale-105 transition-all">
                    <div className="relative">
                      <Glasses className="h-6 w-6" />
                      <ThumbsUp className="h-3 w-3 absolute -top-1 -right-1 bg-primary p-0.5 rounded-full border border-white" />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl font-black text-primary truncate tracking-tighter leading-none uppercase">
                  {settings?.name || APP_NAME}
                </h2>
                <span className="text-[8px] font-black text-primary/40 uppercase tracking-[0.3em] mt-1">Optique Pro</span>
              </div>
            </Link>

            <div className="hidden md:block">
              <h2 className="text-[8px] font-black text-primary/40 uppercase tracking-[0.4em] mb-0.5">Système de Gestion</h2>
              <p className="text-xl font-black text-slate-800 tracking-tighter">Espace Professionnel</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="text-slate-500 hover:text-destructive hover:bg-destructive/5 h-10 px-4 rounded-xl transition-all">
              <Link href="/login">
                <LogOut className="h-4 w-4 md:mr-2.5" />
                <span className="hidden md:inline text-[9px] font-black uppercase tracking-[0.2em]">Déconnexion</span>
              </Link>
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-50/70">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
