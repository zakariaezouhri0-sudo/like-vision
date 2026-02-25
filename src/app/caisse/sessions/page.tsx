"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CalendarClock, 
  FileText, 
  Loader2, 
  User, 
  ArrowRightLeft, 
  Lock, 
  PlayCircle,
  AlertCircle,
  CheckCircle2,
  Calendar as CalendarIcon
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function CashSessionsPage() {
  const router = useRouter();
  const db = useFirestore();
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    const role = localStorage.getItem('user_role');
    if (role !== 'ADMIN') {
      router.push('/dashboard');
    } else {
      setLoadingRole(false);
    }
  }, [router]);

  const sessionsQuery = useMemoFirebase(() => {
    return query(collection(db, "cash_sessions"), orderBy("date", "desc"));
  }, [db]);

  const { data: sessions, isLoading } = useCollection(sessionsQuery);

  if (loadingRole) return null;

  return (
    <AppShell>
      <div className="space-y-6 pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
              <CalendarClock className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-primary uppercase tracking-tighter leading-none">Sessions de Caisse</h1>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em] mt-1 opacity-60">Historique des ouvertures et clôtures.</p>
            </div>
          </div>
        </div>

        <Card className="shadow-sm border-none overflow-hidden rounded-[32px] bg-white">
          <CardHeader className="py-4 px-6 bg-slate-50/50 border-b">
            <CardTitle className="text-[11px] font-black uppercase tracking-widest text-primary/60">Journal des Sessions</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Récupération de l'historique...</span>
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black px-6 py-5">Date & Statut</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-6 py-5">Ouverture</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-5">Flux Net</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-5">Clôture</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-5">Écart</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-5">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions && sessions.length > 0 ? (
                    sessions.map((s: any) => {
                      const fluxNet = s.status === "CLOSED" ? (s.closingBalanceTheoretical - s.openingBalance) : 0;
                      const openedDate = s.openedAt?.toDate ? s.openedAt.toDate() : null;
                      const closedDate = s.closedAt?.toDate ? s.closedAt.toDate() : null;

                      return (
                        <TableRow key={s.id} className="hover:bg-primary/5 border-b last:border-0 transition-all group">
                          <TableCell className="px-6 py-5">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-3 w-3 text-slate-400" />
                                <span className="font-black text-xs text-slate-800 uppercase">
                                  {format(new Date(s.date), "dd MMMM yyyy", { locale: fr })}
                                </span>
                              </div>
                              <Badge className={cn(
                                "w-fit text-[8px] font-black uppercase px-2 py-0 border-none",
                                s.status === "OPEN" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                              )}>
                                {s.status === "OPEN" ? "En cours" : "Terminée"}
                              </Badge>
                            </div>
                          </TableCell>
                          
                          <TableCell className="px-6 py-5">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <PlayCircle className="h-3 w-3 text-green-500" />
                                <span className="text-[10px] font-bold text-slate-500">
                                  {openedDate ? format(openedDate, "HH:mm") : "--:--"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3 text-slate-300" />
                                <span className="text-[10px] font-black text-primary/60 uppercase">{s.openedBy || "---"}</span>
                              </div>
                              <span className="text-xs font-black text-slate-900 mt-1">{formatCurrency(s.openingBalance)}</span>
                            </div>
                          </TableCell>

                          <TableCell className="text-right px-6 py-5">
                            {s.status === "CLOSED" ? (
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                  <ArrowRightLeft className="h-3 w-3" /> Mouvement
                                </div>
                                <span className={cn("text-sm font-black tracking-tighter", fluxNet >= 0 ? "text-green-600" : "text-destructive")}>
                                  {fluxNet > 0 ? "+" : ""}{formatCurrency(fluxNet)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-300 uppercase italic">Session ouverte</span>
                            )}
                          </TableCell>

                          <TableCell className="text-right px-6 py-5">
                            {s.status === "CLOSED" ? (
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-2 text-slate-400">
                                  <span className="text-[10px] font-bold">
                                    {closedDate ? format(closedDate, "HH:mm") : "--:--"}
                                  </span>
                                  <Lock className="h-3 w-3" />
                                </div>
                                <span className="text-sm font-black text-slate-900">{formatCurrency(s.closingBalanceReal)}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-300">---</span>
                            )}
                          </TableCell>

                          <TableCell className="text-right px-6 py-5">
                            {s.status === "CLOSED" ? (
                              <div className={cn(
                                "flex items-center justify-end gap-2 px-3 py-1.5 rounded-xl border-2 w-fit ml-auto",
                                Math.abs(s.discrepancy) < 0.01 ? "bg-green-50 border-green-100 text-green-600" : "bg-red-50 border-red-100 text-red-600"
                              )}>
                                <span className="text-xs font-black tracking-tighter">
                                  {s.discrepancy > 0 ? "+" : ""}{formatCurrency(s.discrepancy)}
                                </span>
                                {Math.abs(s.discrepancy) < 0.01 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-300">---</span>
                            )}
                          </TableCell>

                          <TableCell className="text-right px-6 py-5">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => router.push(`/rapports/print/journalier?date=${s.date}`)}
                              className="h-9 px-4 rounded-xl font-black text-[10px] uppercase border-primary/20 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                            >
                              <FileText className="mr-1.5 h-3.5 w-3.5" /> Rapport
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-32 text-xs font-black uppercase text-muted-foreground opacity-30 tracking-[0.4em]">
                        Aucune session enregistrée.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
