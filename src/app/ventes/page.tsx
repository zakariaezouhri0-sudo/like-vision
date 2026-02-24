
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
import { formatCurrency, cn } from "@/lib/utils";
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
          <CardHeader className="p-6 border-b bg-slate-50/50">
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-primary/40" />
              <Input 
                placeholder="Chercher par client ou n° facture..." 
                className="pl-12 h-12 text-sm font-bold rounded-xl border-none shadow-inner bg-white"
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
                    <TableRow>
                      <TableHead className="text-[11px] uppercase font-black px-8 py-5 tracking-widest">Facture</TableHead>
                      <TableHead className="text-[11px] uppercase font-black px-8 py-5 tracking-widest">Client</TableHead>
                      <TableHead className="text-right text-[11px] uppercase font-black px-8 py-5 tracking-widest">Total</TableHead>
                      <TableHead className="text-right text-[11px] uppercase font-black px-8 py-5 tracking-widest">Reste</TableHead>
                      <TableHead className="text-center text-[11px] uppercase font-black px-8 py-5 tracking-widest">Statut</TableHead>
                      <TableHead className="text-right text-[11px] uppercase font-black px-8 py-5 tracking-widest">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.length > 0 ? (
                      filteredSales.map((sale: any) => (
                        <TableRow key={sale.id} className="hover:bg-primary/5 border-b last:border-0 transition-all group">
                          <TableCell className="font-black text-sm text-primary px-8 py-6">{sale.invoiceId}</TableCell>
                          <TableCell className="px-8 py-6">
                            <div className="flex flex-col">
                              <span className="font-black text-sm text-slate-800 uppercase">{sale.clientName}</span>
                              <span className="text-[10px] font-bold text-slate-400">{sale.clientPhone}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-8 py-6">
                            <div className="flex flex-col items-end">
                              <span className="font-black text-sm text-slate-900">{formatCurrency(sale.total).split(' ')[0]}</span>
                              <span className="text-[9px] font-black text-slate-400 uppercase">DH</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right px-8 py-6">
                            <div className="flex flex-col items-end">
                              <span className={cn("font-black text-sm", sale.reste > 0 ? "text-destructive" : "text-slate-300")}>
                                {formatCurrency(sale.reste).split(' ')[0]}
                              </span>
                              <span className="text-[9px] font-black text-slate-400 uppercase">DH</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center px-8 py-6">
                            <Badge 
                              className={cn(
                                "text-[9px] px-3 py-1 font-black rounded-lg uppercase tracking-tighter shadow-sm border-none",
                                sale.statut === "Payé" ? "bg-green-100 text-green-700" : 
                                sale.statut === "En attente" ? "bg-red-100 text-red-700" : 
                                "bg-blue-100 text-blue-700"
                              )}
                              variant="outline"
                            >
                              {sale.statut}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right px-8 py-6">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-primary/10 rounded-xl"><MoreVertical className="h-5 w-5" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-2xl border-primary/10 min-w-[180px]">
                                <DropdownMenuItem onClick={() => handlePrint(sale)} className="py-3 font-black text-[11px] uppercase cursor-pointer rounded-xl"><Printer className="mr-3 h-4 w-4 text-primary" /> Ré-imprimer</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(sale)} className="py-3 font-black text-[11px] uppercase cursor-pointer rounded-xl"><Edit2 className="mr-3 h-4 w-4 text-primary" /> Modifier</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={6} className="text-center py-32 text-xs font-black uppercase text-muted-foreground opacity-30 tracking-[0.4em]">Aucune facture enregistrée.</TableCell></TableRow>
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
