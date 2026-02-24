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
      <aside className="w-72 border-r bg-card hidden md:flex flex-col sticky top-0 h-screen shadow-sm">
        <Link 
          href="/dashboard" 
          className="h-20 border-b flex items-center px-6 gap-3 hover:bg-accent/5 transition-all group"
        >
          <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg group-hover:scale-110 transition-transform">
             <div className="relative">
              <Glasses className="h-6 w-6" />
              <ThumbsUp className="h-3 w-3 absolute -top-1.5 -right-1.5 bg-primary p-0.5 rounded-full" />
            </div>
          </div>
          <span className="font-headline font-black text-2xl tracking-tighter text-primary">{APP_NAME}</span>
        </Link>
        <div className="flex-1 py-6 overflow-y-auto px-2">
          <SidebarNav role={role} />
        </div>
        <div className="p-4 border-t mt-auto">
          <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-2xl border border-muted/50">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarFallback className="bg-primary/10 text-primary text-sm font-black">{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-black truncate capitalize text-slate-900">{userName}</span>
              <span className="text-[10px] font-black text-primary/60 uppercase tracking-widest">{role}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 md:h-20 border-b bg-card flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 shadow-sm backdrop-blur-md bg-white/80">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Trigger */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-10 w-10">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80">
                <SheetHeader className="p-6 border-b text-left">
                  <SheetTitle className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg">
                       <div className="relative">
                        <Glasses className="h-6 w-6" />
                        <ThumbsUp className="h-3 w-3 absolute -top-1.5 -right-1.5 bg-primary p-0.5 rounded-full" />
                      </div>
                    </div>
                    <span className="font-headline font-black text-2xl text-primary tracking-tighter">{APP_NAME}</span>
                  </SheetTitle>
                </SheetHeader>
                <div className="py-6 overflow-y-auto max-h-[calc(100vh-100px)] px-2" onClick={() => setOpen(false)}>
                  <SidebarNav role={role} />
                </div>
              </SheetContent>
            </Sheet>

            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground md:hidden shrink-0 shadow-lg group-hover:scale-110 transition-all">
                <div className="relative">
                  <Glasses className="h-6 w-6" />
                  <ThumbsUp className="h-3 w-3 absolute -top-1.5 -right-1.5 bg-primary p-0.5 rounded-full" />
                </div>
              </div>
              <div className="flex flex-col">
                <h2 className="text-lg md:text-xl font-black text-primary truncate tracking-tighter leading-none">
                  {APP_NAME}
                </h2>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] hidden md:block">Gestion Optique Pro</span>
              </div>
            </Link>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-destructive hover:bg-destructive/5 h-10 px-3 md:px-4 rounded-xl transition-all">
              <Link href="/login">
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline text-xs font-black uppercase">Quitter</span>
              </Link>
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-50/50">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
