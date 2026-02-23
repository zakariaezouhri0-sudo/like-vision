"use client";

import { SidebarNav } from "@/components/layout/sidebar-nav";
import { APP_NAME } from "@/lib/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogOut, Eye, Menu } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useState } from "react";

interface AppShellProps {
  children: React.ReactNode;
  role?: string;
}

export function AppShell({ children, role = "ADMIN" }: AppShellProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar - Desktop */}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col sticky top-0 h-screen">
        <Link 
          href="/dashboard" 
          className="h-16 border-b flex items-center px-6 gap-2 hover:bg-accent/5 transition-all group"
        >
          <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-sm group-hover:scale-105 transition-transform">
            <Eye className="h-5 w-5" />
          </div>
          <span className="font-headline font-bold text-xl tracking-tight text-primary">{APP_NAME}</span>
        </Link>
        <div className="flex-1 py-4 overflow-y-auto">
          <SidebarNav role={role} />
        </div>
        <div className="p-4 border-t mt-auto">
          <div className="flex items-center gap-3 px-3 py-2 bg-muted/30 rounded-lg">
            <Avatar className="h-8 w-8 border">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">AD</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold truncate">Administrateur</span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{role}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card flex items-center justify-between px-4 md:px-8 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-2">
            {/* Mobile Menu Trigger */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72">
                <SheetHeader className="p-6 border-b text-left">
                  <SheetTitle className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground">
                      <Eye className="h-5 w-5" />
                    </div>
                    <span className="font-headline font-bold text-xl text-primary">{APP_NAME}</span>
                  </SheetTitle>
                </SheetHeader>
                <div className="py-4" onClick={() => setOpen(false)}>
                  <SidebarNav role={role} />
                </div>
              </SheetContent>
            </Sheet>

            <Link href="/dashboard" className="flex items-center gap-2 group">
              <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground md:hidden">
                <Eye className="h-5 w-5" />
              </div>
              <h2 className="text-sm font-bold text-primary md:text-muted-foreground md:font-medium">
                {APP_NAME} <span className="hidden md:inline">Optique Pro</span>
              </h2>
            </Link>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-destructive">
              <Link href="/login">
                <LogOut className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Déconnexion</span>
              </Link>
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
