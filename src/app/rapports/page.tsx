"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Calendar as CalendarIcon, Loader2, TrendingUp, ShoppingBag, Target, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, isWithinInterval, startOfDay, endOfDay, subDays, startOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

export default function ReportsPage() {
  const db = useFirestore();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: new Date(),
  });

  const salesQuery = useMemoFirebase(() => {
    return query(collection(db, "sales"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: allSales, isLoading: loading } = useCollection(salesQuery);

  const stats = useMemo(() => {
    if (!allSales) return { ca: 0, marge: 0, count: 0, filteredSales: [] };

    const filtered = allSales.filter((sale: any) => {
      if (!sale.createdAt?.toDate) return false;
      const saleDate = sale.createdAt.toDate();
      return isWithinInterval(saleDate, {
        start: startOfDay(dateRange.from),
        end: endOfDay(dateRange.to),
      });
    });

    const ca = filtered.reduce((acc, s) => acc + (s.total - (s.remise || 0)), 0);
    const costs = filtered.reduce((acc, s) => acc + (s.purchasePriceFrame || 0) + (s.purchasePriceLenses || 0), 0);
    const marge = ca - costs;

    return {
      ca,
      marge,
      count: filtered.length,
      filteredSales: filtered
    };
  }, [allSales, dateRange]);

  return (
    <AppShell>
      <div className="space-y-8 pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 rounded-[32px] border shadow-sm">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-primary uppercase tracking-tighter">Rapports d'Activité</h1>
            <p className="text-[10px] md:text-xs text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60 mt-1">Analyse des performances financières.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-12 px-6 rounded-2xl font-black text-xs border-primary/20 bg-white hover:bg-primary/5 shadow-sm">
                  <CalendarIcon className="mr-3 h-4 w-4 text-primary" />
                  {format(dateRange.from, "dd MMM", { locale: fr })} - {format(dateRange.to, "dd MMM yyyy", { locale: fr })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden border-none shadow-2xl" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange.from}
                  selected={{ from: dateRange.from, to: dateRange.to }}
                  onSelect={(range: any) => {
                    if (range?.from && range?.to) {
                      setDateRange({ from: range.from, to: range.to });
                    } else if (range?.from) {
                      setDateRange({ from: range.from, to: range.from });
                    }
                  }}
                  numberOfMonths={2}
                  locale={fr}
                />
              </PopoverContent>
            </Popover>
            
            <Button className="h-12 px-6 rounded-2xl font-black text-xs shadow-xl bg-green-600 hover:bg-green-700">
              <FileSpreadsheet className="mr-3 h-4 w-4" />
              EXPORTER EXCEL
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-primary text-primary-foreground border-none shadow-xl p-8 rounded-[40px] relative overflow-hidden group">
            <TrendingUp className="absolute -right-6 -top-6 h-40 w-40 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-500" />
            <p className="text-[10px] uppercase font-black opacity-60 mb-3 tracking-[0.3em]">Chiffre d'Affaires Net</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tighter">{new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(stats.ca)}</span>
              <span className="text-lg font-black opacity-60 uppercase">DH</span>
            </div>
          </Card>
          
          <Card className="bg-accent text-accent-foreground border-none shadow-xl p-8 rounded-[40px] relative overflow-hidden group">
            <Target className="absolute -right-6 -top-6 h-40 w-40 opacity-20 -rotate-12 group-hover:scale-110 transition-transform duration-500" />
            <p className="text-[10px] uppercase font-black opacity-60 mb-3 tracking-[0.3em]">Marge Brute Réalisée</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black tracking-tighter">{new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0 }).format(stats.marge)}</span>
              <span className="text-lg font-black opacity-60 uppercase">DH</span>
            </div>
          </Card>
          
          <Card className="bg-white border-none shadow-xl p-8 rounded-[40px] relative overflow-hidden group border-l-[12px] border-l-green-500">
            <ShoppingBag className="absolute -right-6 -top-6 h-40 w-40 text-green-500 opacity-5 group-hover:scale-110 transition-transform duration-500" />
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-3 tracking-[0.3em]">Volume de Ventes</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black text-green-600 tracking-tighter">{stats.count}</span>
              <span className="text-lg font-black text-green-600/40 uppercase">Dossiers</span>
            </div>
          </Card>
        </div>

        <Card className="shadow-sm border-none overflow-hidden rounded-[40px] bg-white">
          <CardHeader className="p-8 border-b bg-slate-50/50">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Détail des Marges par Vente</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                  <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Calcul des marges...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase font-black px-8 py-6 tracking-widest text-slate-500">Date</TableHead>
                      <TableHead className="text-[10px] uppercase font-black px-8 py-6 tracking-widest text-slate-500">Client / Facture</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-8 py-6 tracking-widest text-slate-500">Vente Net</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-8 py-6 tracking-widest text-slate-500">Coût Achat</TableHead>
                      <TableHead className="text-right text-[10px] uppercase font-black px-8 py-6 tracking-widest text-slate-500">Marge</TableHead>
                      <TableHead className="text-center text-[10px] uppercase font-black px-8 py-6 tracking-widest text-slate-500">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.filteredSales.length > 0 ? (
                      stats.filteredSales.map((sale: any) => {
                        const netSale = sale.total - (sale.remise || 0);
                        const cost = (sale.purchasePriceFrame || 0) + (sale.purchasePriceLenses || 0);
                        const marge = netSale - cost;
                        const margePercent = netSale > 0 ? ((marge / netSale) * 100).toFixed(1) : "0";
                        const saleDate = sale.createdAt?.toDate ? format(sale.createdAt.toDate(), "dd/MM/yyyy") : "---";

                        return (
                          <TableRow key={sale.id} className="hover:bg-primary/5 border-b last:border-0 transition-all">
                            <TableCell className="text-xs font-bold text-muted-foreground px-8 py-6">{saleDate}</TableCell>
                            <TableCell className="px-8 py-6">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-slate-800 uppercase leading-none">{sale.clientName}</span>
                                <span className="text-[10px] font-black text-primary/40 mt-1">{sale.invoiceId}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right px-8 py-6 font-black text-slate-900 text-xs">{formatCurrency(netSale)}</TableCell>
                            <TableCell className="text-right px-8 py-6 text-muted-foreground text-xs font-bold">{formatCurrency(cost)}</TableCell>
                            <TableCell className="text-right px-8 py-6 font-black text-accent text-sm">{formatCurrency(marge)}</TableCell>
                            <TableCell className="text-center px-8 py-6">
                              <Badge className="bg-slate-100 text-slate-600 border-none font-black text-[10px] px-2 py-0.5 rounded-lg">
                                {margePercent}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-32 text-xs font-black uppercase text-muted-foreground opacity-30 tracking-[0.4em]">
                          Aucune donnée pour cette période.
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
