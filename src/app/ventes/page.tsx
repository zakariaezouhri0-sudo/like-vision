
"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Printer, Plus, MoreVertical, Edit2, Loader2, Trash2, Calendar as CalendarIcon, Filter, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, formatPhoneNumber, cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format, isSameDay, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export default function SalesHistoryPage() {
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TOUS");
  
  // État pour la période (par défaut: Aujourd'hui)
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: new Date(),
    to: new Date(),
  });

  const salesQuery = useMemoFirebase(() => {
    return query(collection(db, "sales"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: sales, isLoading: loading } = useCollection(salesQuery);

  const filteredSales = useMemo(() => {
    if (!sales) return [];
    return sales.filter((sale: any) => {
      // Filtre par période
      const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : null;
      let matchesDate = true;
      
      if (dateRange.from && saleDate) {
        matchesDate = isWithinInterval(saleDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.to || dateRange.from)
        });
      } else if (dateRange.from && !saleDate) {
        matchesDate = false;
      }

      // Filtre par texte
      const matchesSearch = 
        sale.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        sale.invoiceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.clientPhone?.includes(searchTerm.replace(/\s/g, ''));
      
      // Filtre par statut
      const matchesStatus = statusFilter === "TOUS" || sale.statut === statusFilter;

      return matchesDate && matchesSearch && matchesStatus;
    });
  }, [sales, searchTerm, statusFilter, dateRange]);

  const handlePrint = (sale: any) => {
    const params = new URLSearchParams({
      client: sale.clientName,
      phone: sale.clientPhone,
      mutuelle: sale.mutuelle,
      total: sale.total.toString(),
      remise: (sale.remise || 0).toString(),
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
      date: sale.createdAt?.toDate ? format(sale.createdAt.toDate(), "dd/MM/yyyy") : new Date().toLocaleDateString("fr-FR"),
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
      date_raw: sale.createdAt?.toDate ? sale.createdAt.toDate().toISOString() : "",
    });
    router.push(`/ventes/nouvelle?${params.toString()}`);
  };

  const handleDelete = async (id: string, invoiceId: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer la facture ${invoiceId} ? Cette action est irréversible.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, "sales", id));
      toast({
        variant: "success",
        title: "Facture supprimée",
        description: `La facture ${invoiceId} a été retirée de l'historique.`
      });
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: `sales/${id}`,
        operation: 'delete'
      }));
    }
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
            <div className="flex flex-col lg:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-primary/40" />
                <input 
                  placeholder="Chercher par client ou n° facture..." 
                  className="w-full pl-12 h-12 text-sm font-bold rounded-xl border-none shadow-inner bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                {/* Sélecteur de Période */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-12 px-4 rounded-xl font-bold bg-white border-none shadow-inner justify-start min-w-[220px]">
                      <CalendarIcon className="mr-2 h-4 w-4 text-primary/40" />
                      <span className="truncate">
                        {dateRange.from ? (
                          dateRange.to && !isSameDay(dateRange.from, dateRange.to) ? 
                            `${format(dateRange.from, "dd MMM", { locale: fr })} - ${format(dateRange.to, "dd MMM yyyy", { locale: fr })}` :
                            format(dateRange.from, "dd MMM yyyy", { locale: fr })
                        ) : "Toutes les dates"}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="end">
                    <div className="p-3 border-b bg-slate-50 flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-primary/40 ml-2">Filtrer par période</span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setDateRange({ from: undefined, to: undefined })} 
                        className="h-7 px-2 text-[9px] font-black uppercase hover:bg-primary/10"
                      >
                        Voir Tout
                      </Button>
                    </div>
                    <Calendar 
                      mode="range" 
                      selected={{ from: dateRange.from, to: dateRange.to }} 
                      onSelect={(range: any) => setDateRange({ from: range?.from, to: range?.to })} 
                      locale={fr} 
                      initialFocus 
                    />
                  </PopoverContent>
                </Popover>

                {/* Sélecteur de Statut */}
                <div className="w-full sm:w-48">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-12 rounded-xl font-bold bg-white border-none shadow-inner px-4">
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-primary/40" />
                        <SelectValue placeholder="Statut" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="TOUS" className="font-bold">Tous les statuts</SelectItem>
                      <SelectItem value="Payé" className="font-bold text-green-600">Payé</SelectItem>
                      <SelectItem value="Partiel" className="font-bold text-blue-600">Partiel</SelectItem>
                      <SelectItem value="En attente" className="font-bold text-red-600">En attente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
                      <TableHead className="text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Date</TableHead>
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
                          <TableCell className="px-4 md:px-8 py-5 md:py-6 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-[11px] font-bold text-slate-600">
                                {sale.createdAt?.toDate ? format(sale.createdAt.toDate(), "dd MMM yyyy", { locale: fr }) : "---"}
                              </span>
                            </div>
                          </TableCell>
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
                                {new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(sale.total - (sale.remise || 0))}
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
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10 hover:bg-primary/10 rounded-xl transition-all"><MoreVertical className="h-4 w-4 md:h-5 md:w-5" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-2xl border-primary/10 min-w-[180px]">
                                <DropdownMenuItem onClick={() => handlePrint(sale)} className="py-3 font-black text-[10px] md:text-[11px] uppercase cursor-pointer rounded-xl"><Printer className="mr-3 h-4 w-4 text-primary" /> Ré-imprimer</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEdit(sale)} className="py-3 font-black text-[10px] md:text-[11px] uppercase cursor-pointer rounded-xl"><Edit2 className="mr-3 h-4 w-4 text-primary" /> Modifier</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDelete(sale.id, sale.invoiceId)} className="py-3 font-black text-[10px] md:text-[11px] uppercase cursor-pointer rounded-xl text-destructive"><Trash2 className="mr-3 h-4 w-4" /> Supprimer</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={8} className="text-center py-32 text-xs font-black uppercase text-muted-foreground opacity-30 tracking-[0.4em]">Aucune facture trouvée pour cette sélection.</TableCell></TableRow>
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
