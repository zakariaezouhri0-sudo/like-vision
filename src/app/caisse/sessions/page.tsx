"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Loader2, 
  FileText, 
  RotateCcw,
  Clock,
  ChevronRight,
  Trash2,
  Download,
  MoreVertical
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { cn, formatCurrency, roundAmount, formatMAD } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, updateDoc, doc, query, orderBy, deleteDoc, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid, getDay } from "date-fns";
import { fr } from "date-fns/locale";
import * as XLSX from "xlsx";

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

  const sessionsByMonth = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    sessions.forEach(s => {
      const d = parseISO(s.date);
      if (isValid(d)) {
        const monthKey = format(d, "MMMM yyyy", { locale: fr }).toUpperCase();
        if (!grouped[monthKey]) grouped[monthKey] = [];
        grouped[monthKey].push(s);
      }
    });
    return grouped;
  }, [sessions]);

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

  const exportMonthToExcel = (monthName: string, monthSessions: any[]) => {
    const data = monthSessions.map(s => {
      const flux = roundAmount((s.totalSales || 0) - (s.totalExpenses || 0));
      return {
        "DATE": format(parseISO(s.date), "dd/MM/yyyy"),
        "STATUT": s.status === "OPEN" ? "EN COURS" : "CLÔTURÉE",
        "OUVERTURE": s.openedAt?.toDate ? format(s.openedAt.toDate(), "HH:mm") : "--:--",
        "FONDS INITIAL": formatMAD(s.openingBalance),
        "FLUX (NET)": formatMAD(flux),
        "VERSEMENT": formatMAD(s.totalVersements || 0),
        "FONDS FINAL": formatMAD(s.closingBalanceReal ?? (s.openingBalance + flux - (s.totalVersements || 0))),
        "CLÔTURE": s.closedAt?.toDate ? format(s.closedAt.toDate(), "HH:mm") : "--:--"
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sessions");
    XLSX.writeFile(workbook, `Like Vision - Sessions ${monthName}.xlsx`);
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
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60 mt-1">Historique des clôtures par mois.</p>
        </div>
        <Button onClick={() => router.push('/caisse')} className="h-14 px-8 rounded-2xl font-black shadow-xl">
          <RotateCcw className="mr-2 h-5 w-5" /> RETOUR CAISSE DU JOUR
        </Button>
      </div>

      <Accordion type="multiple" defaultValue={[Object.keys(sessionsByMonth)[0]]} className="space-y-6">
        {Object.entries(sessionsByMonth).map(([monthName, monthSessions]) => {
          const monthFlux = roundAmount(monthSessions.reduce((acc, s) => acc + ((s.totalSales || 0) - (s.totalExpenses || 0)), 0));
          
          return (
            <AccordionItem key={monthName} value={monthName} className="border-none">
              <Card className="rounded-[32px] overflow-hidden bg-white shadow-lg border-none">
                <div className="bg-[#6a8036] px-8 py-4 flex items-center justify-between">
                  <AccordionTrigger className="hover:no-underline py-0 text-white group">
                    <div className="flex flex-col items-start text-left">
                      <h2 className="text-xl font-black uppercase tracking-widest">{monthName}</h2>
                      <div className="flex flex-col mt-1">
                        <span className="text-[8px] font-black text-white/60 uppercase tracking-[0.2em]">Flux Net (Après charges)</span>
                        <span className="text-2xl font-black tabular-nums">{formatCurrency(monthFlux)}</span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => { e.stopPropagation(); exportMonthToExcel(monthName, monthSessions); }}
                    className="bg-white text-[#6a8036] border-none font-black text-[10px] uppercase rounded-xl h-10 px-5 shadow-lg hover:bg-slate-50 transition-all"
                  >
                    <Download className="mr-2 h-4 w-4" /> Excel
                  </Button>
                </div>

                <AccordionContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-[#6a8036]/90 border-b border-white/10">
                        <TableRow>
                          <TableHead className="text-[10px] uppercase font-black px-6 py-5 text-white w-[18%]">Date & Statut</TableHead>
                          <TableHead className="text-center text-[10px] uppercase font-black px-2 py-5 text-white w-[10%]">Ouverture</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-black px-2 py-5 text-white w-[12%]">Fonds Initial</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-black px-2 py-5 text-white w-[12%]">Flux (Net)</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-black px-2 py-5 text-white w-[12%]">Versement</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-black px-2 py-5 text-white w-[12%]">Fonds Final</TableHead>
                          <TableHead className="text-center text-[10px] uppercase font-black px-2 py-5 text-white w-[10%]">Clôture</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-black px-6 py-5 text-white w-[5%]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthSessions.map((s: any) => {
                          const d = parseISO(s.date);
                          const isSunday = isValid(d) && getDay(d) === 0;
                          const flux = roundAmount((s.totalSales || 0) - (s.totalExpenses || 0));
                          const isClosed = s.status === "CLOSED";

                          return (
                            <TableRow 
                              key={s.id} 
                              className={cn(
                                "hover:bg-slate-50 transition-all border-b group",
                                isSunday ? "bg-red-50 hover:bg-red-100/50" : ""
                              )}
                            >
                              <TableCell className="px-6 py-5">
                                <div className="flex flex-col">
                                  <span className="text-sm font-black text-slate-900 uppercase">
                                    {isValid(d) ? format(d, "dd MMMM yyyy", { locale: fr }) : s.date}
                                  </span>
                                  <span className={cn(
                                    "text-[8px] font-black uppercase mt-1",
                                    !isClosed ? "text-green-600" : "text-red-500"
                                  )}>
                                    {!isClosed ? "En cours" : "Clôturée"}
                                  </span>
                                </div>
                              </TableCell>
                              
                              <TableCell className="text-center px-2 py-5">
                                <div className="flex items-center justify-center gap-1.5 text-green-600">
                                  <Clock className="h-3 w-3" />
                                  <span className="text-[11px] font-black tabular-nums">
                                    {s.openedAt?.toDate ? format(s.openedAt.toDate(), "HH:mm") : "--:--"}
                                  </span>
                                </div>
                              </TableCell>

                              <TableCell className="text-right px-2 py-5 font-black text-slate-900 tabular-nums text-xs">
                                {formatCurrency(s.openingBalance)}
                              </TableCell>

                              <TableCell className="text-right px-2 py-5">
                                <span className={cn("text-xs font-black tabular-nums", flux >= 0 ? "text-green-600" : "text-red-500")}>
                                  {formatCurrency(flux)}
                                </span>
                              </TableCell>

                              <TableCell className="text-right px-2 py-5 font-black text-orange-600 tabular-nums text-xs">
                                -{formatCurrency(s.totalVersements || 0)}
                              </TableCell>

                              <TableCell className="text-right px-2 py-5">
                                <span className="text-sm font-black text-slate-900 tabular-nums">
                                  {formatCurrency(s.closingBalanceReal ?? (s.openingBalance + flux - (s.totalVersements || 0)))}
                                </span>
                              </TableCell>

                              <TableCell className="text-center px-2 py-5">
                                {isClosed ? (
                                  <div className="flex items-center justify-center gap-1.5 text-red-500">
                                    <Clock className="h-3 w-3" />
                                    <span className="text-[11px] font-black tabular-nums">
                                      {s.closedAt?.toDate ? format(s.closedAt.toDate(), "HH:mm") : "20:00"}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-[9px] font-black text-slate-300 uppercase italic">En cours...</span>
                                )}
                              </TableCell>

                              <TableCell className="text-right px-6 py-5">
                                <DropdownMenu modal={false}>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                      <MoreVertical className="h-4 w-4 text-slate-400" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-2xl border-primary/10 min-w-[180px]">
                                    <DropdownMenuItem onClick={() => router.push(`/rapports/print/journalier?date=${s.date}`)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl">
                                      <FileText className="mr-3 h-4 w-4 text-primary" /> Rapport PDF
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => router.push(`/rapports/print/operations?date=${s.date}`)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl">
                                      <FileText className="mr-3 h-4 w-4 text-blue-600" /> Détail Opérations
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => router.push(`/caisse?date=${s.date}`)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl">
                                      <ChevronRight className="mr-3 h-4 w-4 text-slate-400" /> Voir les lignes
                                    </DropdownMenuItem>
                                    {isClosed && isAdminOrPrepa && (
                                      <DropdownMenuItem onClick={() => handleReopenSession(s.id)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl text-orange-600">
                                        <RotateCcw className="mr-3 h-4 w-4" /> Ré-ouvrir
                                      </DropdownMenuItem>
                                    )}
                                    {isAdminOrPrepa && (
                                      <DropdownMenuItem onClick={() => handleDeleteSession(s.id, s.date)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl text-destructive">
                                        <Trash2 className="mr-3 h-4 w-4" /> Supprimer
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </Card>
            </AccordionItem>
          );
        })}
      </Accordion>
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
