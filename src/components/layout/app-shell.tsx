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
      <aside className="w-64 border-r bg-card hidden md:flex flex-col sticky top-0 h-screen">
        <Link 
          href="/dashboard" 
          className="h-16 border-b flex items-center px-6 gap-2 hover:bg-accent/5 transition-all group"
        >
          <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-sm group-hover:scale-105 transition-transform">
             <div className="relative">
              <Glasses className="h-5 w-5" />
              <ThumbsUp className="h-2.5 w-2.5 absolute -top-1 -right-1 bg-primary p-0.5 rounded-full" />
            </div>
          </div>
          <span className="font-headline font-bold text-xl tracking-tight text-primary">{APP_NAME}</span>
        </Link>
        <div className="flex-1 py-4 overflow-y-auto">
          <SidebarNav role={role} />
        </div>
        <div className="p-4 border-t mt-auto">
          <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-lg">
            <Avatar className="h-8 w-8 border">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{userInitials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold truncate capitalize">{userName}</span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{role}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 md:h-16 border-b bg-card flex items-center justify-between px-4 md:px-8 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-2">
            {/* Mobile Menu Trigger */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <SheetHeader className="p-6 border-b text-left">
                  <SheetTitle className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground">
                       <div className="relative">
                        <Glasses className="h-5 w-5" />
                        <ThumbsUp className="h-2.5 w-2.5 absolute -top-1 -right-1 bg-primary p-0.5 rounded-full" />
                      </div>
                    </div>
                    <span className="font-headline font-bold text-xl text-primary">{APP_NAME}</span>
                  </SheetTitle>
                </SheetHeader>
                <div className="py-4 overflow-y-auto max-h-[calc(100vh-80px)]" onClick={() => setOpen(false)}>
                  <SidebarNav role={role} />
                </div>
              </SheetContent>
            </Sheet>

            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="h-7 w-7 bg-primary rounded-full flex items-center justify-center text-primary-foreground md:hidden shrink-0">
                <div className="relative">
                  <Glasses className="h-4 w-4" />
                  <ThumbsUp className="h-2 w-2 absolute -top-1 -right-1 bg-primary p-0.5 rounded-full" />
                </div>
              </div>
              <h2 className="text-xs md:text-sm font-bold text-primary truncate max-w-[120px] md:max-w-none">
                {APP_NAME} <span className="hidden md:inline">Optique Pro</span>
              </h2>
            </Link>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-destructive h-8 px-2 md:px-3">
              <Link href="/login">
                <LogOut className="h-3.5 w-3.5 md:mr-2" />
                <span className="hidden md:inline text-xs">Déconnexion</span>
              </Link>
            </Button>
          </div>
        </header>
        <main className="flex-1 p-3 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}