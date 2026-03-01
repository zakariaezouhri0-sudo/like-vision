
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
  User,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, deleteDoc, doc } from "firebase/firestore";
import { format, getDay, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

export default function CashSessionsPage() {
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [role, setRole] = useState<string>("OPTICIENNE");
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role') || "OPTICIENNE";
    setRole(savedRole.toUpperCase());
    setLoadingRole(false);
  }, []);

  const isAdminOrPrepa = role === 'ADMIN' || role === 'PREPA';
  const isPrepaMode = role === "PREPA";

  const sessionsQuery = useMemoFirebase(() => query(collection(db, "cash_sessions")), [db]);
  const { data: rawSessions, isLoading } = useCollection(sessionsQuery);

  const sessions = useMemo(() => {
    if (!rawSessions) return [];
    return [...rawSessions]
      .filter(s => isPrepaMode ? s.isDraft === true : (s.isDraft !== true))
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [rawSessions, isPrepaMode]);

  const isSunday = (dateStr: string) => {
    if (!dateStr) return false;
    try {
      const d = parseISO(dateStr.substring(0, 10));
      return getDay(d) === 0;
    } catch (e) { return false; }
  };

  const formatSessionDate = (dateStr: string) => {
    if (!dateStr) return "---";
    try {
      const d = parseISO(dateStr.substring(0, 10));
      return format(d, "dd MMMM yyyy", { locale: fr });
    } catch (e) { return dateStr; }
  };

  const formatTime = (ts: any) => {
    if (!ts) return "---";
    try {
      const d = ts.toDate ? ts.toDate() : new Date(ts);
      return format(d, "HH:mm");
    } catch (e) { return "---"; }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm("Supprimer cette session ?")) return;
    try {
      await deleteDoc(doc(db, "cash_sessions", id));
      toast({ variant: "success", title: "Session supprimée" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); }
  };

  if (loadingRole) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  return (
    <AppShell>
      <div className="space-y-8 pb-10">
        {/* Header Section */}
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
                <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest opacity-40">Historique consolidé</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-slate-50 px-4 py-3 rounded-2xl border border-slate-100 hidden lg:block">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Sessions</p>
              <p className="text-sm font-black text-primary">{sessions.length}</p>
            </div>
          </div>
        </div>

        {/* Sessions Table Card */}
        <Card className="shadow-2xl border-none overflow-hidden rounded-[40px] bg-white">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em]">Lecture des données...</span>
                </div>
              ) : (
                <Table className="min-w-[1200px]">
                  <TableHeader className="bg-slate-50/50 border-b">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-black px-8 py-7 tracking-[0.2em] text-slate-400">Date & Statut</TableHead>
                      <TableHead className="text-[10px] uppercase font-black px-6 py-7 tracking-[0.2em] text-slate-400">Ouverture / Par</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-7 tracking-[0.2em] text-slate-400">Solde Ouv.</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-7 tracking-[0.2em] text-slate-400">Flux Net</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-7 tracking-[0.2em] text-orange-500">Versement</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-7 tracking-[0.2em] text-slate-400">Solde Clôt.</TableHead>
                      <TableHead className="text-[10px] uppercase font-black px-6 py-7 tracking-[0.2em] text-slate-400">Clôture / Par</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-8 py-7 tracking-[0.2em] text-slate-400">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.length > 0 ? (
                      sessions.map((s: any) => {
                        const sunday = isSunday(s.date);
                        const initial = s.openingBalance || 0;
                        const sales = s.totalSales || 0;
                        const expenses = s.totalExpenses || 0;
                        const versements = s.totalVersements || 0;
                        
                        const flux = sales - expenses;
                        const theorique = initial + flux - versements;
                        const reel = s.closingBalanceReal !== undefined ? s.closingBalanceReal : theorique;

                        return (
                          <TableRow key={s.id} className={cn(
                            "hover:bg-slate-50/80 border-b last:border-0 transition-all group",
                            sunday && "bg-red-50/30 hover:bg-red-50/60"
                          )}>
                            <TableCell className="px-8 py-6">
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm border",
                                  sunday ? "bg-red-100 border-red-200 text-red-600" : "bg-white border-slate-100 text-primary/40"
                                )}>
                                  <CalendarIcon className="h-5 w-5" />
                                </div>
                                <div>
                                  <span className={cn("font-black text-sm tracking-tight block uppercase", sunday ? "text-red-600" : "text-slate-800")}>
                                    {formatSessionDate(s.date)}
                                  </span>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <div className={cn("h-1.5 w-1.5 rounded-full", s.status === "OPEN" ? "bg-green-500 animate-pulse" : "bg-slate-300")} />
                                    <span className={cn("text-[8px] font-black uppercase tracking-widest", s.status === "OPEN" ? "text-green-600" : "text-slate-400")}>
                                      {s.status === "OPEN" ? "En cours" : "Clôturée"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="px-6 py-6">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1.5 text-green-600 mb-0.5">
                                  <Clock className="h-3 w-3" />
                                  <span className="text-[11px] font-black tabular-nums tracking-tighter">{formatTime(s.openedAt)}</span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase truncate max-w-[120px]">{s.openedBy || "---"}</span>
                              </div>
                            </TableCell>
                            
                            <TableCell className="text-right px-6 py-6 font-black text-xs tabular-nums text-slate-400">
                              {formatCurrency(initial)}
                            </TableCell>

                            <TableCell className="text-right px-6 py-6">
                              <div className={cn(
                                "inline-flex flex-col items-end px-3 py-1.5 rounded-xl border tabular-nums min-w-[100px]",
                                flux >= 0 ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-slate-50 border-slate-100 text-slate-600"
                              )}>
                                <span className="text-xs font-black">
                                  {flux > 0 ? "+" : ""}{formatCurrency(flux)}
                                </span>
                                <span className="text-[7px] font-black uppercase tracking-widest opacity-60">Net Journalier</span>
                              </div>
                            </TableCell>

                            <TableCell className="text-right px-6 py-6">
                              <span className="font-black text-xs tabular-nums text-orange-600 bg-orange-50 px-2 py-1 rounded-lg">
                                -{formatCurrency(versements)}
                              </span>
                            </TableCell>

                            <TableCell className="text-right px-6 py-6">
                              <div className="flex flex-col items-end">
                                <span className="text-sm font-black tabular-nums text-slate-900">{formatCurrency(reel)}</span>
                                {Math.abs(s.discrepancy || 0) > 0.01 && (
                                  <span className="text-[8px] font-black text-red-500 uppercase tracking-tighter mt-0.5">
                                    Écart: {formatCurrency(s.discrepancy)}
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="px-6 py-6">
                              {s.status === "CLOSED" ? (
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5 text-red-500 mb-0.5">
                                    <Clock className="h-3 w-3" />
                                    <span className="text-[11px] font-black tabular-nums tracking-tighter">{formatTime(s.closedAt)}</span>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-500 uppercase truncate max-w-[120px]">{s.closedBy || "---"}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-slate-300">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  <span className="text-[9px] font-black uppercase tracking-widest italic">Attente...</span>
                                </div>
                              )}
                            </TableCell>

                            <TableCell className="text-right px-8 py-6">
                              <div className="flex items-center justify-end gap-3">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => router.push(`/caisse?date=${s.date}`)} 
                                  className="h-10 px-5 rounded-xl font-black text-[10px] uppercase border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                                >
                                  Détails
                                </Button>
                                <DropdownMenu modal={false}>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl hover:bg-slate-100">
                                      <MoreVertical className="h-4 w-4 text-slate-400" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="rounded-2xl p-2 min-w-[180px] shadow-2xl border-primary/5">
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
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-48">
                          <div className="flex flex-col items-center opacity-20">
                            <TrendingUp className="h-16 w-16 mb-4" />
                            <span className="text-xs font-black uppercase tracking-[0.5em]">Aucune session enregistrée</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
