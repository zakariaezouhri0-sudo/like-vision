
"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
  CalendarClock, 
  Loader2, 
  User as UserIcon, 
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  History,
  Clock,
  Eye,
  Landmark,
  MoreVertical,
  Trash2,
  AlertTriangle,
  FileText
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
  const { data: rawSessions, isLoading, error } = useCollection(sessionsQuery);

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
      <div className="space-y-6 pb-10">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-slate-900 text-white rounded-[20px] flex items-center justify-center shadow-xl">
            <CalendarClock className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter leading-none">Journal des Sessions {isPrepaMode ? "(Brouillon)" : ""}</h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em] mt-1 opacity-60">Historique complet du magasin.</p>
          </div>
        </div>

        <Card className="shadow-sm border-none overflow-hidden rounded-[32px] bg-white">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                  <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Chargement du journal...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/80 border-b">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-black px-6 py-6 tracking-widest">Date & Statut</TableHead>
                      <TableHead className="text-[10px] uppercase font-black px-6 py-6 tracking-widest">Ouvert par</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest">Solde Initial</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest">Flux (Op)</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest">Versements</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest">Solde Final</TableHead>
                      <TableHead className="text-[10px] uppercase font-black px-6 py-6 tracking-widest">Clôturé par</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.length > 0 ? (
                      sessions.map((s: any) => {
                        const sunday = isSunday(s.date);
                        const openedDate = s.openedAt?.toDate ? s.openedAt.toDate() : null;
                        const closedDate = s.closedAt?.toDate ? s.closedAt.toDate() : null;
                        
                        const soldeCloture = sunday ? (s.openingBalance || 0) : (s.closingBalanceReal || 0);
                        const fluxOp = sunday ? 0 : (s.totalSales !== undefined && s.totalExpenses !== undefined) ? (s.totalSales - Math.abs(s.totalExpenses)) : 0;
                        const versement = sunday ? 0 : (s.totalVersements || 0);

                        return (
                          <TableRow key={s.id} className={cn(
                            "hover:bg-primary/5 border-b last:border-0 transition-all",
                            sunday && "bg-red-50 hover:bg-red-100/80"
                          )}>
                            <TableCell className="px-6 py-6" colSpan={sunday ? 1 : 1}>
                              <div className={cn("flex items-center gap-3", sunday && "justify-center")}>
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className={cn("h-4 w-4", sunday ? "text-red-500" : "text-primary/40")} />
                                  <span className={cn("font-black text-sm tracking-tight", sunday ? "text-red-600 text-base" : "text-slate-800")}>
                                    {formatSessionDate(s.date)}
                                  </span>
                                </div>
                                {!sunday && (
                                  <div className={cn("h-2 w-2 rounded-full", s.status === "OPEN" ? "bg-green-500 animate-pulse" : "bg-red-400")} />
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="px-6 py-6">
                              {!sunday ? (
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-0.5">
                                    <Clock className="h-2.5 w-2.5 inline mr-1" />{openedDate ? format(openedDate, "HH:mm") : "--:--"}
                                  </span>
                                  <span className="text-[9px] font-black text-slate-700 uppercase truncate max-w-[100px]">{s.openedBy || "---"}</span>
                                </div>
                              ) : null}
                            </TableCell>
                            
                            <TableCell className="text-right px-6 py-6 font-black text-sm tabular-nums">
                              {formatCurrency(s.openingBalance || 0)}
                            </TableCell>

                            <TableCell className="text-right px-6 py-6 whitespace-nowrap">
                              {sunday ? <span className="text-[10px] font-bold text-red-200">0,00 DH</span> : (
                                <div className={cn("flex items-center justify-end gap-1.5 font-black text-sm", fluxOp >= 0 ? "text-green-600" : "text-destructive")}>
                                  {fluxOp > 0 ? "+" : ""}{formatCurrency(fluxOp)}
                                </div>
                              )}
                            </TableCell>

                            <TableCell className="text-right px-6 py-6 whitespace-nowrap">
                              {sunday ? <span className="text-[10px] font-bold text-red-200">0,00 DH</span> : (
                                <div className="font-black text-sm text-orange-600">-{formatCurrency(Math.abs(versement))}</div>
                              )}
                            </TableCell>

                            <TableCell className="text-right px-6 py-6 font-black text-sm tabular-nums text-slate-900">
                              {formatCurrency(soldeCloture)}
                            </TableCell>

                            <TableCell className="px-6 py-6">
                              {!sunday ? (
                                s.status === "CLOSED" ? (
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-0.5">
                                      <Clock className="h-2.5 w-2.5 inline mr-1" />{closedDate ? format(closedDate, "HH:mm") : "--:--"}
                                    </span>
                                    <span className="text-[9px] font-black text-slate-700 uppercase truncate max-w-[100px]">{s.closedBy || "---"}</span>
                                  </div>
                                ) : <span className="text-[9px] font-black text-slate-200 uppercase tracking-widest">En cours</span>
                              ) : null}
                            </TableCell>

                            <TableCell className="text-right px-6 py-6">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => router.push(`/caisse?date=${s.date}`)} className="h-9 px-4 rounded-xl font-black text-[10px] uppercase border-primary text-primary">Détails</Button>
                                <DropdownMenu modal={false}>
                                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9"><MoreVertical className="h-4 w-4 text-slate-400" /></Button></DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="rounded-xl p-2 min-w-[160px]">
                                    <DropdownMenuItem onClick={() => router.push(`/rapports/print/journalier?date=${s.date}`)} className="py-2.5 font-black text-[10px] uppercase rounded-xl"><FileText className="mr-3 h-4 w-4 text-primary" /> Rapport</DropdownMenuItem>
                                    {isAdminOrPrepa && <DropdownMenuItem onClick={() => handleDeleteSession(s.id)} className="text-red-500 py-2.5 font-black text-[10px] uppercase rounded-xl"><Trash2 className="mr-3 h-4 w-4" /> Supprimer</DropdownMenuItem>}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow><TableCell colSpan={8} className="text-center py-40 text-xs font-black uppercase opacity-20 tracking-widest">Aucune session enregistrée.</TableCell></TableRow>
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
