
"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  MoreVertical,
  Download,
  ChevronDown
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { cn, formatCurrency, roundAmount, formatMAD } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, updateDoc, doc, query, orderBy, deleteDoc, limit, getDocs, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid, getDay, startOfMonth, endOfMonth } from "date-fns";
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
    return rawSessions
      .filter(s => isPrepaMode ? s.isDraft === true : s.isDraft !== true);
  }, [rawSessions, isPrepaMode]);

  const groupedSessions = useMemo(() => {
    const groups: Record<string, any[]> = {};
    sessions.forEach(s => {
      const d = parseISO(s.date);
      if (isValid(d)) {
        const monthKey = format(d, "yyyy-MM");
        if (!groups[monthKey]) groups[monthKey] = [];
        groups[monthKey].push(s);
      }
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [sessions]);

  const handleDeleteSession = async (id: string, date: string) => {
    if (!isAdminOrPrepa) return;
    if (!confirm(`Supprimer définitivement la session du ${date} ?`)) return;
    try {
      await deleteDoc(doc(db, "cash_sessions", id));
      toast({ variant: "success", title: "Session supprimée" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); }
  };

  const handleReopenSession = async (id: string) => {
    if (!confirm("Ré-ouvrir cette session ?")) return;
    try {
      await updateDoc(doc(db, "cash_sessions", id), {
        status: "OPEN", closedAt: null, closedBy: null, closingBalanceReal: null, closingBalanceTheoretical: null, discrepancy: null
      });
      toast({ variant: "success", title: "Session ré-ouverte" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); }
  };

  const handleExportMonthExcel = async (monthKey: string, sessionsOfMonth: any[]) => {
    const [year, month] = monthKey.split('-').map(Number);
    const monthName = format(new Date(year, month - 1), "MMMM yyyy", { locale: fr }).toUpperCase();
    
    const rows = sessionsOfMonth.map(s => {
      const d = parseISO(s.date);
      return {
        "Date": isValid(d) ? format(d, "dd MMMM yyyy", { locale: fr }) : s.date,
        "Statut": s.status === "CLOSED" ? "CLÔTURÉE" : "EN COURS",
        "Initial": formatMAD(s.openingBalance),
        "Flux Net": formatMAD((s.totalSales || 0) - (s.totalExpenses || 0)),
        "Versements": formatMAD(s.totalVersements || 0),
        "Final": formatMAD(s.closingBalanceReal || 0)
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sessions");
    XLSX.writeFile(wb, `Like Vision - Sessions ${monthName}.xlsx`);
  };

  const handleExportDayTransactions = async (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      
      const q = query(
        collection(db, "transactions"),
        where("isDraft", "==", isPrepaMode),
        where("createdAt", ">=", start),
        where("createdAt", "<=", end)
      );
      
      const snap = await getDocs(q);
      const trans = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(t => format(t.createdAt.toDate(), "yyyy-MM-dd") === dateStr);

      const nouvellesVentes = trans.filter(t => t.type === "VENTE" && !t.isBalancePayment);
      const sorties = trans.filter(t => t.type !== "VENTE");
      const reglements = trans.filter(t => t.type === "VENTE" && t.isBalancePayment);

      const mapRow = (t: any) => ({
        "Réf": t.relatedId ? t.relatedId.slice(-4) : "---",
        "Date": format(t.createdAt.toDate(), "dd/MM/yyyy"),
        "Libellé": t.label || "---",
        "Nom client": t.clientName || "---",
        "Montant Tot": t.type === "VENTE" ? formatMAD(t.montant) : "",
        "Mouvement": t.type === "VENTE" ? formatMAD(Math.abs(t.montant)) : "",
        "SORTIE": t.type !== "VENTE" ? formatMAD(Math.abs(t.montant)) : ""
      });

      const excelData = [
        ...nouvellesVentes.map(mapRow),
        {}, 
        ...sorties.map(mapRow),
        {},
        ...reglements.map(mapRow)
      ];

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Opérations");
      XLSX.writeFile(wb, `Like Vision - Opérations ${dateStr}.xlsx`);
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur lors de l'export" });
    }
  };

  if (!isClientReady || loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Journal des Sessions</h1>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">Historique complet des clôtures.</p>
        </div>
        <Button onClick={() => router.push('/caisse')} variant="outline" className="h-12 px-8 rounded-2xl font-black text-[10px] uppercase border-primary/20 bg-white text-primary shadow-sm hover:bg-slate-50">
          <RotateCcw className="mr-2 h-4 w-4" /> RETOUR CAISSE
        </Button>
      </div>

      <Accordion type="multiple" defaultValue={[groupedSessions[0]?.[0]]} className="space-y-6">
        {groupedSessions.length === 0 ? (
          <Card className="p-20 text-center rounded-[40px] border-none shadow-sm bg-white">
            <p className="text-xs font-black uppercase opacity-20 tracking-[0.4em]">Aucune session enregistrée.</p>
          </Card>
        ) : (
          groupedSessions.map(([monthKey, monthSessions]) => {
            const [year, month] = monthKey.split('-').map(Number);
            const monthName = format(new Date(year, month - 1), "MMMM yyyy", { locale: fr }).toUpperCase();
            const totalFluxNet = monthSessions.reduce((acc, s) => acc + (s.totalSales || 0) - (s.totalExpenses || 0), 0);

            return (
              <AccordionItem key={monthKey} value={monthKey} className="border-none">
                <Card className="rounded-full shadow-lg border-none bg-white overflow-hidden">
                  <div className="px-10 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
                    <AccordionTrigger className="p-0 hover:no-underline flex-1 flex items-center gap-6 group">
                      <span className="text-xl md:text-2xl font-black text-[#828A32] tracking-tighter uppercase shrink-0">
                        {monthName}
                      </span>
                      
                      <div className="flex-1 flex flex-col items-center">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">FLUX NET (APRES CHARGES)</span>
                        <span className="text-2xl md:text-3xl font-black text-[#828A32] tracking-tighter tabular-nums">
                          {formatCurrency(totalFluxNet)}
                        </span>
                      </div>
                    </AccordionTrigger>

                    <Button 
                      onClick={(e) => { e.stopPropagation(); handleExportMonthExcel(monthKey, monthSessions); }}
                      className="bg-[#89a644] hover:bg-[#768e3a] text-white h-11 px-6 rounded-full font-black text-[10px] uppercase shadow-md transition-all shrink-0 ml-4"
                    >
                      <Download className="mr-2 h-4 w-4" /> EXCEL
                    </Button>
                  </div>

                  <AccordionContent className="px-6 pb-6 pt-0">
                    <div className="overflow-hidden rounded-[32px] border shadow-sm">
                      <Table>
                        <TableHeader className="bg-[#768e3a]">
                          <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="text-[10px] uppercase font-black px-8 py-5 text-white w-[18%]">Date & Statut</TableHead>
                            <TableHead className="text-center text-[10px] uppercase font-black px-2 py-5 text-white w-[12%]">Ouverture</TableHead>
                            <TableHead className="text-right text-[10px] uppercase font-black px-2 py-5 text-white">Fonds Initial</TableHead>
                            <TableHead className="text-right text-[10px] uppercase font-black px-2 py-5 text-white">Flux (Net)</TableHead>
                            <TableHead className="text-right text-[10px] uppercase font-black px-2 py-5 text-white">Versement</TableHead>
                            <TableHead className="text-right text-[10px] uppercase font-black px-2 py-5 text-white">Fonds Final</TableHead>
                            <TableHead className="text-center text-[10px] uppercase font-black px-2 py-5 text-white w-[12%]">Clôture</TableHead>
                            <TableHead className="text-right text-[10px] uppercase font-black px-8 py-5 text-white w-20">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {monthSessions.map((s: any) => {
                            const d = parseISO(s.date);
                            const isSunday = isValid(d) && getDay(d) === 0;
                            const isClosed = s.status === "CLOSED";
                            const fluxNet = (s.totalSales || 0) - (s.totalExpenses || 0);

                            return (
                              <TableRow key={s.id} className={cn("hover:bg-slate-50 transition-all border-b last:border-0", isSunday && "bg-red-50/50")}>
                                <TableCell className="px-8 py-6">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-base font-black text-slate-900 uppercase leading-none">
                                      {isValid(d) ? format(d, "dd MMMM yyyy", { locale: fr }) : s.date}
                                    </span>
                                    <span className={cn("text-[9px] font-black uppercase tracking-widest", isClosed ? "text-red-500" : "text-green-600")}>
                                      {isClosed ? "CLÔTURÉE" : "EN COURS"}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center px-2 py-6">
                                  <div className="flex items-center justify-center gap-1.5 text-green-600/70 font-black text-xs tabular-nums bg-green-50/50 py-1.5 rounded-lg border border-green-100">
                                    <Clock className="h-3.5 w-3.5" />
                                    {s.openedAt?.toDate ? format(s.openedAt.toDate(), "HH:mm") : "--:--"}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right px-2 py-6 font-black text-sm tabular-nums text-slate-900">{formatCurrency(s.openingBalance)}</TableCell>
                                <TableCell className="text-right px-2 py-6 font-black text-sm text-green-600 tabular-nums">
                                  {fluxNet > 0 ? "+" : ""}{formatCurrency(fluxNet)}
                                </TableCell>
                                <TableCell className="text-right px-2 py-6 font-black text-sm text-red-500 tabular-nums">
                                  -{formatCurrency(s.totalVersements || 0)}
                                </TableCell>
                                <TableCell className="text-right px-2 py-6 font-black text-base text-slate-950 tabular-nums">
                                  {formatCurrency(s.closingBalanceReal ?? (s.openingBalance + fluxNet - (s.totalVersements || 0)))}
                                </TableCell>
                                <TableCell className="text-center px-2 py-6">
                                  {isClosed ? (
                                    <div className="flex items-center justify-center gap-1.5 text-red-500/70 font-black text-xs tabular-nums bg-red-50/50 py-1.5 rounded-lg border border-red-100">
                                      <Clock className="h-3.5 w-3.5" />
                                      {s.closedAt?.toDate ? format(s.closedAt.toDate(), "HH:mm") : "--:--"}
                                    </div>
                                  ) : (
                                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">En cours...</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right px-8 py-6">
                                  <DropdownMenu modal={false}>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100 transition-colors">
                                        <MoreVertical className="h-5 w-5 text-slate-400" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-[20px] p-2 shadow-2xl border-primary/10 min-w-[180px]">
                                      <DropdownMenuItem onClick={() => handleExportDayTransactions(s.date)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl">
                                        <FileText className="mr-3 h-4 w-4 text-green-600" /> Export Excel
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => router.push(`/caisse?date=${s.date}`)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl">
                                        <ChevronRight className="mr-3 h-4 w-4 text-primary" /> Voir Détails
                                      </DropdownMenuItem>
                                      {isClosed && isAdminOrPrepa && (
                                        <DropdownMenuItem onClick={() => handleReopenSession(s.id)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl text-orange-600">
                                          <RotateCcw className="mr-3 h-4 w-4" /> Ré-ouvrir Caisse
                                        </DropdownMenuItem>
                                      )}
                                      {isAdminOrPrepa && (
                                        <DropdownMenuItem onClick={() => handleDeleteSession(s.id, s.date)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl text-destructive">
                                          <Trash2 className="mr-3 h-4 w-4" /> Supprimer Session
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
          })
        )}
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
