
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
  User as UserIcon, 
  Lock, 
  Calendar as CalendarIcon,
  TrendingUp,
  TrendingDown,
  History,
  Clock,
  Eye,
  Landmark
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
  const [role, setRole] = useState<string>("OPTICIENNE");
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role') || "OPTICIENNE";
    setRole(savedRole.toUpperCase());
    setLoadingRole(false);
  }, []);

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
            <div className="h-14 w-14 bg-slate-900 text-white rounded-[20px] flex items-center justify-center shadow-xl">
              <CalendarClock className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-primary uppercase tracking-tighter leading-none">Journal des Sessions</h1>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em] mt-1 opacity-60">Historique des responsables et flux de caisse.</p>
            </div>
          </div>
        </div>

        <Card className="shadow-sm border-none overflow-hidden rounded-[32px] bg-white">
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
                    <TableHead className="text-[10px] uppercase font-black px-6 py-6 tracking-widest whitespace-nowrap">Ouverture</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest whitespace-nowrap">Solde Initial</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest whitespace-nowrap">Flux (Op)</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest whitespace-nowrap">Versement</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest whitespace-nowrap">Solde Final</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-6 py-6 tracking-widest whitespace-nowrap">Clôture</TableHead>
                    {role === 'ADMIN' && <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest whitespace-nowrap">Écart</TableHead>}
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 tracking-widest whitespace-nowrap">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions && sessions.length > 0 ? (
                    sessions.map((s: any) => {
                      const openedDate = s.openedAt?.toDate ? s.openedAt.toDate() : null;
                      const closedDate = s.closedAt?.toDate ? s.closedAt.toDate() : null;
                      
                      // Flux Opérationnel = Ventes - Dépenses
                      const fluxOp = (s.totalSales !== undefined && s.totalExpenses !== undefined) 
                        ? (s.totalSales - s.totalExpenses) 
                        : null;
                      
                      const versement = s.totalVersements !== undefined ? s.totalVersements : null;

                      return (
                        <TableRow key={s.id} className="hover:bg-primary/5 border-b last:border-0 transition-all group">
                          <TableCell className="px-6 py-6 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-primary/40" />
                                <span className="font-black text-sm text-slate-800 uppercase tracking-tight">
                                  {format(new Date(s.date), "dd MMMM yyyy", { locale: fr })}
                                </span>
                              </div>
                              <div 
                                className={cn(
                                  "h-2.5 w-2.5 rounded-full shrink-0 transition-colors",
                                  s.status === "OPEN" ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]"
                                )} 
                                title={s.status === "OPEN" ? "Ouverte" : "Clôturée"}
                              />
                            </div>
                          </TableCell>

                          <TableCell className="px-6 py-6 whitespace-nowrap">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1 text-[9px] font-black text-green-600 uppercase tracking-widest mb-0.5">
                                <Clock className="h-3 w-3" />
                                {openedDate ? format(openedDate, "HH:mm") : "--:--"}
                              </div>
                              <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 w-fit">
                                <UserIcon className="h-2.5 w-2.5 text-primary/30" />
                                <span className="text-[9px] font-black text-slate-700 uppercase tracking-tighter truncate max-w-[100px]">
                                  {s.openedBy || "---"}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          
                          <TableCell className="text-right px-6 py-6 whitespace-nowrap">
                            <span className="text-base font-black text-slate-900 tracking-tighter">
                              {formatCurrency(s.openingBalance)}
                            </span>
                          </TableCell>

                          <TableCell className="text-right px-6 py-6 whitespace-nowrap">
                            {s.status === "CLOSED" && fluxOp !== null ? (
                              <div className={cn(
                                "flex items-center justify-end gap-1.5 font-black text-sm",
                                fluxOp >= 0 ? "text-green-600" : "text-destructive"
                              )}>
                                {fluxOp > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                                {formatCurrency(fluxOp)}
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-slate-200">---</span>
                            )}
                          </TableCell>

                          <TableCell className="text-right px-6 py-6 whitespace-nowrap">
                            {s.status === "CLOSED" && versement !== null ? (
                              <div className="flex items-center justify-end gap-1.5 font-black text-sm text-orange-600">
                                <Landmark className="h-3.5 w-3.5" />
                                {formatCurrency(versement)}
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-slate-200">---</span>
                            )}
                          </TableCell>

                          <TableCell className="text-right px-6 py-6 whitespace-nowrap">
                            {s.status === "CLOSED" ? (
                              <span className="text-base font-black text-slate-900 tracking-tighter">
                                {formatCurrency(s.closingBalanceReal)}
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-slate-200">---</span>
                            )}
                          </TableCell>

                          <TableCell className="px-6 py-6 whitespace-nowrap">
                            {s.status === "CLOSED" ? (
                              <div className="flex flex-col">
                                <div className="flex items-center gap-1 text-[9px] font-black text-red-500 uppercase tracking-widest mb-0.5">
                                  <Lock className="h-3 w-3" />
                                  {closedDate ? format(closedDate, "HH:mm") : "--:--"}
                                </div>
                                <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 w-fit">
                                  <UserIcon className="h-2.5 w-2.5 text-primary/30" />
                                  <span className="text-[9px] font-black text-slate-700 uppercase tracking-tighter truncate max-w-[100px]">
                                    {s.closedBy || "---"}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-[9px] font-black text-slate-200 uppercase tracking-[0.2em]">En cours...</span>
                            )}
                          </TableCell>

                          {role === 'ADMIN' && (
                            <TableCell className="text-right px-6 py-6 whitespace-nowrap">
                              {s.status === "CLOSED" ? (
                                <div className={cn(
                                  "flex items-center justify-end gap-2 px-3 py-2 rounded-xl border-2 w-fit ml-auto",
                                  Math.abs(s.discrepancy) < 0.01 ? "bg-green-50 border-green-100 text-green-600" : "bg-red-50 border-red-100 text-red-600"
                                )}>
                                  <span className="text-xs font-black tracking-tighter">
                                    {s.discrepancy > 0 ? "+" : ""}{formatCurrency(s.discrepancy)}
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
                                className="h-10 px-4 rounded-xl font-black text-[10px] uppercase border-primary text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                              >
                                <Eye className="mr-1.5 h-4 w-4" /> Détails
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => router.push(`/rapports/print/journalier?date=${s.date}`)}
                                className="h-10 px-4 rounded-xl font-black text-[10px] uppercase border-slate-200 text-slate-600 hover:bg-slate-100 transition-all shadow-sm"
                              >
                                <FileText className="mr-1.5 h-4 w-4" /> Rapport
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={role === 'ADMIN' ? 9 : 8} className="text-center py-40">
                        <div className="flex flex-col items-center gap-4 opacity-20">
                          <History className="h-12 w-12" />
                          <p className="text-xs font-black uppercase tracking-[0.4em]">Aucune session enregistrée.</p>
                        </div>
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
