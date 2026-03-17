"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  FileText, 
  CalendarDays,
  RotateCcw,
  Clock,
  ChevronRight,
  Trash2
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { cn, formatCurrency, roundAmount } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, updateDoc, doc, query, orderBy, deleteDoc, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid, getDay } from "date-fns";
import { fr } from "date-fns/locale";

function SessionsContent() {
  const { toast } = useToast();
  const db = useFirestore();
  const router = useRouter();
  const [role, setRole] = useState<string>("");
  const [isClientReady, setIsHydrated] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role')?.toUpperCase() || "OPTICIENNE";
    setRole(savedRole);
    setIsHydrated(true);
  }, []);

  const isAdminOrPrepa = role === 'ADMIN' || role === 'PREPA';
  const isPrepaMode = role === 'PREPA';

  const sessionsQuery = useMemoFirebase(() => query(
    collection(db, "cash_sessions"), 
    orderBy("date", "desc"),
    limit(500)
  ), [db]);
  
  const { data: rawSessions, isLoading: loading } = useCollection(sessionsQuery);

  const sessions = useMemo(() => {
    if (!rawSessions) return [];
    let filtered = rawSessions.filter(s => isPrepaMode ? s.isDraft === true : s.isDraft !== true);

    const requiredDates = ["2026-03-08", "2026-03-15"];
    requiredDates.forEach(dStr => {
      if (!filtered.find(s => s.date === dStr)) {
        filtered.push({
          id: `MANUAL-${dStr}`,
          date: dStr,
          status: "CLOSED",
          openingBalance: 0,
          closingBalanceReal: 0,
          totalSales: 0,
          totalExpenses: 0,
          totalVersements: 0,
          isDraft: isPrepaMode,
          isManualInjection: true
        });
      }
    });

    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }, [rawSessions, isPrepaMode]);

  const handleDeleteSession = async (id: string, date: string) => {
    if (!isAdminOrPrepa) return;
    if (!confirm(`Supprimer définitivement la session du ${date} ?`)) return;
    try {
      await deleteDoc(doc(db, "cash_sessions", id));
      toast({ variant: "success", title: "Session supprimée" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur" });
    }
  };

  const handleReopenSession = async (id: string) => {
    if (!confirm("Ré-ouvrir cette session ?")) return;
    try {
      await updateDoc(doc(db, "cash_sessions", id), {
        status: "OPEN",
        closedAt: null,
        closedBy: null,
        closingBalanceReal: null,
        closingBalanceTheoretical: null,
        discrepancy: null
      });
      toast({ variant: "success", title: "Session ré-ouverte" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur" });
    }
  };

  if (!isClientReady || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Journal des Sessions</h1>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60 mt-1">Historique des clôtures (Limite 500).</p>
        </div>
        <Button onClick={() => router.push('/caisse')} className="h-14 px-8 rounded-2xl font-black shadow-xl">
          <RotateCcw className="mr-2 h-5 w-5" /> RETOUR CAISSE DU JOUR
        </Button>
      </div>

      <Card className="rounded-[32px] overflow-hidden bg-white shadow-lg border-none">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#6a8036]">
              <TableRow>
                <TableHead className="text-[10px] uppercase font-black px-6 py-5 text-white w-[25%]">Date & Statut</TableHead>
                <TableHead className="text-center text-[10px] uppercase font-black px-2 py-5 text-white w-[10%]">Ouverture</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-black px-2 py-5 text-white w-[12%]">Initial</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-black px-2 py-5 text-white w-[12%]">FLUX (Net)</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-black px-2 py-5 text-white w-[12%]">Versement</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-black px-2 py-5 text-white w-[12%]">Final</TableHead>
                <TableHead className="text-center text-[10px] uppercase font-black px-2 py-5 text-white w-[10%]">Clôture</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-black px-6 py-5 text-white w-[5%]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-32 text-xs font-black uppercase opacity-20 tracking-widest">
                    Aucun historique de session.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((s: any) => {
                  const d = parseISO(s.date);
                  const isSunday = isValid(d) && getDay(d) === 0;
                  const flux = roundAmount((s.totalSales || 0) - (s.totalExpenses || 0));

                  return (
                    <TableRow 
                      key={s.id} 
                      className={cn(
                        "hover:bg-slate-50 transition-all border-b group",
                        isSunday ? "bg-red-100/50 hover:bg-red-200/50" : ""
                      )}
                    >
                      <TableCell className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-[15px] font-black text-slate-900 uppercase">
                            {isValid(d) ? format(d, "dd MMMM yyyy", { locale: fr }) : s.date}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={cn(
                              "text-[8px] px-2 py-0.5 font-black uppercase rounded-md border-none",
                              s.status === "OPEN" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                            )} variant="outline">
                              {s.status === "OPEN" ? "En cours" : "Clôturée"}
                            </Badge>
                            {s.isManualInjection && <Badge className="bg-orange-100 text-orange-700 text-[7px] font-black px-1">AUTO</Badge>}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-center px-2 py-5">
                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-1.5 text-green-600">
                            <Clock className="h-3 w-3" />
                            <span className="text-[10px] font-black tabular-nums">
                              {s.openedAt?.toDate ? format(s.openedAt.toDate(), "HH:mm") : "--:--"}
                            </span>
                          </div>
                          <span className="text-[8px] font-bold text-slate-400 uppercase mt-1 truncate max-w-[60px]">{s.openedBy || "---"}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-right px-2 py-5 font-bold text-slate-500 tabular-nums text-xs">
                        {formatCurrency(s.openingBalance)}
                      </TableCell>

                      <TableCell className="text-right px-2 py-5">
                        <div className="flex flex-col items-end">
                          <span className={cn("text-xs font-black tabular-nums", flux >= 0 ? "text-green-600" : "text-red-500")}>
                            {flux > 0 ? "+" : ""}{formatCurrency(flux)}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase">V:{formatCurrency(s.totalSales || 0)}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-right px-2 py-5 font-bold text-orange-600 tabular-nums text-xs">
                        -{formatCurrency(s.totalVersements || 0)}
                      </TableCell>

                      <TableCell className="text-right px-2 py-5">
                        <span className="text-sm font-black text-slate-900 tabular-nums">
                          {formatCurrency(s.closingBalanceReal ?? (s.openingBalance + flux - (s.totalVersements || 0)))}
                        </span>
                      </TableCell>

                      <TableCell className="text-center px-2 py-5">
                        <div className="flex flex-col items-center">
                          <div className="flex items-center gap-1.5 text-red-500">
                            <Clock className="h-3 w-3" />
                            <span className="text-[10px] font-black tabular-nums">
                              {s.closedAt?.toDate ? format(s.closedAt.toDate(), "HH:mm") : "--:--"}
                            </span>
                          </div>
                          <span className="text-[8px] font-bold text-slate-400 uppercase mt-1 truncate max-w-[60px]">{s.closedBy || "---"}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-right px-6 py-5">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8 rounded-lg bg-white border-slate-200" 
                            onClick={() => router.push(`/rapports/print/operations?date=${s.date}`)}
                            title="Opérations"
                          >
                            <FileText className="h-4 w-4 text-blue-600" />
                          </Button>
                          
                          {s.status === "CLOSED" && isAdminOrPrepa && (
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg bg-white border-slate-200" 
                              onClick={() => handleReopenSession(s.id)}
                              title="Ré-ouvrir"
                            >
                              <RotateCcw className="h-4 w-4 text-orange-500" />
                            </Button>
                          )}

                          {isAdminOrPrepa && (
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8 rounded-lg bg-white border-red-50 hover:bg-red-50" 
                              onClick={() => handleDeleteSession(s.id, s.date)}
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          )}
                          
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-8 w-8 rounded-lg bg-white border-slate-200"
                            onClick={() => router.push(`/caisse?date=${s.date}`)}
                            title="Voir"
                          >
                            <ChevronRight className="h-4 w-4 text-slate-400" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

export default function SessionsPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>}>
        <SessionsContent />
      </Suspense>
    </AppShell>
  );
}
