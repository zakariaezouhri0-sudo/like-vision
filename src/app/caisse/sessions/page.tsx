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
  FileSpreadsheet
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, cn, roundAmount } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, deleteDoc, doc, writeBatch, getDocs, where, Timestamp } from "firebase/firestore";
import { format, parseISO, isSunday, isValid, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import React from "react";
import * as XLSX from "xlsx";

export default function CashSessionsPage() {
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [role, setRole] = useState<string>("OPTICIENNE");
  const [loadingRole, setLoadingRole] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role') || "OPTICIENNE";
    setRole(savedRole.toUpperCase());
    setLoadingRole(false);
  }, []);

  const isAdminOrPrepa = role === 'ADMIN' || role === 'PREPA';
  const isPrepaMode = role === "PREPA";

  const sessionsQuery = useMemoFirebase(() => query(collection(db, "cash_sessions")), [db]);
  const { data: rawSessions, isLoading } = useCollection(sessionsQuery);

  const groupedSessions = useMemo(() => {
    if (!rawSessions) return [];
    
    const filtered = [...rawSessions]
      .filter(s => isPrepaMode ? s.isDraft === true : (s.isDraft !== true))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const groups: { monthLabel: string; sessions: any[]; totalFlux: number }[] = [];
    filtered.forEach(s => {
      if (!s.date) return;
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
      toast({ variant: "success", title: "Session et transactions supprimées" });
    } catch (e) { 
      console.error(e);
      toast({ variant: "destructive", title: "Erreur lors de la suppression" }); 
    }
  };

  const handleExportMonth = (sessions: any[], monthLabel: string) => {
    const data = sessions.map(s => {
      const initial = roundAmount(s.openingBalance || 0);
      const sales = roundAmount(s.totalSales || 0);
      const expenses = roundAmount(s.totalExpenses || 0);
      const versements = roundAmount(s.totalVersements || 0);
      const flux = roundAmount(sales - expenses);
      const reel = roundAmount(s.closingBalanceReal !== undefined ? s.closingBalanceReal : (initial + flux - versements));
      
      let formattedDate = s.date;
      try {
        const d = parseISO(s.date);
        if (isValid(d)) formattedDate = format(d, "dd-MM-yyyy");
      } catch (e) {}

      return {
        "Date": formattedDate,
        "Statut": s.status === "OPEN" ? "En cours" : "Clôturée",
        "Ouvert par": s.openedBy || "---",
        "Clôturé par": s.closedBy || "---",
        "Solde Initial": initial,
        "Total Ventes": sales,
        "Total Dépenses": expenses,
        "Total Versements": versements,
        "Flux Net": flux,
        "Solde Final": reel,
        "Écart": roundAmount(s.discrepancy || 0)
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Journal de Caisse");
    XLSX.writeFile(workbook, `Like Vision - Sessions ${monthLabel}.xlsx`);
    
    toast({ variant: "success", title: "Export réussi" });
  };

  const handleExportDayTransactions = async (session: any) => {
    toast({ title: "Génération de l'Excel...", description: "Veuillez patienter." });
    try {
      const dateStart = startOfDay(parseISO(session.date));
      const dateEnd = endOfDay(parseISO(session.date));
      const isPrepa = session.isDraft === true;
      
      const qTrans = query(collection(db, "transactions"), where("isDraft", "==", isPrepa));
      const snapTrans = await getDocs(qTrans);
      const trans = snapTrans.docs
        .map(d => ({ ...d.data(), id: d.id }))
        .filter((t: any) => {
          const d = t.createdAt?.toDate ? t.createdAt.toDate() : null;
          return d && d >= dateStart && d <= endOfDay(d);
        });

      const qSales = query(collection(db, "sales"), where("isDraft", "==", isPrepa));
      const snapSales = await getDocs(qSales);
      const salesMap: Record<string, any> = {};
      snapSales.docs.forEach(doc => {
        const data = doc.data();
        if (data.invoiceId) salesMap[data.invoiceId] = data;
      });

      // GROUPEMENT POUR L'EXCEL
      const nouvellesVentes = trans.filter((t: any) => t.type === "VENTE" && t.isBalancePayment !== true);
      const sorties = trans.filter((t: any) => t.type !== "VENTE");
      const reglements = trans.filter((t: any) => t.type === "VENTE" && t.isBalancePayment === true);

      const mapToExcelRow = (t: any) => {
        let invoiceId = t.relatedId || "";
        if (!invoiceId && t.label?.includes('VENTE')) {
          invoiceId = t.label.replace('VENTE ', '').trim();
        }
        const sale = salesMap[invoiceId];
        const isVente = t.type === "VENTE";
        const totalNet = sale ? roundAmount(Number(sale.total) - (Number(sale.remise) || 0)) : null;
        const movement = Math.abs(t.montant);
        let displayLabel = isVente ? (sale?.notes || "") : (t.type === "VERSEMENT" ? `VERSEMENT | ${t.label || "BANQUE"}` : (t.label || "---"));

        return {
          "Réf": isVente ? (invoiceId ? invoiceId.slice(-4) : "---") : "---",
          "Heure": t.createdAt?.toDate ? format(t.createdAt.toDate(), "HH:mm") : "--:--",
          "Libellé": displayLabel,
          "Nom client": t.clientName || "---",
          "Montant Total": isVente && totalNet !== null ? formatCurrency(totalNet, false) : "",
          "Mouvement (Avance)": isVente ? formatCurrency(movement, false) : "",
          "SORTIE": !isVente ? formatCurrency(movement, false) : ""
        };
      };

      const excelRows = [
        ...nouvellesVentes.map(mapToExcelRow),
        {}, // Ligne vide
        ...sorties.map(mapToExcelRow),
        {}, // Ligne vide
        ...reglements.map(mapToExcelRow)
      ];

      const worksheet = XLSX.utils.json_to_sheet(excelRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Opérations");
      XLSX.writeFile(workbook, `Like Vision - Opérations ${session.date}.xlsx`);
      
      toast({ variant: "success", title: "Export Excel réussi" });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "Erreur lors de l'export" });
    }
  };

  if (loadingRole) return null;

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
              <div className="flex items-center gap-2 mt-2">
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border",
                  isPrepaMode ? "bg-orange-50 text-orange-600 border-orange-100" : "bg-blue-50 text-blue-600 border-blue-100"
                )}>
                  Mode {isPrepaMode ? "ZAKARIAE" : "Réel"}
                </span>
              </div>
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
                      "flex items-center justify-between px-8 py-5 cursor-pointer transition-colors select-none",
                      isExpanded ? "bg-primary text-white" : "bg-slate-50 hover:bg-slate-100 text-primary"
                    )}
                    onClick={() => toggleMonth(group.monthLabel)}
                  >
                    <div className="flex items-center gap-4">
                      {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      <span className="text-base font-black uppercase tracking-[0.2em]">{group.monthLabel}</span>
                    </div>

                    {isAdminOrPrepa && (
                      <div className="hidden md:flex flex-col items-center">
                        <span className={cn("text-[8px] font-black uppercase tracking-[0.2em] mb-0.5", isExpanded ? "text-white/50" : "text-slate-400")}>FLUX NET TOTAL</span>
                        <span className={cn("text-lg font-black tabular-nums", isExpanded ? "text-white" : (group.totalFlux > 0 ? "text-emerald-600" : "text-red-500"))}>
                          {formatCurrency(group.totalFlux).replace('+', '')}
                        </span>
                      </div>
                    )}

                    <Button 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); handleExportMonth(group.sessions, group.monthLabel); }}
                      className={cn(
                        "h-9 px-4 rounded-xl font-black text-[9px] uppercase shadow-lg transition-all",
                        isExpanded ? "bg-white text-primary hover:bg-slate-100" : "bg-primary text-white"
                      )}
                    >
                      <Download className="mr-2 h-3.5 w-3.5" /> EXCEL DU MOIS
                    </Button>
                  </div>

                  {isExpanded && (
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table className="min-w-[1200px]">
                          <TableHeader className="bg-slate-800">
                            <TableRow>
                              <TableHead className="text-[10px] uppercase font-black px-8 py-6 text-white">Date & Statut</TableHead>
                              <TableHead className="text-[10px] uppercase font-black px-6 py-6 text-white">Ouverture</TableHead>
                              <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 text-white">Fonds Initial</TableHead>
                              <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 text-white">FLUX (Net)</TableHead>
                              <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 text-white">Versement</TableHead>
                              <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 text-white">Fonds Final</TableHead>
                              <TableHead className="text-[10px] uppercase font-black px-6 py-6 text-white">Clôture</TableHead>
                              <TableHead className="text-right text-[10px] uppercase font-black px-8 py-6 text-white">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.sessions.map((s: any) => {
                              const initial = roundAmount(s.openingBalance || 0);
                              const sales = roundAmount(s.totalSales || 0);
                              const expenses = roundAmount(s.totalExpenses || 0);
                              const versements = roundAmount(s.totalVersements || 0);
                              const flux = roundAmount(sales - expenses);
                              const reel = roundAmount(s.closingBalanceReal !== undefined ? s.closingBalanceReal : (initial + flux - versements));
                              
                              const isSun = s.date ? isSunday(parseISO(s.date)) : false;

                              return (
                                <TableRow 
                                  key={s.id} 
                                  className={cn(
                                    "hover:bg-slate-50/80 border-b",
                                    isSun && "bg-red-50/80 hover:bg-red-100/80"
                                  )}
                                >
                                  <TableCell className="px-8 py-5">
                                    <div className="flex flex-col">
                                      <span className="font-black text-xs uppercase text-slate-800">{formatSessionDate(s.date)}</span>
                                      <span className={cn("text-[8px] font-black uppercase mt-1", s.status === "OPEN" ? "text-green-600" : "text-red-500")}>
                                        {s.status === "OPEN" ? "En cours" : "Clôturée"}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="px-6 py-5">
                                    <div className="flex flex-col">
                                      <span className="text-[11px] font-black text-green-600 tabular-nums"><Clock className="inline h-3 w-3 mr-1" /> {formatTime(s.openedAt)}</span>
                                      <span className="text-[9px] font-bold text-slate-500 uppercase">{s.openedBy || "---"}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right px-6 py-5 font-black text-sm tabular-nums">{formatCurrency(initial)}</TableCell>
                                  <TableCell className="text-right px-6 py-5">
                                    <span className={cn("font-black text-xs tabular-nums", flux >= 0 ? "text-emerald-600" : "text-red-500")}>
                                      {formatCurrency(flux)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right px-6 py-5"><span className="font-black text-xs tabular-nums text-orange-600">-{formatCurrency(Math.abs(versements))}</span></TableCell>
                                  <TableCell className="text-right px-6 py-5 font-black text-sm tabular-nums">{formatCurrency(reel)}</TableCell>
                                  <TableCell className="px-6 py-5">
                                    {s.status === "CLOSED" ? (
                                      <div className="flex flex-col">
                                        <span className="text-[11px] font-black text-red-500 tabular-nums"><Clock className="inline h-3 w-3 mr-1" /> {formatTime(s.closedAt)}</span>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">{s.closedBy || "---"}</span>
                                      </div>
                                    ) : <span className="text-[9px] font-black uppercase text-slate-300 italic">En cours...</span>}
                                  </TableCell>
                                  <TableCell className="text-right px-8 py-5">
                                    <DropdownMenu modal={false}>
                                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-slate-100"><MoreVertical className="h-4 w-4 text-slate-400" /></Button></DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="rounded-2xl p-2 min-w-[180px]">
                                        <DropdownMenuItem onClick={() => router.push(`/caisse?date=${s.date}`)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl"><ArrowRight className="mr-3 h-4 w-4 text-primary" /> Détails</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => router.push(`/rapports/print/journalier?date=${s.date}`)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl"><FileText className="mr-3 h-4 w-4 text-primary" /> Voir Rapport</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleExportDayTransactions(s)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl"><FileSpreadsheet className="mr-3 h-4 w-4 text-green-600" /> Excel Opérations</DropdownMenuItem>
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
