
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  CalendarClock, 
  Loader2, 
  Calendar as CalendarIcon,
  MoreVertical,
  Trash2,
  FileText,
  Clock,
  TrendingUp,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Download,
  ListOrdered,
  FileSpreadsheet,
  RotateCcw,
  AlertCircle
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, cn, roundAmount } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, deleteDoc, doc, writeBatch, getDocs, where, Timestamp, updateDoc, limit, orderBy } from "firebase/firestore";
import { format, parseISO, isSunday, isValid, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import React from "react";
import * as XLSX from "xlsx";

export default function CashSessionsPage() {
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [role, setRole] = useState<string>("OPTICIENNE");
  const [isClientReady, setIsClientReady] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    const savedRole = typeof window !== 'undefined' ? localStorage.getItem('user_role') : null;
    setRole(savedRole?.toUpperCase() || "OPTICIENNE");
    setIsClientReady(true);
  }, []);

  const isAdminOrPrepa = role === 'ADMIN' || role === 'PREPA';
  const isPrepaMode = role === "PREPA";

  const sessionsQuery = useMemoFirebase(() => query(
    collection(db, "cash_sessions"), 
    orderBy("date", "desc"), 
    limit(500)
  ), [db]);
  const { data: rawSessions, isLoading } = useCollection(sessionsQuery);

  const groupedSessions = useMemo(() => {
    if (!rawSessions) return [];
    
    const filtered = [...rawSessions]
      .filter(s => isPrepaMode ? s?.isDraft === true : (s?.isDraft !== true));

    const injectDates = ["2026-03-08", "2026-03-15"];
    injectDates.forEach(d => {
      if (!filtered.find(s => s.date === d)) {
        filtered.push({
          id: `injected-${d}`,
          date: d,
          status: "CLOSED",
          openingBalance: 0,
          totalSales: 0,
          totalExpenses: 0,
          totalVersements: 0,
          closingBalanceReal: 0,
          isDraft: isPrepaMode,
          openedAt: Timestamp.fromDate(new Date(`${d}T09:00:00`)),
          closedAt: Timestamp.fromDate(new Date(`${d}T20:00:00`))
        });
      }
    });

    filtered.sort((a, b) => b.date.localeCompare(a.date));

    const groups: { monthLabel: string; sessions: any[]; totalFlux: number }[] = [];
    
    filtered.forEach(s => {
      if (!s?.date) return;
      try {
        const date = parseISO(s.date);
        if (!isValid(date)) return;
        const monthLabel = format(date, "MMMM yyyy", { locale: fr });
        const sessionFlux = roundAmount((s.totalSales || 0) - (s.totalExpenses || 0));
        
        const lastGroup = groups[groups.length - 1];
        if (lastGroup && lastGroup.monthLabel === monthLabel) {
          lastGroup.sessions.push(s);
          lastGroup.totalFlux = roundAmount(lastGroup.totalFlux + sessionFlux);
        } else {
          groups.push({ monthLabel, sessions: [s], totalFlux: sessionFlux });
        }
      } catch (e) {}
    });
    
    return groups;
  }, [rawSessions, isPrepaMode]);

  useEffect(() => {
    if (groupedSessions.length > 0 && expandedMonths.size === 0) {
      setExpandedMonths(new Set([groupedSessions[0].monthLabel]));
    }
  }, [groupedSessions]);

  const toggleMonth = (label: string) => {
    const newSet = new Set(expandedMonths);
    if (newSet.has(label)) newSet.delete(label);
    else newSet.add(label);
    setExpandedMonths(newSet);
  };

  const formatSessionDate = (dateStr: string) => {
    if (!dateStr || dateStr === "undefined") return "---";
    try {
      const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr.split(' ')[0];
      const d = parseISO(cleanDate);
      if (!isValid(d)) return "---";
      return format(d, "dd MMMM yyyy", { locale: fr }).toUpperCase();
    } catch (e) { return "---"; }
  };

  const formatTime = (ts: any) => {
    if (!ts) return "--:--";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      if (!isValid(d)) return "--:--";
      return format(d, "HH:mm");
    } catch (e) { return "--:--"; }
  };

  const handleDeleteSession = async (session: any) => {
    if (session.id.startsWith("injected-")) {
      toast({ variant: "destructive", title: "Action impossible", description: "Cette session est simulée." });
      return;
    }
    if (!confirm(`Attention : Supprimer la session du ${session.date} effacera également TOUTES les opérations de caisse liées à cette journée. Confirmer ?`)) return;
    
    try {
      const batch = writeBatch(db);
      const dateStart = startOfDay(parseISO(session.date));
      const dateEnd = endOfDay(parseISO(session.date));
      
      const q = query(collection(db, "transactions"), where("isDraft", "==", session.isDraft === true));
      const transSnap = await getDocs(q);
      
      transSnap.docs.forEach(tDoc => {
        const data = tDoc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
        if (createdAt && createdAt >= dateStart && createdAt <= dateEnd) {
          batch.delete(tDoc.ref);
        }
      });
      
      batch.delete(doc(db, "cash_sessions", session.id));
      await batch.commit();
      toast({ variant: "success", title: "Session supprimée" });
    } catch (e) { 
      toast({ variant: "destructive", title: "Erreur" }); 
    }
  };

  const handleReopenSession = async (session: any) => {
    if (session.id.startsWith("injected-")) {
      toast({ variant: "destructive", title: "Action impossible", description: "Cette session est simulée." });
      return;
    }
    if (!confirm(`Ré-ouvrir la session du ${session.date} ?`)) return;
    try {
      await updateDoc(doc(db, "cash_sessions", session.id), {
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

  const handleExportMonth = (sessions: any[], monthLabel: string) => {
    if (!isAdminOrPrepa) return;
    const data = sessions.map(s => {
      const initial = roundAmount(s.openingBalance || 0);
      const sales = roundAmount(s.totalSales || 0);
      const expenses = roundAmount(s.totalExpenses || 0);
      const versements = roundAmount(s.totalVersements || 0);
      const flux = roundAmount(sales - expenses);
      const reel = roundAmount(s.closingBalanceReal !== undefined ? s.closingBalanceReal : (initial + flux - versements));
      
      return {
        "Date": s.date,
        "Statut": s.status,
        "Solde Initial": initial,
        "Ventes": sales,
        "Dépenses": expenses,
        "Versements": versements,
        "Flux Net": flux,
        "Solde Final": reel
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Journal");
    XLSX.writeFile(workbook, `Like Vision - Sessions ${monthLabel}.xlsx`);
  };

  const handleExportDayTransactions = async (session: any) => {
    if (session.id.startsWith("injected-")) {
      toast({ variant: "destructive", title: "Action impossible", description: "Cette session est simulée." });
      return;
    }
    toast({ title: "Génération de l'Excel..." });
    try {
      const dateStart = startOfDay(parseISO(session.date));
      const dateEnd = endOfDay(parseISO(session.date));
      
      const qTrans = query(collection(db, "transactions"), where("isDraft", "==", session.isDraft === true));
      const snapTrans = await getDocs(qTrans);
      const allTrans = snapTrans.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .filter((t: any) => {
          const d = t.createdAt?.toDate ? t.createdAt.toDate() : null;
          return d && d >= dateStart && d <= dateEnd;
        })
        .sort((a: any, b: any) => (a.createdAt?.toDate?.() || 0) - (b.createdAt?.toDate?.() || 0));

      const qSales = query(collection(db, "sales"), where("isDraft", "==", session.isDraft === true));
      const snapSales = await getDocs(qSales);
      const salesMap: Record<string, any> = {};
      snapSales.docs.forEach(d => {
        const data = d.data();
        if (data.invoiceId) salesMap[data.invoiceId] = data;
      });

      const mapToExcelRow = (t: any) => {
        let invoiceId = t.relatedId || "";
        if (!invoiceId && t.label?.includes('VENTE')) {
          invoiceId = t.label.replace('VENTE ', '').trim();
        }
        const sale = salesMap[invoiceId];
        const isVente = t.type === "VENTE";
        const totalNet = sale ? roundAmount(Number(sale.total) - (Number(sale.remise) || 0)) : null;
        const movement = Math.abs(t.montant);
        const refDisplay = isVente ? (invoiceId ? invoiceId.slice(-4) : "---") : "---";
        
        let displayLabel = isVente ? (sale?.notes || t.label || "") : t.label;
        if (t.type === "VERSEMENT" && !isVente) {
          const clean = (t.label || "").replace(/^VERSEMENT\s*[:\-']?\s*/i, '').trim();
          displayLabel = `VERSEMENT | ${clean || "BANQUE"}`;
        }

        return {
          "Réf": refDisplay,
          "Date": t.createdAt?.toDate ? format(t.createdAt.toDate(), "dd/MM/yyyy") : "--/--/----",
          "Libellé": displayLabel,
          "Nom client": t.clientName || "---",
          "Montant Tot": isVente && totalNet !== null ? totalNet : "",
          "Mouvement": isVente ? movement : "",
          "SORTIE": !isVente ? movement : ""
        };
      };

      const vNew = allTrans.filter((t: any) => t.type === "VENTE" && t.isBalancePayment !== true);
      const vSorties = allTrans.filter((t: any) => t.type !== "VENTE");
      const vRegl = allTrans.filter((t: any) => t.type === "VENTE" && t.isBalancePayment === true);

      const excelRows = [
        ...vNew.map(mapToExcelRow),
        {}, 
        ...vSorties.map(mapToExcelRow),
        {}, 
        ...vRegl.map(mapToExcelRow)
      ];

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Opérations");
      XLSX.writeFile(workbook, `Like Vision - Opérations ${session.date}.xlsx`);
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Erreur" });
    }
  };

  if (!isClientReady) return null;

  return (
    <AppShell>
      <div className="space-y-8 pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 bg-white p-8 rounded-[32px] border shadow-sm">
          <div className="flex items-center gap-6">
            <div className="h-16 w-16 bg-primary text-white rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 transform -rotate-3">
              <CalendarClock className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-primary uppercase tracking-tighter leading-none">Journal des Sessions</h1>
              <p className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] mt-2 opacity-60">Historique complet sur 12 mois.</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
            </div>
          ) : groupedSessions.length > 0 ? (
            groupedSessions.map((group) => {
              const isExpanded = expandedMonths.has(group.monthLabel);
              return (
                <Card key={group.monthLabel} className="shadow-xl border-none overflow-hidden rounded-[32px] bg-white">
                  <div 
                    className={cn(
                      "grid items-center px-8 py-5 cursor-pointer transition-colors select-none gap-4",
                      isAdminOrPrepa ? "grid-cols-3" : "grid-cols-1",
                      isExpanded ? "bg-primary text-white" : "bg-slate-50 hover:bg-slate-100 text-primary"
                    )}
                    onClick={() => toggleMonth(group.monthLabel)}
                  >
                    <div className="flex items-center gap-4">
                      {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      <span className="text-base font-black uppercase tracking-[0.2em]">{group.monthLabel}</span>
                    </div>

                    {isAdminOrPrepa ? (
                      <div className="flex flex-col items-center">
                        <span className={cn("text-[8px] font-black uppercase tracking-[0.2em] mb-0.5", isExpanded ? "text-white/50" : "text-slate-400")}>FLUX NET (APRES CHARGES)</span>
                        <span className={cn("text-lg font-black tabular-nums", isExpanded ? "text-white" : (group.totalFlux > 0 ? "text-emerald-600" : "text-red-500"))}>
                          {formatCurrency(group.totalFlux).replace('+', '')}
                        </span>
                      </div>
                    ) : (
                      <div />
                    )}

                    <div className="flex justify-end">
                      {isAdminOrPrepa && (
                        <Button 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); handleExportMonth(group.sessions, group.monthLabel); }}
                          className={cn("h-9 px-4 rounded-xl font-black text-[9px] uppercase", isExpanded ? "bg-white text-primary" : "bg-primary text-white")}
                        >
                          <Download className="mr-2 h-3.5 w-3.5" /> EXCEL
                        </Button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table className="min-w-[1100px]">
                          <TableHeader className="bg-[#6a8036]">
                            <TableRow>
                              <TableHead className="text-[10px] uppercase font-black px-8 py-6 text-white w-[18%]">Date & Statut</TableHead>
                              <TableHead className="text-center text-[10px] uppercase font-black px-4 py-6 text-white w-[10%]">Ouverture</TableHead>
                              <TableHead className="text-right text-[10px] uppercase font-black px-4 py-6 text-white w-[12%]">Fonds Initial</TableHead>
                              <TableHead className="text-right text-[10px] uppercase font-black px-4 py-6 text-white w-[12%]">FLUX (Net)</TableHead>
                              <TableHead className="text-right text-[10px] uppercase font-black px-4 py-6 text-white w-[12%]">Versement</TableHead>
                              <TableHead className="text-right text-[10px] uppercase font-black px-4 py-6 text-white w-[12%]">Fonds Final</TableHead>
                              <TableHead className="text-center text-[10px] uppercase font-black px-4 py-6 text-white w-[10%]">Clôture</TableHead>
                              <TableHead className="text-right text-[10px] uppercase font-black px-8 py-6 text-white w-[14%]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.sessions.map((s: any) => {
                              const initial = roundAmount(s?.openingBalance || 0);
                              const sales = roundAmount(s?.totalSales || 0);
                              const expenses = roundAmount(s?.totalExpenses || 0);
                              const versements = roundAmount(s?.totalVersements || 0);
                              const flux = roundAmount(sales - expenses);
                              const reel = roundAmount(s?.closingBalanceReal !== undefined ? s.closingBalanceReal : (initial + flux - versements));
                              const isSun = s?.date ? isSunday(parseISO(s.date)) : false;

                              return (
                                <TableRow key={s?.id} className={cn("hover:bg-slate-50 border-b transition-colors", isSun && "bg-red-100/50 hover:bg-red-200/50")}>
                                  <TableCell className="px-8 py-5">
                                    <div className="flex flex-col">
                                      <div className="flex items-center gap-2">
                                        <span className={cn("font-black text-sm uppercase", isSun ? "text-red-700" : "text-slate-800")}>{formatSessionDate(s?.date)}</span>
                                      </div>
                                      <span className={cn("text-[8px] font-black uppercase mt-1", s?.status === "OPEN" ? "text-green-600" : "text-red-500")}>
                                        {s?.status === "OPEN" ? "En cours" : "Clôturée"}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="px-4 py-5 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <Clock className="h-3 w-3 text-green-500/50" />
                                      <span className="text-[11px] font-black text-green-600 tabular-nums">{formatTime(s?.openedAt)}</span>
                                    </div>
                                  </TableCell>
                                  
                                  <TableCell className="text-right px-4 py-5 font-black text-xs tabular-nums text-slate-600">{formatCurrency(initial)}</TableCell>
                                  <TableCell className="text-right px-4 py-5">
                                    <span className={cn("font-black text-xs tabular-nums", flux >= 0 ? "text-emerald-600" : "text-red-500")}>
                                      {formatCurrency(flux)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right px-4 py-5"><span className="font-black text-xs tabular-nums text-orange-600">-{formatCurrency(Math.abs(versements))}</span></TableCell>
                                  <TableCell className="text-right px-4 py-5 font-black text-sm tabular-nums text-slate-900">{formatCurrency(reel)}</TableCell>

                                  <TableCell className="px-4 py-5 text-center">
                                    {s?.status === "CLOSED" ? (
                                      <div className="flex items-center justify-center gap-1.5">
                                        <Clock className="h-3 w-3 text-red-500/50" />
                                        <span className="text-[11px] font-black text-red-500 tabular-nums">{formatTime(s?.closedAt)}</span>
                                      </div>
                                    ) : <span className="text-[9px] font-black uppercase text-slate-300">---</span>}
                                  </TableCell>
                                  <TableCell className="text-right px-8 py-5">
                                    <DropdownMenu modal={false}>
                                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10"><MoreVertical className="h-4 w-4 text-slate-400" /></Button></DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="rounded-2xl p-2 min-w-[180px]">
                                        <DropdownMenuItem onClick={() => router.push(`/caisse?date=${s?.date}`)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl"><ArrowRight className="mr-3 h-4 w-4 text-primary" /> Détails</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExportDayTransactions(s)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl"><FileSpreadsheet className="mr-3 h-4 w-4 text-green-600" /> Excel</DropdownMenuItem>
                                        {role === 'ADMIN' && s?.status === "CLOSED" && (
                                          <DropdownMenuItem onClick={() => handleReopenSession(s)} className="text-orange-600 py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl"><RotateCcw className="mr-3 h-4 w-4" /> Ré-ouvrir</DropdownMenuItem>
                                        )}
                                        {isAdminOrPrepa && <DropdownMenuItem onClick={() => handleDeleteSession(s)} className="text-red-500 py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl"><Trash2 className="mr-3 h-4 w-4" /> Supprimer</DropdownMenuItem>}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })
          ) : (
            <div className="text-center py-48 bg-white rounded-[40px] border opacity-20">
              <TrendingUp className="h-16 w-16 mx-auto mb-4" />
              <span className="text-xs font-black uppercase tracking-[0.5em]">Aucune session enregistrée</span>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
