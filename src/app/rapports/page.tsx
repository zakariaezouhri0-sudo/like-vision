"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  Calendar as CalendarIcon,
  Loader2,
  Printer,
  FileText,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Wallet
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, cn, roundAmount } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isWithinInterval, startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";
import { useRouter } from "next/navigation";

export default function ReportsPage() {
  const router = useRouter();
  const db = useFirestore();
  const [loadingRole, setLoadingRole] = useState(true);
  const [role, setRole] = useState<string>("OPTICIENNE");

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role');
    if (savedRole !== 'ADMIN' && savedRole !== 'PREPA') router.push('/dashboard');
    else { setRole(savedRole.toUpperCase()); setLoadingRole(false); }
  }, [router]);

  const isPrepaMode = role === "PREPA";
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({ from: startOfMonth(new Date()), to: new Date() });

  const salesQuery = useMemoFirebase(() => query(collection(db, "sales"), orderBy("createdAt", "desc"), limit(2000)), [db]);
  const { data: rawSales, isLoading: salesLoading } = useCollection(salesQuery);

  const transQuery = useMemoFirebase(() => query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(2000)), [db]);
  const { data: rawTransactions, isLoading: transLoading } = useCollection(transQuery);

  const stats = useMemo(() => {
    const from = startOfDay(dateRange.from);
    const to = endOfDay(dateRange.to);
    const filteredSales = (rawSales || []).filter((s: any) => (isPrepaMode ? s.isDraft === true : !s.isDraft) && s.createdAt?.toDate && isWithinInterval(s.createdAt.toDate(), { start: from, end: to }));
    const filteredTrans = (rawTransactions || []).filter((t: any) => (isPrepaMode ? t.isDraft === true : !t.isDraft) && t.createdAt?.toDate && isWithinInterval(t.createdAt.toDate(), { start: from, end: to }));

    const ca = filteredTrans.filter(t => t.type === "VENTE").reduce((acc, t) => acc + (Number(t.montant) || 0), 0);
    const volumeFacture = filteredSales.reduce((acc, s) => acc + (Number(s.total) || 0) - (Number(s.remise) || 0), 0);
    const costs = filteredSales.reduce((acc, s) => acc + (Number(s.purchasePriceFrame) || 0) + (Number(s.purchasePriceLenses) || 0), 0);
    const expenses = filteredTrans.filter(t => ["DEPENSE", "ACHAT VERRES", "ACHAT MONTURE"].includes(t.type)).reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);
    const versements = filteredTrans.filter(t => t.type === "VERSEMENT").reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);

    return { ca: roundAmount(ca), volumeFacture: roundAmount(volumeFacture), marge: roundAmount(volumeFacture - costs), expenses: roundAmount(expenses), versements: roundAmount(versements), filteredSales, filteredTrans };
  }, [rawSales, rawTransactions, dateRange, isPrepaMode]);

  if (loadingRole) return null;

  return (
    <AppShell>
      <div className="space-y-8 pb-10">
        <div className="bg-white p-8 rounded-[60px] border shadow-xl shadow-slate-200/50 flex flex-col lg:flex-row justify-between items-center gap-6">
          <div>
            <h1 className="text-3xl font-black text-[#0D1B2A] uppercase tracking-tighter flex items-center gap-4">
              <TrendingUp className="h-8 w-8 text-[#D4AF37]/40" />
              Rapports d'Activité
            </h1>
            <p className="text-[10px] text-[#D4AF37] font-black uppercase tracking-[0.3em] mt-2">Analyses Luxury & Exports.</p>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-full border shadow-inner">
            <Popover><PopoverTrigger asChild><Button variant="ghost" className="h-12 px-6 rounded-full font-black text-[10px] uppercase bg-white border min-w-[220px] justify-between shadow-sm"><CalendarIcon className="mr-2 h-4 w-4 text-[#D4AF37]" /><span>{format(dateRange.from, "dd MMM")} - {format(dateRange.to, "dd MMM yyyy")}</span><ChevronDown className="h-3 w-3" /></Button></PopoverTrigger><PopoverContent className="w-auto p-0 rounded-[32px] border-none shadow-2xl overflow-hidden"><Calendar mode="range" selected={{ from: dateRange.from, to: dateRange.to }} onSelect={(r: any) => r?.from && setDateRange({ from: r.from, to: r.to || r.from })} locale={fr} /></PopoverContent></Popover>
            <Button onClick={() => router.push(`/rapports/print/journalier?date=${format(dateRange.from, "yyyy-MM-dd")}`)} className="h-12 px-8 rounded-full font-black text-[10px] uppercase shadow-lg bg-[#D4AF37] text-[#0D1B2A]"><FileText className="mr-2 h-4 w-4" /> JOURNALIER</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[ { l: "CA Encaissé", v: stats.ca, c: "text-[#D4AF37]" }, { l: "Marge Brute", v: stats.marge, c: "text-[#D4AF37]" }, { l: "Dépenses", v: -stats.expenses, c: "text-red-500" }, { l: "Résultat Net", v: stats.ca - stats.expenses, c: "text-blue-600" } ].map((item, i) => (
            <Card key={i} className="p-8 rounded-[60px] border-none shadow-xl shadow-slate-200/50 bg-white relative overflow-hidden">
              <p className="text-[10px] uppercase font-black text-slate-400 mb-3 tracking-widest">{item.l}</p>
              <p className={cn("text-2xl font-black tabular-nums tracking-tighter", item.c)}>{formatCurrency(item.v)}</p>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="flux" className="w-full">
          <TabsList className="bg-white p-1 rounded-[32px] shadow-sm border h-14 w-fit"><TabsTrigger value="flux" className="rounded-full font-black text-[10px] uppercase px-10">Flux de Caisse</TabsTrigger><TabsTrigger value="marges" className="rounded-full font-black text-[10px] uppercase px-10">Analyse Marges</TabsTrigger></TabsList>
          <TabsContent value="flux" className="mt-6">
            <Card className="rounded-[60px] shadow-xl border-none overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-[#0D1B2A]"><TableRow><TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Date</TableHead><TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Opération</TableHead><TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Montant</TableHead></TableRow></TableHeader>
                <TableBody>{stats.filteredTrans.map(t => (<TableRow key={t.id} className="hover:bg-slate-50 border-b last:border-0"><TableCell className="px-10 py-6 font-bold text-[11px] text-slate-400">{format(t.createdAt.toDate(), "dd/MM HH:mm")}</TableCell><TableCell className="px-10 py-6 font-black uppercase text-xs text-[#0D1B2A]">{t.label}</TableCell><TableCell className={cn("text-right px-10 py-6 font-black text-sm", t.montant >= 0 ? "text-[#D4AF37]" : "text-red-500")}>{formatCurrency(t.montant)}</TableCell></TableRow>))}</TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}