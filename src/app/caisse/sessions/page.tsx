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
  Loader2, 
  FileText, 
  RotateCcw,
  Clock,
  ChevronRight,
  Trash2,
  MoreVertical
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { cn, formatCurrency, roundAmount } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, updateDoc, doc, query, orderBy, deleteDoc, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid, getDay } from "date-fns";
import { fr } from "date-fns/locale";

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

  if (!isClientReady || loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-primary uppercase tracking-tighter">Historique des Sessions</h1>
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">Journal des clôtures de caisse.</p>
        </div>
        <Button onClick={() => router.push('/caisse')} variant="outline" className="h-12 px-6 rounded-xl font-black text-[10px] uppercase border-primary/20 bg-white text-primary shadow-sm">
          <RotateCcw className="mr-2 h-4 w-4" /> RETOUR CAISSE
        </Button>
      </div>

      <Card className="rounded-[32px] overflow-hidden bg-white shadow-sm border-none">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#6a8036]">
              <TableRow>
                <TableHead className="text-[10px] uppercase font-black px-8 py-5 text-white">Date</TableHead>
                <TableHead className="text-[10px] uppercase font-black px-2 py-5 text-white text-center">Statut</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-black px-2 py-5 text-white">Initial</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-black px-2 py-5 text-white">Ventes</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-black px-2 py-5 text-white">Sorties</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-black px-2 py-5 text-white">Final (Réel)</TableHead>
                <TableHead className="text-right text-[10px] uppercase font-black px-8 py-5 text-white w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-20 text-[10px] font-black uppercase opacity-20 tracking-widest">Aucune session enregistrée.</TableCell></TableRow>
              ) : (
                sessions.map((s: any) => {
                  const d = parseISO(s.date);
                  const isSunday = isValid(d) && getDay(d) === 0;
                  const isClosed = s.status === "CLOSED";

                  return (
                    <TableRow key={s.id} className={cn("hover:bg-slate-50 transition-all border-b", isSunday && "bg-red-50/30")}>
                      <TableCell className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-800 uppercase">
                            {isValid(d) ? format(d, "dd MMMM yyyy", { locale: fr }) : s.date}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400">Par: {s.closedBy || s.openedBy || "---"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center px-2 py-5">
                        <Badge className={cn("text-[8px] font-black uppercase", isClosed ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600")} variant="outline">
                          {isClosed ? "Clôturée" : "En cours"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right px-2 py-5 font-bold text-xs tabular-nums">{formatCurrency(s.openingBalance)}</TableCell>
                      <TableCell className="text-right px-2 py-5 font-black text-xs text-green-600 tabular-nums">+{formatCurrency(s.totalSales || 0)}</TableCell>
                      <TableCell className="text-right px-2 py-5 font-black text-xs text-red-500 tabular-nums">-{formatCurrency((s.totalExpenses || 0) + (s.totalVersements || 0))}</TableCell>
                      <TableCell className="text-right px-2 py-5 font-black text-sm text-slate-900 tabular-nums">
                        {formatCurrency(s.closingBalanceReal ?? (s.openingBalance + (s.totalSales || 0) - (s.totalExpenses || 0) - (s.totalVersements || 0)))}
                      </TableCell>
                      <TableCell className="text-right px-8 py-5">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                              <MoreVertical className="h-4 w-4 text-slate-400" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl p-2 shadow-2xl border-primary/10">
                            <DropdownMenuItem onClick={() => router.push(`/rapports/print/journalier?date=${s.date}`)} className="py-2.5 font-black text-[10px] uppercase cursor-pointer rounded-lg">
                              <FileText className="mr-2 h-4 w-4 text-primary" /> Rapport PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/caisse?date=${s.date}`)} className="py-2.5 font-black text-[10px] uppercase cursor-pointer rounded-lg">
                              <ChevronRight className="mr-2 h-4 w-4 text-primary" /> Voir Détails
                            </DropdownMenuItem>
                            {isClosed && isAdminOrPrepa && (
                              <DropdownMenuItem onClick={() => handleReopenSession(s.id)} className="py-2.5 font-black text-[10px] uppercase cursor-pointer rounded-lg text-orange-600">
                                <RotateCcw className="mr-2 h-4 w-4" /> Ré-ouvrir Caisse
                              </DropdownMenuItem>
                            )}
                            {isAdminOrPrepa && (
                              <DropdownMenuItem onClick={() => handleDeleteSession(s.id, s.date)} className="py-2.5 font-black text-[10px] uppercase cursor-pointer rounded-lg text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" /> Supprimer Session
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
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