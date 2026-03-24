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
  Wallet,
  Tag,
  Receipt,
  ShoppingCart,
  Percent
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, cn, roundAmount } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isWithinInterval, startOfDay, endOfDay, startOfMonth, endOfMonth, isValid } from "date-fns";
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
  // Modification : Date de début fixée au 01/01/2026 par défaut
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({ 
    from: new Date(2026, 0, 1), 
    to: new Date() 
  });

  const salesQuery = useMemoFirebase(() => query(collection(db, "sales"), orderBy("createdAt", "desc"), limit(2000)), [db]);
  const { data: rawSales, isLoading: salesLoading } = useCollection(salesQuery);

  const transQuery = useMemoFirebase(() => query(collection(db, "transactions"), orderBy("createdAt", "desc"), limit(2000)), [db]);
  const { data: rawTransactions, isLoading: transLoading } = useCollection(transQuery);

  const stats = useMemo(() => {
    const from = startOfDay(dateRange.from);
    const to = endOfDay(dateRange.to);
    
    const filteredSales = (rawSales || []).filter((s: any) => 
      (isPrepaMode ? s.isDraft === true : !s.isDraft) && 
      s.createdAt?.toDate && 
      isWithinInterval(s.createdAt.toDate(), { start: from, end: to })
    );

    const filteredTrans = (rawTransactions || []).filter((t: any) => 
      (isPrepaMode ? t.isDraft === true : !t.isDraft) && 
      t.createdAt?.toDate && 
      isWithinInterval(t.createdAt.toDate(), { start: from, end: to })
    );

    const ca = filteredTrans.filter(t => t.type === "VENTE").reduce((acc, t) => acc + (Number(t.montant) || 0), 0);
    const volumeFacture = filteredSales.reduce((acc, s) => acc + (Number(s.total) || 0) - (Number(s.remise) || 0), 0);
    const costs = filteredSales.reduce((acc, s) => acc + (Number(s.purchasePriceFrame) || 0) + (Number(s.purchasePriceLenses) || 0), 0);
    const expenses = filteredTrans.filter(t => ["DEPENSE", "ACHAT VERRES", "ACHAT MONTURE"].includes(t.type)).reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);
    const versements = filteredTrans.filter(t => t.type === "VERSEMENT").reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);

    const chargeVerres = filteredTrans.filter(t => t.type === "ACHAT VERRES").reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);
    const chargeMontures = filteredTrans.filter(t => t.type === "ACHAT MONTURE").reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);

    return { 
      ca: roundAmount(ca), 
      volumeFacture: roundAmount(volumeFacture), 
      marge: roundAmount(volumeFacture - costs), 
      expenses: roundAmount(expenses), 
      versements: roundAmount(versements),
      chargeVerres: roundAmount(chargeVerres),
      chargeMontures: roundAmount(chargeMontures),
      filteredSales, 
      filteredTrans 
    };
  }, [rawSales, rawTransactions, dateRange, isPrepaMode]);

  if (loadingRole) return null;

  return (
    <AppShell>
      <div className="space-y-8 pb-10">
        <div className="bg-white p-8 rounded-[60px] border shadow-xl shadow-slate-200/50 flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <TrendingUp className="h-8 w-8 text-[#D4AF37]/40 shrink-0" />
            <div className="flex flex-col">
              <h1 className="text-3xl font-black text-[#0D1B2A] uppercase tracking-tighter leading-none">
                Rapports d'Activité
              </h1>
              <p className="text-[10px] text-[#D4AF37] font-black uppercase tracking-[0.3em] mt-2">
                Analyses Luxury & Exports Fournisseurs.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-full border shadow-inner">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="h-12 px-6 rounded-full font-black text-[10px] uppercase bg-white border min-w-[220px] justify-between shadow-sm">
                  <CalendarIcon className="mr-2 h-4 w-4 text-[#D4AF37]" />
                  <span>{format(dateRange.from, "dd MMM")} - {format(dateRange.to, "dd MMM yyyy")}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-[32px] border-none shadow-2xl overflow-hidden">
                <Calendar mode="range" selected={{ from: dateRange.from, to: dateRange.to }} onSelect={(r: any) => r?.from && setDateRange({ from: r.from, to: r.to || r.from })} locale={fr} />
              </PopoverContent>
            </Popover>
            <Button onClick={() => router.push(`/rapports/print/journalier?date=${format(dateRange.from, "yyyy-MM-dd")}`)} className="h-12 px-8 rounded-full font-black text-[10px] uppercase shadow-lg bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-white transition-all">
              <FileText className="mr-2 h-4 w-4" /> JOURNALIER
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[ 
            { l: "CA Encaissé", v: stats.ca, c: "text-[#D4AF37]" }, 
            { l: "Marge Brute", v: stats.marge, c: "text-emerald-600" }, 
            { l: "Achats (V+M)", v: -(stats.chargeVerres + stats.chargeMontures), c: "text-orange-500" }, 
            { l: "Résultat Net", v: stats.ca - stats.expenses, c: "text-blue-600" } 
          ].map((item, i) => (
            <Card key={i} className="p-8 rounded-[60px] border-none shadow-xl shadow-slate-200/50 bg-white relative overflow-hidden">
              <p className="text-[10px] uppercase font-black text-slate-400 mb-3 tracking-widest">{item.l}</p>
              <p className={cn("text-2xl font-black tabular-nums tracking-tighter", item.c)}>{formatCurrency(item.v)}</p>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="flux" className="w-full">
          <TabsList className="bg-white p-1 rounded-[32px] shadow-sm border h-14 w-fit flex overflow-x-auto">
            <TabsTrigger value="flux" className="rounded-full font-black text-[10px] uppercase px-8">Flux de Caisse</TabsTrigger>
            <TabsTrigger value="marges" className="rounded-full font-black text-[10px] uppercase px-8">Analyse Marges</TabsTrigger>
            <TabsTrigger value="charges" className="rounded-full font-black text-[10px] uppercase px-8">Détail des Charges</TabsTrigger>
          </TabsList>

          <TabsContent value="flux" className="mt-6">
            <Card className="rounded-[60px] shadow-xl border-none overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-[#0D1B2A]">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Date</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Opération</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.filteredTrans.length > 0 ? stats.filteredTrans.map(t => (
                    <TableRow key={t.id} className="hover:bg-slate-50 border-b last:border-0">
                      <TableCell className="px-10 py-6 font-bold text-[11px] text-slate-400">{t.createdAt?.toDate ? format(t.createdAt.toDate(), "dd/MM HH:mm") : "---"}</TableCell>
                      <TableCell className="px-10 py-6 font-black uppercase text-xs text-[#0D1B2A]">{t.label}</TableCell>
                      <TableCell className={cn("text-right px-10 py-6 font-black text-sm tabular-nums", t.montant >= 0 ? "text-emerald-600" : "text-red-500")}>
                        {t.montant >= 0 ? "+" : ""}{formatCurrency(t.montant)}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={3} className="text-center py-20 text-[10px] font-black uppercase opacity-20 tracking-widest">Aucune donnée sur cette période.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="marges" className="mt-6">
            <Card className="rounded-[60px] shadow-xl border-none overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-[#0D1B2A]">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest">Date</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest">Facture & Client</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest">CA Net</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest">Coût Monture</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest">Coût Verres</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest">Marge</TableHead>
                    <TableHead className="text-center text-[10px] uppercase font-black px-6 py-6 text-[#D4AF37] tracking-widest">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.filteredSales.length > 0 ? stats.filteredSales.map(s => {
                    const caNet = (s.total || 0) - (s.remise || 0);
                    const costFrame = s.purchasePriceFrame || 0;
                    const costLenses = s.purchasePriceLenses || 0;
                    const totalCost = costFrame + costLenses;
                    const marge = caNet - totalCost;
                    const margePct = caNet > 0 ? (marge / caNet) * 100 : 0;

                    return (
                      <TableRow key={s.id} className="hover:bg-slate-50 border-b last:border-0">
                        <TableCell className="px-6 py-6 font-bold text-[11px] text-slate-400 whitespace-nowrap">
                          {s.createdAt?.toDate ? format(s.createdAt.toDate(), "dd/MM/yyyy") : "---"}
                        </TableCell>
                        <TableCell className="px-6 py-6">
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-black text-[#0D1B2A] uppercase truncate">{s.invoiceId}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase truncate">{s.clientName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-6 py-6 font-black text-sm tabular-nums text-slate-900">{formatCurrency(caNet)}</TableCell>
                        <TableCell className="text-right px-6 py-6 font-black text-sm tabular-nums text-red-400">-{formatCurrency(costFrame)}</TableCell>
                        <TableCell className="text-right px-6 py-6 font-black text-sm tabular-nums text-red-400">-{formatCurrency(costLenses)}</TableCell>
                        <TableCell className="text-right px-6 py-6 font-black text-sm tabular-nums text-emerald-600">{formatCurrency(marge)}</TableCell>
                        <TableCell className="text-center px-6 py-6">
                          <Badge className={cn("text-[9px] font-black", margePct > 50 ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700")}>
                            {margePct.toFixed(0)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow><TableCell colSpan={7} className="text-center py-20 text-[10px] font-black uppercase opacity-20 tracking-widest">Veuillez affecter des coûts d'achat dans l'historique.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="charges" className="mt-6">
            <Card className="rounded-[60px] shadow-xl border-none overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-[#0D1B2A]">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Date</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Catégorie</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Libellé / Fournisseur</TableHead>
                    <TableHead className="text-center text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">BC N°</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.filteredTrans.filter(t => t.type !== "VENTE").length > 0 ? stats.filteredTrans.filter(t => t.type !== "VENTE").map(t => {
                    const bcMatch = (t.clientName || "").match(/BC\s*[:\s-]\s*(\d+)/i);
                    const bcNum = bcMatch ? bcMatch[1] : "---";
                    
                    return (
                      <TableRow key={t.id} className="hover:bg-slate-50 border-b last:border-0">
                        <TableCell className="px-10 py-6 font-bold text-[11px] text-slate-400">
                          {t.createdAt?.toDate ? format(t.createdAt.toDate(), "dd/MM/yyyy") : "---"}
                        </TableCell>
                        <TableCell className="px-10 py-6">
                          <Badge variant="outline" className={cn(
                            "text-[9px] font-black uppercase border-none",
                            t.type === "ACHAT VERRES" ? "bg-blue-50 text-blue-700" : 
                            t.type === "ACHAT MONTURE" ? "bg-orange-50 text-orange-700" : 
                            "bg-slate-50 text-slate-700"
                          )}>
                            {t.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-10 py-6 font-black uppercase text-xs text-[#0D1B2A]">{t.label}</TableCell>
                        <TableCell className="text-center px-10 py-6 font-black text-xs text-slate-500 tabular-nums">{bcNum}</TableCell>
                        <TableCell className="text-right px-10 py-6 font-black text-sm tabular-nums text-red-500">
                          -{formatCurrency(Math.abs(t.montant))}
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow><TableCell colSpan={5} className="text-center py-20 text-[10px] font-black uppercase opacity-20 tracking-widest">Aucune dépense enregistrée sur cette période.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
