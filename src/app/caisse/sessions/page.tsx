
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  CalendarClock, 
  FileText, 
  Loader2, 
  User as UserIcon, 
  Lock, 
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  History,
  Clock,
  Eye,
  Landmark,
  MoreVertical,
  Trash2,
  AlertTriangle
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, where, deleteDoc, doc } from "firebase/firestore";
import { format, getDay } from "date-fns";
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

  const sessionsQuery = useMemoFirebase(() => {
    return query(collection(db, "cash_sessions"), orderBy("date", "desc"));
  }, [db]);

  const { data: rawSessions, isLoading, error } = useCollection(sessionsQuery);

  const sessions = useMemo(() => {
    if (!rawSessions) return [];
    return [...rawSessions]
      .filter(s => isPrepaMode ? s.isDraft === true : (s.isDraft !== true));
  }, [rawSessions, isPrepaMode]);

  const handleDeleteSession = async (id: string, date: string) => {
    if (!confirm(`Attention : Supprimer la session du ${date} ?`)) return;
    
    try {
      await deleteDoc(doc(db, "cash_sessions", id));
      toast({ variant: "success", title: "Session supprimée" });
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur lors de la suppression" });
    }
  };

  const isSunday = (dateStr: string) => {
    if (!dateStr) return false;
    try {
      const cleanDate = dateStr.substring(0, 10);
      const parts = cleanDate.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return getDay(d) === 0;
      }
      return false;
    } catch (e) { return false; }
  };

  const formatSessionDate = (dateStr: string) => {
    if (!dateStr) return "Date inconnue";
    try {
      const cleanDate = dateStr.substring(0, 10);
      const parts = cleanDate.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const day = parseInt(parts[2]);
        const d = new Date(year, month - 1, day);
        if (!isNaN(d.getTime())) {
          const formatted = format(d, "dd MMMM yyyy", { locale: fr });
          return formatted.charAt(0).toUpperCase() + formatted.slice(1);
        }
      }
      return cleanDate;
    } catch (e) {
      return dateStr;
    }
  };

  if (loadingRole) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  return (
    <AppShell>
      <div className="space-y-6 pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 bg-slate-900 text-white rounded-[20px] flex items-center justify-center shadow-xl">
              <CalendarClock className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-primary uppercase tracking-tighter leading-none">Journal des Sessions {isPrepaMode ? "(Brouillon)" : ""}</h1>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em] mt-1 opacity-60">Historique cloisonné par mode.</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-100 p-6 rounded-[24px] flex items-center gap-4 text-red-800">
            <AlertTriangle className="h-6 w-6 text-red-500 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-black uppercase tracking-tight">Erreur de chargement</p>
              <p className="text-xs font-bold opacity-70">{(error as any).message || "Impossible de récupérer les sessions."}</p>
            </div>
          </div>
        )}

        <Card className="shadow-sm border-none overflow-hidden rounded-[32px] bg-white">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em]">Analyse du journal...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/80 border-b">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-black px-6 py-6 tracking-widest whitespace-nowrap">Date & Statut</TableHead>
                      <TableHead className="text-[10px] uppercase font-black px-6 py-6 tracking-widest whitespace-nowrap">Ouvert par</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest whitespace-nowrap">Solde Initial</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest whitespace-nowrap">Flux (Op)</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest whitespace-nowrap">Versement</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest whitespace-nowrap">Solde Final</TableHead>
                      <TableHead className="text-[10px] uppercase font-black px-6 py-6 tracking-widest whitespace-nowrap">Clôturé par</TableHead>
                      {isAdminOrPrepa && <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest whitespace-nowrap">Écart</TableHead>}
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions && sessions.length > 0 ? (
                      sessions.map((s: any) => {
                        const openedDate = s.openedAt?.toDate ? s.openedAt.toDate() : null;
                        const closedDate = s.closedAt?.toDate ? s.closedAt.toDate() : null;
                        const sunday = isSunday(s.date);
                        
                        // Pour les dimanches, solde ouverture = solde cloture
                        const soldeCloture = sunday ? (s.openingBalance || 0) : (s.closingBalanceReal || 0);
                        const fluxOp = sunday ? 0 : (s.totalSales !== undefined && s.totalExpenses !== undefined) 
                          ? (s.totalSales - Math.abs(s.totalExpenses)) 
                          : null;
                        
                        const versement = sunday ? 0 : (s.totalVersements !== undefined ? Math.abs(s.totalVersements) : null);

                        return (
                          <TableRow key={s.id} className={cn(
                            "hover:bg-primary/5 border-b last:border-0 transition-all group",
                            sunday && "bg-red-50 hover:bg-red-100/80"
                          )}>
                            <TableCell className="px-6 py-6 whitespace-nowrap">
                              <div className={cn(
                                "flex items-center gap-3",
                                sunday && "justify-center"
                              )}>
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className={cn("h-4 w-4", sunday ? "text-red-400" : "text-primary/40")} />
                                  <span className={cn(
                                    "font-black text-sm tracking-tight",
                                    sunday ? "text-red-600" : "text-slate-800"
                                  )}>
                                    {formatSessionDate(s.date)}
                                  </span>
                                </div>
                                {!sunday && (
                                  <div 
                                    className={cn(
                                      "h-2.5 w-2.5 rounded-full shrink-0 transition-colors",
                                      s.status === "OPEN" ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.4)]"
                                    )} 
                                    title={s.status === "OPEN" ? "Ouverte" : "Clôturée"}
                                  />
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="px-6 py-6 whitespace-nowrap">
                              {!sunday ? (
                                <div className="flex flex-col">
                                  <div className={cn(
                                    "flex items-center gap-1 text-[9px] font-black uppercase tracking-widest mb-0.5",
                                    "text-green-600"
                                  )}>
                                    <Clock className="h-3 w-3" />
                                    {openedDate ? format(openedDate, "HH:mm") : "--:--"}
                                  </div>
                                  <div className="flex items-center gap-1.5 bg-white/50 px-2 py-0.5 rounded-lg border border-slate-100 w-fit">
                                    <UserIcon className="h-2.5 w-2.5 text-primary/30" />
                                    <span className="text-[9px] font-black text-slate-700 uppercase tracking-tighter truncate max-w-[100px]">
                                      {s.openedBy || "---"}
                                    </span>
                                  </div>
                                </div>
                              ) : <span className="text-[10px] font-black text-red-300 uppercase italic">Fermé</span>}
                            </TableCell>
                            
                            <TableCell className="text-right px-6 py-6 whitespace-nowrap">
                              <span className={cn("text-base font-black tracking-tighter", sunday ? "text-red-700" : "text-slate-900")}>
                                {formatCurrency(s.openingBalance || 0)}
                              </span>
                            </TableCell>

                            <TableCell className="text-right px-6 py-6 whitespace-nowrap">
                              {sunday ? (
                                <span className="text-[10px] font-bold text-red-200">0,00 DH</span>
                              ) : (s.status === "CLOSED" && fluxOp !== null ? (
                                <div className={cn(
                                  "flex items-center justify-end gap-1.5 font-black text-sm",
                                  fluxOp >= 0 ? "text-green-600" : "text-destructive"
                                )}>
                                  {fluxOp > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                  {formatCurrency(fluxOp)}
                                </div>
                              ) : (
                                <span className="text-xs font-bold text-slate-200">---</span>
                              ))}
                            </TableCell>

                            <TableCell className="text-right px-6 py-6 whitespace-nowrap">
                              {sunday ? (
                                <span className="text-[10px] font-bold text-red-200">0,00 DH</span>
                              ) : (s.status === "CLOSED" && versement !== null ? (
                                <div className="flex items-center justify-end gap-1.5 font-black text-sm text-orange-600">
                                  < Landmark className="h-3.5 w-3.5" />
                                  {formatCurrency(versement)}
                                </div>
                              ) : (
                                <span className="text-xs font-bold text-slate-200">---</span>
                              ))}
                            </TableCell>

                            <TableCell className="text-right px-6 py-6 whitespace-nowrap">
                              <span className={cn("text-base font-black tracking-tighter", sunday ? "text-red-700" : "text-slate-900")}>
                                {formatCurrency(soldeCloture)}
                              </span>
                            </TableCell>

                            <TableCell className="px-6 py-6 whitespace-nowrap">
                              {sunday ? (
                                <span className="text-[10px] font-black text-red-300 uppercase">Automatique</span>
                              ) : (s.status === "CLOSED" ? (
                                <div className="flex flex-col">
                                  <div className={cn(
                                    "flex items-center gap-1 text-[9px] font-black uppercase tracking-widest mb-0.5",
                                    "text-red-500"
                                  )}>
                                    <Clock className="h-3 w-3" />
                                    {closedDate ? format(closedDate, "HH:mm") : "--:--"}
                                  </div>
                                  <div className="flex items-center gap-1.5 bg-white/50 px-2 py-0.5 rounded-lg border border-slate-100 w-fit">
                                    <UserIcon className="h-2.5 w-2.5 text-primary/30" />
                                    <span className="text-[9px] font-black text-slate-700 uppercase tracking-tighter truncate max-w-[100px]">
                                      {s.closedBy || "---"}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 text-[9px] font-black text-slate-200 uppercase tracking-[0.2em]">
                                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  <span>En cours...</span>
                                </div>
                              ))}
                            </TableCell>

                            {isAdminOrPrepa && (
                              <TableCell className="text-right px-6 py-6 whitespace-nowrap">
                                {!sunday && s.status === "CLOSED" ? (
                                  <div className={cn(
                                    "flex items-center justify-end gap-2 px-3 py-2 rounded-xl border-2 w-fit ml-auto",
                                    Math.abs(s.discrepancy || 0) < 0.01 ? "bg-green-50 border-green-100 text-green-600" : "bg-red-50 border-red-100 text-red-600"
                                  )}>
                                    <span className="text-xs font-black tracking-tighter">
                                      {(s.discrepancy || 0) > 0 ? "+" : ""}{formatCurrency(s.discrepancy || 0)}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs font-bold text-slate-200">---</span>
                                )}
                              </TableCell>
                            )}

                            <TableCell className="text-right px-6 py-6 whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => router.push(`/caisse?date=${s.date}`)}
                                  className={cn(
                                    "h-10 px-4 rounded-xl font-black text-[10px] uppercase transition-all shadow-sm",
                                    sunday ? "border-red-200 text-red-600 bg-white" : "border-primary text-primary"
                                  )}
                                >
                                  <Eye className="mr-1.5 h-4 w-4" /> Détails
                                </Button>
                                
                                <DropdownMenu modal={false}>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-slate-100 rounded-xl">
                                      <MoreVertical className="h-5 w-5 text-slate-400" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-2xl border-slate-100 min-w-[180px]">
                                    <DropdownMenuItem 
                                      onClick={() => router.push(`/rapports/print/journalier?date=${s.date}`)}
                                      className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl"
                                    >
                                      <FileText className="mr-3 h-4 w-4 text-primary" /> Rapport
                                    </DropdownMenuItem>
                                    {isAdminOrPrepa && (
                                      <DropdownMenuItem 
                                        onClick={() => handleDeleteSession(s.id, s.date)}
                                        className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl text-destructive"
                                      >
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
                        <TableCell colSpan={isAdminOrPrepa ? 9 : 8} className="text-center py-40">
                          <div className="flex flex-col items-center gap-4 opacity-20">
                            <History className="h-12 w-12" />
                            <p className="text-xs font-black uppercase tracking-[0.4em]">Aucune session {isPrepaMode ? "brouillon" : "réelle"} enregistrée.</p>
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
