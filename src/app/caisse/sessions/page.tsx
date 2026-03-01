
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
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em] mt-1 opacity-60">Historique et vérification des écarts.</p>
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
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest">Solde Initial</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest text-primary">Calcul Théorique</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest">Solde Réel (Compté)</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest">Écart</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest">Actions</TableHead>
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
                        
                        // Calcul théorique : Initial + Ventes - Dépenses - Versements
                        const theorique = sunday ? initial : (initial + sales - expenses - versements);
                        const reel = sunday ? initial : (s.closingBalanceReal !== undefined ? s.closingBalanceReal : theorique);
                        const discrepancy = reel - theorique;

                        return (
                          <TableRow key={s.id} className={cn(
                            "hover:bg-primary/5 border-b last:border-0 transition-all",
                            sunday && "bg-red-50 hover:bg-red-100/80"
                          )}>
                            <TableCell className="px-6 py-6">
                              <div className={cn("flex items-center gap-3", sunday && "justify-center")}>
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className={cn("h-4 w-4", sunday ? "text-red-500" : "text-primary/40")} />
                                  <span className={cn("font-black text-sm tracking-tight", sunday ? "text-red-600" : "text-slate-800")}>
                                    {formatSessionDate(s.date)}
                                  </span>
                                </div>
                                {!sunday && (
                                  <div className={cn("h-2 w-2 rounded-full", s.status === "OPEN" ? "bg-green-500 animate-pulse" : "bg-red-400")} />
                                )}
                              </div>
                            </TableCell>
                            
                            <TableCell className="text-right px-6 py-6 font-black text-sm tabular-nums text-slate-400">
                              {formatCurrency(initial)}
                            </TableCell>

                            <TableCell className="text-right px-6 py-6 font-black text-sm tabular-nums text-primary/60">
                              {formatCurrency(theorique)}
                            </TableCell>

                            <TableCell className="text-right px-6 py-6 font-black text-sm tabular-nums text-slate-900">
                              {formatCurrency(reel)}
                            </TableCell>

                            <TableCell className="text-right px-6 py-6">
                              {sunday ? <span className="text-[10px] font-bold text-slate-300">---</span> : (
                                <div className={cn(
                                  "font-black text-sm tabular-nums",
                                  Math.abs(discrepancy) < 0.01 ? "text-green-600" : "text-destructive"
                                )}>
                                  {discrepancy > 0 ? "+" : ""}{formatCurrency(discrepancy)}
                                </div>
                              )}
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
                      <TableRow><TableCell colSpan={6} className="text-center py-40 text-xs font-black uppercase opacity-20 tracking-widest">Aucune session enregistrée.</TableCell></TableRow>
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
