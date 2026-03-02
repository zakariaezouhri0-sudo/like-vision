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
  Download
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, cn, roundAmount } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, deleteDoc, doc } from "firebase/firestore";
import { format, parseISO, isSunday } from "date-fns";
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

    const groups: { monthLabel: string; sessions: any[] }[] = [];
    filtered.forEach(s => {
      if (!s.date) return;
      const date = parseISO(s.date);
      const monthLabel = format(date, "MMMM yyyy", { locale: fr });
      
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.monthLabel === monthLabel) {
        lastGroup.sessions.push(s);
      } else {
        groups.push({ monthLabel, sessions: [s] });
      }
    });
    
    return groups;
  }, [rawSessions, isPrepaMode]);

  // Expand the most recent month by default
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
    if (!dateStr) return "---";
    try {
      const d = parseISO(dateStr.substring(0, 10));
      return format(d, "dd MMMM yyyy", { locale: fr });
    } catch (e) { return dateStr; }
  };

  const formatTime = (ts: any) => {
    if (!ts) return "--:--";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return format(d, "HH:mm");
    } catch (e) { return "--:--"; }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm("Supprimer cette session ?")) return;
    try {
      await deleteDoc(doc(db, "cash_sessions", id));
      toast({ variant: "success", title: "Session supprimée" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); }
  };

  const handleExportMonth = (sessions: any[], monthLabel: string) => {
    const data = sessions.map(s => {
      const initial = roundAmount(s.openingBalance || 0);
      const sales = roundAmount(s.totalSales || 0);
      const expenses = roundAmount(s.totalExpenses || 0);
      const versements = roundAmount(s.totalVersements || 0);
      const flux = roundAmount(sales - expenses);
      const reel = roundAmount(s.closingBalanceReal !== undefined ? s.closingBalanceReal : (initial + flux - versements));
      
      return {
        "Date": s.date,
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
    
    toast({ variant: "success", title: "Export réussi", description: `Le rapport de ${monthLabel} a été généré.` });
  };

  if (loadingRole) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

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
                  Mode {isPrepaMode ? "Historique" : "Réel"}
                </span>
                <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest opacity-40">Traçabilité consolidée</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100 hidden lg:block">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Sessions Total</p>
            <p className="text-sm font-black text-primary">{rawSessions?.filter(s => isPrepaMode ? s.isDraft === true : !s.isDraft).length || 0}</p>
          </div>
        </div>

        <div className="space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em]">Lecture des données...</span>
            </div>
          ) : groupedSessions.length > 0 ? (
            groupedSessions.map((group) => {
              const isExpanded = expandedMonths.has(group.monthLabel);
              return (
                <Card key={group.monthLabel} className="shadow-xl border-none overflow-hidden rounded-[32px] bg-white">
                  {/* Month Header - Interactive */}
                  <div 
                    className={cn(
                      "flex items-center justify-between px-8 py-5 cursor-pointer transition-colors select-none",
                      isExpanded ? "bg-primary text-white" : "bg-slate-50 hover:bg-slate-100 text-primary"
                    )}
                    onClick={() => toggleMonth(group.monthLabel)}
                  >
                    <div className="flex items-center gap-4">
                      {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                      <div className="flex items-baseline gap-3">
                        <span className="text-base font-black uppercase tracking-[0.2em]">{group.monthLabel}</span>
                        <span className={cn("text-[10px] font-bold uppercase opacity-60", isExpanded ? "text-white" : "text-slate-400")}>
                          ({group.sessions.length} sessions)
                        </span>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={(e) => { e.stopPropagation(); handleExportMonth(group.sessions, group.monthLabel); }}
                      className={cn(
                        "h-9 px-4 rounded-xl font-black text-[9px] uppercase shadow-lg transition-all active:scale-95",
                        isExpanded ? "bg-white text-primary hover:bg-slate-100" : "bg-primary text-white"
                      )}
                    >
                      <Download className="mr-2 h-3.5 w-3.5" /> EXCEL DU MOIS
                    </Button>
                  </div>

                  {/* Sessions Table - Collapsible Content */}
                  {isExpanded && (
                    <CardContent className="p-0 animate-in slide-in-from-top-2 duration-300">
                      <div className="overflow-x-auto">
                        <Table className="min-w-[1200px]">
                          <TableHeader className="bg-slate-50/50 border-b">
                            <TableRow>
                              <TableHead className="text-[10px] uppercase font-black px-8 py-6 tracking-[0.2em] text-slate-400 whitespace-nowrap">Date & Statut</TableHead>
                              <TableHead className="text-[10px] uppercase font-black px-6 py-6 tracking-[0.2em] text-slate-400 whitespace-nowrap">Ouverture</TableHead>
                              <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-[0.2em] text-slate-400 whitespace-nowrap">Fonds Initial</TableHead>
                              <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-[0.2em] text-slate-400 whitespace-nowrap">FLUX (Net)</TableHead>
                              <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-[0.2em] text-orange-500 whitespace-nowrap">Versement</TableHead>
                              <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-[0.2em] text-slate-400 whitespace-nowrap">Fonds Final</TableHead>
                              <TableHead className="text-[10px] uppercase font-black px-6 py-6 tracking-[0.2em] text-slate-400 whitespace-nowrap">Clôture</TableHead>
                              <TableHead className="text-right text-[10px] uppercase font-black px-8 py-6 tracking-[0.2em] text-slate-400 whitespace-nowrap">Actions</TableHead>
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
                              
                              const dateObj = s.date ? parseISO(s.date) : new Date();
                              const isDaySunday = isSunday(dateObj);

                              return (
                                <TableRow key={s.id} className={cn(
                                  "hover:bg-slate-50/80 border-b last:border-0 transition-all group",
                                  isDaySunday && "bg-red-50/60 hover:bg-red-100/60"
                                )}>
                                  <TableCell className="px-8 py-5">
                                    <div className="flex items-center gap-4">
                                      <div className="h-10 w-10 rounded-xl bg-white border border-slate-100 text-primary/40 flex items-center justify-center shrink-0 shadow-sm">
                                        <CalendarIcon className="h-5 w-5" />
                                      </div>
                                      <div className="flex flex-col justify-center">
                                        <span className="font-black text-sm tracking-tight block uppercase text-slate-800 leading-none whitespace-nowrap">
                                          {formatSessionDate(s.date)}
                                        </span>
                                        <div className="flex items-center gap-1.5 mt-1.5 leading-none">
                                          <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", s.status === "OPEN" ? "bg-green-500 animate-pulse" : "bg-red-500")} />
                                          <span className={cn("text-[8px] font-black uppercase tracking-widest whitespace-nowrap", s.status === "OPEN" ? "text-green-600" : "text-red-500")}>
                                            {s.status === "OPEN" ? "En cours" : "Clôturée"}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>

                                  <TableCell className="px-6 py-5">
                                    <div className="flex flex-col">
                                      <span className="text-[11px] font-black text-green-600 tabular-nums flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> {formatTime(s.openedAt)}
                                      </span>
                                      <span className="text-[9px] font-bold text-slate-500 uppercase truncate max-w-[120px]">{s.openedBy || "---"}</span>
                                    </div>
                                  </TableCell>
                                  
                                  <TableCell className="text-right px-6 py-5 font-black text-sm tabular-nums text-slate-900">
                                    {formatCurrency(initial)}
                                  </TableCell>

                                  <TableCell className="text-right px-6 py-5">
                                    <span className={cn(
                                      "font-black text-xs tabular-nums",
                                      flux > 0 ? "text-emerald-600" : flux < 0 ? "text-red-500" : "text-slate-400"
                                    )}>
                                      {flux > 0 ? "+" : ""}{formatCurrency(flux)}
                                    </span>
                                  </TableCell>

                                  <TableCell className="text-right px-6 py-5">
                                    <span className="font-black text-xs tabular-nums text-orange-600">
                                      {formatCurrency(Math.abs(versements))}
                                    </span>
                                  </TableCell>

                                  <TableCell className="text-right px-6 py-5 font-black text-sm tabular-nums text-slate-900">
                                    {formatCurrency(reel)}
                                  </TableCell>

                                  <TableCell className="px-6 py-5">
                                    {s.status === "CLOSED" ? (
                                      <div className="flex flex-col">
                                        <span className="text-[11px] font-black text-red-500 tabular-nums flex items-center gap-1">
                                          <Clock className="h-3 w-3" /> {formatTime(s.closedAt)}
                                        </span>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase truncate max-w-[120px]">{s.closedBy || "---"}</span>
                                      </div>
                                    ) : (
                                      <span className="text-[9px] font-black uppercase text-slate-300 italic tracking-widest">En cours...</span>
                                    )}
                                  </TableCell>

                                  <TableCell className="text-right px-8 py-5">
                                    <div className="flex items-center justify-end">
                                      <DropdownMenu modal={false}>
                                        <DropdownMenuTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-slate-100">
                                            <MoreVertical className="h-4 w-4 text-slate-400" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-2xl p-2 min-w-[180px] shadow-2xl border-primary/5">
                                          <DropdownMenuItem onClick={() => router.push(`/caisse?date=${s.date}`)} className="py-3 font-black text-[10px] uppercase rounded-xl cursor-pointer">
                                            <ArrowRight className="mr-3 h-4 w-4 text-primary" /> Détails
                                          </DropdownMenuItem>
                                          <DropdownMenuItem onClick={() => router.push(`/rapports/print/journalier?date=${s.date}`)} className="py-3 font-black text-[10px] uppercase rounded-xl cursor-pointer">
                                            <FileText className="mr-3 h-4 w-4 text-primary" /> Voir Rapport
                                          </DropdownMenuItem>
                                          {isAdminOrPrepa && (
                                            <DropdownMenuItem onClick={() => handleDeleteSession(s.id)} className="text-red-500 py-3 font-black text-[10px] uppercase rounded-xl cursor-pointer">
                                              <Trash2 className="mr-3 h-4 w-4" /> Supprimer
                                            </DropdownMenuItem>
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
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
            <div className="text-center py-48 bg-white rounded-[40px] border shadow-sm">
              <div className="flex flex-col items-center opacity-20">
                <TrendingUp className="h-16 w-16 mb-4" />
                <span className="text-xs font-black uppercase tracking-[0.5em]">Aucune session enregistrée</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
