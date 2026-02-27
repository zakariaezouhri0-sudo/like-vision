
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
import { formatCurrency, cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
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
    if (savedRole !== 'ADMIN' && savedRole !== 'PREPA') {
      router.push('/dashboard');
    } else {
      setRole(savedRole.toUpperCase());
      setLoadingRole(false);
    }
  }, [router]);

  const isPrepaMode = role === "PREPA";

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });

  const salesQuery = useMemoFirebase(() => query(collection(db, "sales"), orderBy("createdAt", "desc")), [db]);
  const { data: rawSales, isLoading: salesLoading } = useCollection(salesQuery);

  const transQuery = useMemoFirebase(() => query(collection(db, "transactions"), orderBy("createdAt", "desc")), [db]);
  const { data: rawTransactions, isLoading: transLoading } = useCollection(transQuery);

  const stats = useMemo(() => {
    const from = startOfDay(dateRange.from);
    const to = endOfDay(dateRange.to);

    // Filtrage par Mode Préparation
    const filteredSales = (rawSales || []).filter((s: any) => {
      const matchesMode = isPrepaMode ? s.isDraft === true : !s.isDraft;
      if (!matchesMode) return false;
      return s.createdAt?.toDate && isWithinInterval(s.createdAt.toDate(), { start: from, end: to });
    });

    const filteredTrans = (rawTransactions || []).filter((t: any) => {
      const matchesMode = isPrepaMode ? t.isDraft === true : !t.isDraft;
      if (!matchesMode) return false;
      return t.createdAt?.toDate && isWithinInterval(t.createdAt.toDate(), { start: from, end: to });
    });

    // Use Number() for robust math
    const ca = filteredSales.reduce((acc, s) => acc + (Number(s.total) || 0) - (Number(s.remise) || 0), 0);
    const costs = filteredSales.reduce((acc, s) => acc + (Number(s.purchasePriceFrame) || 0) + (Number(s.purchasePriceLenses) || 0), 0);
    const expenses = filteredTrans.filter(t => t.type === "DEPENSE" || t.type === "ACHAT VERRES").reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);
    const versements = filteredTrans.filter(t => t.type === "VERSEMENT").reduce((acc, t) => acc + Math.abs(Number(t.montant) || 0), 0);

    return {
      ca, marge: ca - costs, expenses, versements, count: filteredSales.length,
      filteredSales, filteredTrans
    };
  }, [rawSales, rawTransactions, dateRange, isPrepaMode]);

  const handlePrintDaily = () => {
    const params = new URLSearchParams({ date: format(dateRange.from, "yyyy-MM-dd") });
    router.push(`/rapports/print/journalier?${params.toString()}`);
  };

  const handleExportCSV = () => {
    const headers = ["Date", "Type", "Label", "Categorie", "Montant (DH)"];
    const rows = stats.filteredTrans.map((t: any) => [
      format(t.createdAt.toDate(), "dd/MM/yyyy HH:mm"), t.type, t.label, t.category || "---", t.montant
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(";")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `rapport_${isPrepaMode ? 'prepa_' : ''}${format(new Date(), "yyyyMMdd")}.csv`);
    link.click();
  };

  if (loadingRole) return null;

  return (
    <AppShell>
      <div className="space-y-6 pb-10">
        <div className="bg-white p-6 rounded-[32px] border shadow-sm border-slate-200">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h1 className="text-2xl font-black text-primary uppercase tracking-tighter">Rapports d'Activité {isPrepaMode ? "(Brouillon)" : ""}</h1>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">Analyses et exports financiers.</p>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-[22px] border border-slate-100 shadow-inner w-full lg:w-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="h-11 px-4 rounded-xl font-black text-[10px] uppercase bg-white border border-slate-200 min-w-[180px] lg:w-[200px] justify-between shadow-sm hover:bg-slate-50 transition-all">
                    <div className="flex items-center overflow-hidden">
                      <CalendarIcon className="mr-2 h-4 w-4 text-primary shrink-0" />
                      <span className="truncate">{format(dateRange.from, "dd MMM")} - {format(dateRange.to, "dd MMM yyyy")}</span>
                    </div>
                    <ChevronDown className="h-3 w-3 text-slate-400 ml-2 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-[24px] border-none shadow-2xl overflow-hidden" align="end">
                  <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x">
                    <div className="p-4 bg-slate-50/50 flex flex-col gap-1 min-w-[140px]">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-2">Périodes</span>
                      <Button variant="ghost" size="sm" className="justify-start text-[10px] font-bold h-8 rounded-lg hover:bg-white" onClick={() => setDateRange({ from: startOfDay(new Date()), to: new Date() })}>Aujourd'hui</Button>
                      <Button variant="ghost" size="sm" className="justify-start text-[10px] font-bold h-8 rounded-lg hover:bg-white" onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() - 1);
                        setDateRange({ from: startOfDay(d), to: endOfDay(d) });
                      }}>Hier</Button>
                      <Button variant="ghost" size="sm" className="justify-start text-[10px] font-bold h-8 rounded-lg hover:bg-white" onClick={() => setDateRange({ from: startOfMonth(new Date()), to: new Date() })}>Ce mois</Button>
                      <Button variant="ghost" size="sm" className="justify-start text-[10px] font-bold h-8 rounded-lg hover:bg-white" onClick={() => {
                        const d = new Date();
                        d.setMonth(d.getMonth() - 1);
                        setDateRange({ from: startOfMonth(d), to: endOfMonth(d) });
                      }}>Mois dernier</Button>
                    </div>
                    <div className="p-2 bg-white">
                      <Calendar 
                        mode="range" 
                        selected={{ from: dateRange.from, to: dateRange.to }} 
                        onSelect={(r: any) => r?.from && setDateRange({ from: r.from, to: r.to || r.from })} 
                        numberOfMonths={1} 
                        locale={fr} 
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              
              <div className="flex gap-2 flex-1 md:flex-none">
                <Button onClick={handleExportCSV} className="h-11 px-6 rounded-xl font-black text-[10px] uppercase shadow-sm bg-green-600 hover:bg-green-700 text-white min-w-[120px] flex-1 lg:flex-none">
                  <FileSpreadsheet className="mr-1.5 h-4 w-4" /> EXCEL
                </Button>
                <Button onClick={handlePrintDaily} variant="outline" className="h-11 px-6 rounded-xl font-black text-[10px] uppercase border-slate-200 bg-white text-slate-600 min-w-[160px] flex-1 lg:flex-none shadow-sm whitespace-nowrap">
                  <FileText className="mr-1.5 h-4 w-4" /> JOURNALIER
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-primary text-primary-foreground border-none shadow-lg p-6 rounded-[32px] relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[9px] uppercase font-black opacity-60 mb-2 tracking-[0.2em]">CA Net {isPrepaMode ? "(Mode PREPA)" : ""}</p>
              <p className="text-2xl font-black tracking-tight tabular-nums">{formatCurrency(stats.ca)}</p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-5 transform rotate-12 group-hover:scale-110 transition-transform duration-500">
              <TrendingUp className="h-24 w-24" />
            </div>
          </Card>
          <Card className="bg-accent text-accent-foreground border-none shadow-lg p-6 rounded-[32px] relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[9px] uppercase font-black opacity-60 mb-2 tracking-[0.2em]">Marge Brute {isPrepaMode ? "(Mode PREPA)" : ""}</p>
              <p className="text-2xl font-black tracking-tight tabular-nums">{formatCurrency(stats.marge)}</p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 transform -rotate-12 group-hover:scale-110 transition-transform duration-500">
              <TrendingUp className="h-24 w-24" />
            </div>
          </Card>
          <Card className="bg-destructive text-destructive-foreground border-none shadow-lg p-6 rounded-[32px] relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[9px] uppercase font-black opacity-60 mb-2 tracking-[0.2em]">Dépenses {isPrepaMode ? "(Mode PREPA)" : ""}</p>
              <p className="text-2xl font-black tracking-tight tabular-nums">-{formatCurrency(stats.expenses)}</p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 transform rotate-45 group-hover:scale-110 transition-transform duration-500">
              <TrendingDown className="h-24 w-24" />
            </div>
          </Card>
          <Card className="bg-white border-none shadow-lg p-6 rounded-[32px] border-l-8 border-l-green-500 relative overflow-hidden group">
            <div className="relative z-10">
              <p className="text-[9px] uppercase font-black text-muted-foreground mb-2 tracking-[0.2em]">Solde Période {isPrepaMode ? "(Brouillon)" : ""}</p>
              <p className="text-2xl font-black text-green-600 tracking-tight tabular-nums">{formatCurrency(stats.ca - stats.expenses - stats.versements)}</p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-5 transform -rotate-12 group-hover:scale-110 transition-transform duration-500">
              <Wallet className="h-24 w-24 text-green-600" />
            </div>
          </Card>
        </div>

        <Tabs defaultValue="flux" className="w-full">
          <TabsList className="bg-white p-1 rounded-2xl shadow-sm border h-14 w-full md:w-auto grid grid-cols-2">
            <TabsTrigger value="flux" className="rounded-xl font-black text-[10px] uppercase tracking-widest">Flux de Caisse</TabsTrigger>
            <TabsTrigger value="marges" className="rounded-xl font-black text-[10px] uppercase tracking-widest">Détail Marges</TabsTrigger>
          </TabsList>
          <TabsContent value="flux" className="mt-6">
            <Card className="shadow-sm border-none overflow-hidden rounded-[32px] bg-white">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black px-6 py-5 tracking-widest">Date</TableHead>
                    <TableHead className="text-[10px] uppercase font-black px-6 py-5 tracking-widest">Opération</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-5 tracking-widest">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(salesLoading || transLoading) ? <TableRow><TableCell colSpan={3} className="text-center py-20"><Loader2 className="h-6 w-6 animate-spin mx-auto opacity-20" /></TableCell></TableRow> : 
                    stats.filteredTrans.length > 0 ? stats.filteredTrans.map((t: any) => (
                      <TableRow key={t.id} className="hover:bg-primary/5 border-b last:border-0 transition-all">
                        <TableCell className="text-[10px] font-bold text-muted-foreground px-6 py-5">
                          {t.createdAt?.toDate ? format(t.createdAt.toDate(), "dd/MM HH:mm") : "---"}
                        </TableCell>
                        <TableCell className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black uppercase text-slate-800 leading-tight">{t.label}</span>
                            <Badge variant="outline" className={cn("text-[8px] font-black w-fit mt-1 border-none", t.type === 'VENTE' ? 'bg-green-100 text-green-700' : (t.type === 'DEPENSE' || t.type === 'ACHAT VERRES') ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700')}>
                              {t.type}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className={cn("text-right px-6 py-5 font-black text-sm tabular-nums", t.montant >= 0 ? "text-green-600" : "text-destructive")}>
                          {formatCurrency(t.montant)}
                        </TableCell>
                      </TableRow>
                    )) : <TableRow><TableCell colSpan={3} className="text-center py-24 text-[10px] font-black uppercase opacity-30 tracking-[0.4em]">Aucun flux {isPrepaMode ? "brouillon" : ""} sur cette période.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
          <TabsContent value="marges" className="mt-6">
            <Card className="shadow-sm border-none overflow-hidden rounded-[32px] bg-white">
              <Table>
                <TableHeader className="bg-slate-50/80">
                  <TableRow>
                    <TableHead className="text-[10px] uppercase font-black px-6 py-5 tracking-widest">Vente</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-5 tracking-widest">Prix Vente</TableHead>
                    <TableHead className="text-right text-[10px] uppercase font-black px-6 py-5 tracking-widest text-accent">Marge</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.filteredSales.length > 0 ? stats.filteredSales.map((s: any) => {
                    const net = (Number(s.total) || 0) - (Number(s.remise) || 0);
                    const cost = (Number(s.purchasePriceFrame) || 0) + (Number(s.purchasePriceLenses) || 0);
                    return (
                      <TableRow key={s.id} className="hover:bg-primary/5 border-b last:border-0 transition-all">
                        <TableCell className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black uppercase text-slate-800 leading-tight">{s.clientName}</span>
                            <span className="text-[9px] font-bold text-primary/40 mt-0.5 tracking-wider">{s.invoiceId}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right px-6 py-5 font-black text-sm text-slate-900 tabular-nums">{formatCurrency(net)}</TableCell>
                        <TableCell className="text-right px-6 py-5 font-black text-accent text-sm tabular-nums">{formatCurrency(net - cost)}</TableCell>
                      </TableRow>
                    );
                  }) : <TableRow><TableCell colSpan={3} className="text-center py-24 text-[10px] font-black uppercase opacity-30 tracking-[0.4em]">Aucune donnée de marge disponible.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
