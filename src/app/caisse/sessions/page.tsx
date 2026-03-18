
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
  Download
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { cn, formatCurrency, formatMAD, roundAmount } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, updateDoc, doc, query, orderBy, deleteDoc, limit, getDocs, where, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid, getDay, startOfDay, endOfDay } from "date-fns";
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
    try {
      const [year, month] = monthKey.split('-').map(Number);
      const monthName = format(new Date(year, month - 1), "MMMM yyyy", { locale: fr }).toUpperCase();
      
      const rows = sessionsOfMonth.map(s => {
        const d = parseISO(s.date);
        const data: any = {
          "Date": isValid(d) ? format(d, "dd MMMM yyyy", { locale: fr }) : s.date,
          "Statut": s.status === "CLOSED" ? "CLÔTURÉE" : "EN COURS",
          "Initial": formatMAD(s.openingBalance || 0),
        };
        if (isAdminOrPrepa) {
          data["Flux Net"] = formatMAD((s.totalSales || 0) - (s.totalExpenses || 0));
        }
        data["Versements"] = formatMAD(s.totalVersements || 0);
        data["Final"] = formatMAD(s.closingBalanceReal || 0);
        return data;
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sessions");
      XLSX.writeFile(wb, `Like Vision - Sessions ${monthName}.xlsx`);
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur lors de l'export mensuel" });
    }
  };

  const handleExportDayExcel = async (dateStr: string) => {
    try {
      const d = parseISO(dateStr);
      if (!isValid(d)) throw new Error("Date invalide");

      const start = startOfDay(d);
      const end = endOfDay(d);
      
      const q = query(
        collection(db, "transactions"),
        where("isDraft", "==", isPrepaMode)
      );
      
      const snap = await getDocs(q);
      const allTrans = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(t => {
          if (!t.createdAt?.toDate) return false;
          const tDate = t.createdAt.toDate();
          return tDate >= start && tDate <= end;
        });

      if (allTrans.length === 0) {
        toast({ title: "Info", description: "Aucune opération enregistrée pour ce jour." });
        return;
      }

      const qSales = query(
        collection(db, "sales"),
        where("isDraft", "==", isPrepaMode)
      );
      const salesSnap = await getDocs(qSales);
      const salesMap: Record<string, any> = {};
      salesSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.invoiceId) salesMap[data.invoiceId] = data;
      });

      const mapRow = (t: any) => {
        if (!t.id) return {};

        let invoiceId = t.relatedId || "";
        if (!invoiceId && t.label?.includes('VENTE')) {
          invoiceId = t.label.replace('VENTE ', '').trim();
        }
        
        const sale = salesMap[invoiceId];
        const isVente = t.type === "VENTE";
        const totalNet = sale ? (Number(sale.total) - (Number(sale.remise) || 0)) : null;
        const movement = Math.abs(t.montant);
        const refDisplay = isVente ? (invoiceId ? invoiceId.slice(-4) : "---") : "---";
        
        let displayLabel = isVente ? (sale?.notes || t.label || "") : t.label;
        if (t.type === "VERSEMENT" && !isVente) {
          const clean = (t.label || "").replace(/^VERSEMENT\s*[:\-']?\s*/i, '').trim();
          displayLabel = `VERSEMENT | ${clean || "BANQUE"}`;
        } else if (!isVente) {
          const typeStr = t.type || "";
          const redundantPrefixes = [typeStr, "Achat monture", "Achat verres", "Versement", "Depense"];
          let cleanedLabel = t.label || "";
          redundantPrefixes.forEach(p => {
            const reg = new RegExp(`^${p}\\s*[:\\-']?\\s*`, 'i');
            cleanedLabel = cleanedLabel.replace(reg, '');
          });
          cleanedLabel = cleanedLabel.replace(/^['"]|['"]$/g, '').trim();
          displayLabel = `${typeStr} | ${cleanedLabel || "---"}`;
        }

        return {
          "Réf": refDisplay,
          "Date": t.createdAt?.toDate ? format(t.createdAt.toDate(), "dd/MM/yyyy") : "--/--/----",
          "Libellé": displayLabel,
          "Nom client": t.clientName || "---",
          "Montant Tot": isVente && totalNet !== null ? formatMAD(totalNet) : "",
          "Mouvement": isVente ? formatMAD(movement) : "",
          "SORTIE": !isVente ? formatMAD(movement) : ""
        };
      };

      const nouveauxClients = allTrans.filter((t: any) => t.type === "VENTE" && t.isBalancePayment !== true);
      
      const depensesUniquement = allTrans.filter((t: any) => t.type !== "VENTE" && t.type !== "VERSEMENT");
      const versementsUniquement = allTrans.filter((t: any) => t.type === "VERSEMENT");
      const depensesEtVersements = [...depensesUniquement, ...versementsUniquement];
      
      const resteARegler = allTrans.filter((t: any) => t.type === "VENTE" && t.isBalancePayment === true);

      const finalExcelRows = [
        ...nouveauxClients.map(mapRow),
        {}, 
        ...depensesEtVersements.map(mapRow),
        {}, 
        ...resteARegler.map(mapRow)
      ];

      const ws = XLSX.utils.json_to_sheet(finalExcelRows);
      ws['!cols'] = [
        { wch: 10 }, { wch: 12 }, { wch: 35 }, { wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 18 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Opérations");
      XLSX.writeFile(wb, `Like Vision - Opérations ${dateStr}.xlsx`);
    } catch (e) {
      console.error("Export error:", e);
      toast({ variant: "destructive", title: "Erreur lors de l'exportation" });
    }
  };

  if (!isClientReady || loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-primary uppercase tracking-tighter">Journal des Sessions</h1>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">Historique complet des clôtures.</p>
        </div>
        <Button onClick={() => router.push('/caisse')} variant="outline" className="h-11 px-6 rounded-xl font-black text-[10px] uppercase border-primary/20 bg-white text-primary shadow-sm hover:bg-slate-50">
          <RotateCcw className="mr-2 h-4 w-4" /> RETOUR CAISSE
        </Button>
      </div>

      <Accordion type="multiple" defaultValue={[groupedSessions[0]?.[0]]} className="space-y-6">
        {groupedSessions.length === 0 ? (
          <Card className="p-20 text-center rounded-[40px] border-none shadow-sm bg-white">
            <p className="text-[10px] font-black uppercase opacity-20 tracking-[0.4em]">Aucune session enregistrée.</p>
          </Card>
        ) : (
          groupedSessions.map(([monthKey, monthSessions]) => {
            const [year, month] = monthKey.split('-').map(Number);
            const monthName = format(new Date(year, month - 1), "MMMM yyyy", { locale: fr }).toUpperCase();
            const totalFluxNet = monthSessions.reduce((acc, s) => acc + (s.totalSales || 0) - (s.totalExpenses || 0), 0);

            return (
              <AccordionItem key={monthKey} value={monthKey} className="border-none">
                <div className="bg-white rounded-[60px] shadow-sm overflow-hidden border border-slate-100 hover:shadow-md transition-all duration-300">
                  <div className="grid grid-cols-3 items-center px-10 py-5 min-h-[85px]">
                    <div className="flex justify-start items-center">
                      <AccordionTrigger className="p-0 hover:no-underline flex items-center gap-4 group">
                        <div className="h-9 w-9 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-[#828A32]/10 transition-colors">
                          <ChevronRight className="h-4 w-4 text-[#828A32] transition-transform duration-300 group-data-[state=open]:rotate-90" />
                        </div>
                        <span className="text-sm font-black text-[#828A32] tracking-widest uppercase whitespace-nowrap">
                          {monthName}
                        </span>
                      </AccordionTrigger>
                    </div>

                    <div className="flex flex-col items-center">
                      {isAdminOrPrepa ? (
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] mb-1 opacity-70">
                            FLUX NET (APRES CHARGES)
                          </span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black text-[#1A4D2E] tracking-tighter tabular-nums leading-none">
                              {formatCurrency(totalFluxNet)}
                            </span>
                            <span className="text-[9px] font-black text-[#1A4D2E]/40 uppercase tracking-tighter">DH</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-[1px] w-8 bg-slate-100 opacity-10" />
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Button 
                        onClick={(e) => { e.stopPropagation(); handleExportMonthExcel(monthKey, monthSessions); }}
                        className="bg-[#89a644] hover:bg-[#768e3a] text-white h-9 px-5 rounded-full font-black text-[10px] uppercase shadow-lg shadow-green-900/10 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 group"
                      >
                        <Download className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5" />
                        <span>EXCEL</span>
                      </Button>
                    </div>
                  </div>

                  <AccordionContent className="px-6 pb-8 pt-0">
                    <div className="overflow-hidden rounded-[32px] border shadow-sm mx-4">
                      <Table>
                        <TableHeader className="bg-[#768e3a]">
                          <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="text-[9px] uppercase font-black px-8 py-4 text-white">Date & Statut</TableHead>
                            <TableHead className="text-center text-[9px] uppercase font-black px-2 py-4 text-white">Ouverture</TableHead>
                            <TableHead className="text-right text-[9px] uppercase font-black px-2 py-4 text-white">Initial</TableHead>
                            {isAdminOrPrepa && <TableHead className="text-right text-[9px] uppercase font-black px-2 py-4 text-white">Flux (Net)</TableHead>}
                            <TableHead className="text-right text-[9px] uppercase font-black px-2 py-4 text-white">Versements</TableHead>
                            <TableHead className="text-right text-[9px] uppercase font-black px-2 py-4 text-white">Final</TableHead>
                            <TableHead className="text-center text-[9px] uppercase font-black px-2 py-4 text-white">Clôture</TableHead>
                            <TableHead className="text-right text-[9px] uppercase font-black px-8 py-4 text-white w-20">Actions</TableHead>
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
                                <TableCell className="px-8 py-4">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-xs font-black text-slate-900 uppercase">
                                      {isValid(d) ? format(d, "dd MMMM yyyy", { locale: fr }) : s.date}
                                    </span>
                                    <span className={cn("text-[7px] font-black uppercase tracking-widest", isClosed ? "text-red-500" : "text-green-600")}>
                                      {isClosed ? "CLÔTURÉE" : "EN COURS"}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center px-2 py-4">
                                  <div className="flex items-center justify-center gap-1 text-green-600 font-bold text-[10px] tabular-nums">
                                    <Clock className="h-2.5 w-2.5 opacity-40" />
                                    {s.openedAt?.toDate ? format(s.openedAt.toDate(), "HH:mm") : "--:--"}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right px-2 py-4 font-black text-[10px] tabular-nums text-slate-600">{formatCurrency(s.openingBalance || 0)}</TableCell>
                                {isAdminOrPrepa && (
                                  <TableCell className="text-right px-2 py-4 font-black text-[10px] text-green-600 tabular-nums">
                                    {fluxNet > 0 ? "+" : ""}{formatCurrency(fluxNet)}
                                  </TableCell>
                                )}
                                <TableCell className="text-right px-2 py-4 font-black text-[10px] text-orange-600 tabular-nums">
                                  -{formatCurrency(s.totalVersements || 0)}
                                </TableCell>
                                <TableCell className="text-right px-2 py-4 font-black text-xs text-slate-900 tabular-nums">
                                  {formatCurrency(s.closingBalanceReal ?? (s.openingBalance + fluxNet - (s.totalVersements || 0)))}
                                </TableCell>
                                <TableCell className="text-center px-2 py-4">
                                  {isClosed ? (
                                    <div className="flex items-center justify-center gap-1 text-red-500 font-bold text-[10px] tabular-nums">
                                      <Clock className="h-2.5 w-2.5 opacity-40" />
                                      {s.closedAt?.toDate ? format(s.closedAt.toDate(), "HH:mm") : "--:--"}
                                    </div>
                                  ) : (
                                    <span className="text-[9px] text-slate-300 italic">En cours</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right px-8 py-4">
                                  <DropdownMenu modal={false}>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-slate-100">
                                        <MoreVertical className="h-3.5 w-3.5 text-slate-400" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-2xl border-primary/10">
                                      <DropdownMenuItem onClick={() => handleExportDayExcel(s.date)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl">
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
                </div>
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
