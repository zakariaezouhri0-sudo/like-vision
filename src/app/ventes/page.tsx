
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Printer, Plus, MoreVertical, Edit2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, formatPhoneNumber, cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function SalesHistoryPage() {
  const router = useRouter();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");

  const salesQuery = useMemoFirebase(() => {
    return query(collection(db, "sales"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: sales, isLoading: loading } = useCollection(salesQuery);

  const filteredSales = sales?.filter((sale: any) => 
    sale.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    sale.invoiceId?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handlePrint = (sale: any) => {
    const params = new URLSearchParams({
      client: sale.clientName,
      phone: sale.clientPhone,
      mutuelle: sale.mutuelle,
      total: sale.total.toString(),
      remise: sale.remise.toString(),
      remisePercent: sale.remisePercent || "0",
      avance: sale.avance.toString(),
      od_sph: sale.prescription?.od?.sph || "",
      od_cyl: sale.prescription?.od?.cyl || "",
      od_axe: sale.prescription?.od?.axe || "",
      og_sph: sale.prescription?.og?.sph || "",
      og_cyl: sale.prescription?.og?.cyl || "",
      og_axe: sale.prescription?.og?.axe || "",
      monture: sale.monture || "",
      verres: sale.verres || "",
      date: sale.createdAt?.toDate ? sale.createdAt.toDate().toLocaleDateString("fr-FR") : new Date().toLocaleDateString("fr-FR"),
    });
    router.push(`/ventes/facture/${sale.invoiceId}?${params.toString()}`);
  };

  const handleEdit = (sale: any) => {
    const params = new URLSearchParams({
      editId: sale.id,
      invoiceId: sale.invoiceId,
      client: sale.clientName,
      phone: sale.clientPhone,
      mutuelle: sale.mutuelle,
      total: sale.total.toString(),
      avance: sale.avance.toString(),
      discountValue: sale.discountValue?.toString() || "0",
      discountType: sale.discountType || "percent",
      purchasePriceFrame: (sale.purchasePriceFrame || 0).toString(),
      purchasePriceLenses: (sale.purchasePriceLenses || 0).toString(),
      monture: sale.monture || "",
      verres: sale.verres || "",
      notes: sale.notes || "",
      od_sph: sale.prescription?.od?.sph || "",
      od_cyl: sale.prescription?.od?.cyl || "",
      od_axe: sale.prescription?.od?.axe || "",
      og_sph: sale.prescription?.og?.sph || "",
      og_cyl: sale.prescription?.og?.cyl || "",
      og_axe: sale.prescription?.og?.axe || "",
    });
    router.push(`/ventes/nouvelle?${params.toString()}`);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Historique des Ventes</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.3em] opacity-60">Suivi complet de vos facturations.</p>
          </div>
          <Button asChild className="w-full sm:w-auto h-14 text-base font-black shadow-xl rounded-2xl px-8">
            <Link href="/ventes/nouvelle">
              <Plus className="mr-2 h-6 w-6" />
              NOUVELLE VENTE
            </Link>
          </Button>
        </div>

        <Card className="shadow-sm border-none overflow-hidden rounded-[32px] bg-white">
          <CardHeader className="p-4 md:p-6 border-b bg-slate-50/50">
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-primary/40" />
              <input 
                placeholder="Chercher par client ou n° facture..." 
                className="w-full pl-12 h-12 text-sm font-bold rounded-xl border-none shadow-inner bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" />
                  <span className="text-xs font-black uppercase text-muted-foreground tracking-widest">Chargement des ventes...</span>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Facture</TableHead>
                      <TableHead className="text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Client</TableHead>
                      <TableHead className="text-right text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Total</TableHead>
                      <TableHead className="text-right text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Avance</TableHead>
                      <TableHead className="text-right text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Reste</TableHead>
                      <TableHead className="text-center text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Statut</TableHead>
                      <TableHead className="text-right text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.length > 0 ? (
                      filteredSales.map((sale: any) => (
                        <TableRow key={sale.id} className="hover:bg-primary/5 border-b last:border-0 transition-all group">
                          <TableCell className="font-black text-xs md:text-sm text-primary px-4 md:px-8 py-5 md:py-6 whitespace-nowrap">{sale.invoiceId}</TableCell>
                          <TableCell className="px-4 md:px-8 py-5 md:py-6 min-w-[150px] whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-black text-xs md:text-sm text-slate-800 uppercase truncate">{sale.clientName}</span>
                              <span className="text-[10px] font-black text-slate-400 whitespace-nowrap">{formatPhoneNumber(sale.clientPhone)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-4 md:px-8 py-5 md:py-6 whitespace-nowrap">
                            <div className="flex items-baseline justify-end gap-1.5">
                              <span className="font-black text-xs md:text-sm text-slate-900 leading-none">
                                {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(sale.total)}
                              </span>
                              <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase">DH</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-4 md:px-8 py-5 md:py-6 whitespace-nowrap">
                            <div className="flex items-baseline justify-end gap-1.5">
                              <span className="font-black text-xs md:text-sm text-green-600 leading-none">
                                {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(sale.avance || 0)}
                              </span>
                              <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase">DH</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-4 md:px-8 py-5 md:py-6 whitespace-nowrap">
                            <div className="flex items-baseline justify-end gap-1.5">
                              <span className={cn("font-black text-xs md:text-sm leading-none", (sale.reste || 0) > 0 ? "text-destructive" : "text-slate-300")}>
                                {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(sale.reste || 0)}
                              </span>
                              <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase">DH</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center px-4 md:px-8 py-5 md:py-6">
                            <Badge 
                              className={cn(
                                "text-[8px] md:text-[9px] px-2 md:px-3 py-1 font-black rounded-lg uppercase tracking-tighter shadow-sm border-none whitespace-nowrap",
                                sale.statut === "Payé" ? "bg-green-100 text-green-700" : 
                                sale.statut === "En attente" ? "bg-red-100 text-red-700" : 
                                "bg-blue-100 text-blue-700"
                              )}
                              variant="outline"
                            >
                              {sale.statut}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right px-4 md:px-8 py-5 md:py-6">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10 hover:bg-primary/10 rounded-xl transition-all"><MoreVertical className="h-4 w-4 md:h-5 md:w-5" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-2xl border-primary/10 min-w-[180px]">
                                <DropdownMenuItem onClick={() => handlePrint(sale)} className="py-3 font-black text-[10px] md:text-[11px] uppercase cursor-pointer rounded-xl"><Printer className="mr-3 h-4 w-4 text-primary" /> Ré-imprimer</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(sale)} className="py-3 font-black text-[10px] md:text-[11px] uppercase cursor-pointer rounded-xl"><Edit2 className="mr-3 h-4 w-4 text-primary" /> Modifier</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={7} className="text-center py-32 text-xs font-black uppercase text-muted-foreground opacity-30 tracking-[0.4em]">Aucune facture enregistrée.</TableCell></TableRow>
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
