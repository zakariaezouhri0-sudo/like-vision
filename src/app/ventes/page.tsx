
"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Search, Printer, Plus, MoreVertical, Edit2, Loader2, Trash2, Calendar as CalendarIcon, Filter, X, RotateCcw, FileText, Tag, Save, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, formatPhoneNumber, cn } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, deleteDoc, doc, updateDoc, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export default function SalesHistoryPage() {
  const router = useRouter();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TOUS");
  const [role, setRole] = useState<string>("OPTICIENNE");
  
  const [dateFrom, setDateFrom] = useState<Date | undefined>(new Date());
  const [dateTo, setDateTo] = useState<Date | undefined>(new Date());

  const [costDialogSale, setCostDialogSale] = useState<any>(null);
  const [purchaseCosts, setPurchaseCosts] = useState({ frame: "", lenses: "", label: "" });
  const [isSavingCosts, setIsSavingCosts] = useState(false);

  useEffect(() => {
    setRole(localStorage.getItem('user_role') || "OPTICIENNE");
  }, []);

  const isAdminOrPrepa = role === 'ADMIN' || role === 'PREPA';
  const isPrepaMode = role === "PREPA";

  const salesQuery = useMemoFirebase(() => {
    return query(collection(db, "sales"), orderBy("createdAt", "desc"));
  }, [db]);

  const { data: rawSales, isLoading: loading } = useCollection(salesQuery);

  const filteredSales = useMemo(() => {
    if (!rawSales) return [];
    return rawSales.filter((sale: any) => {
      const matchesMode = isPrepaMode ? sale.isDraft === true : !sale.isDraft;
      if (!matchesMode) return false;

      const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : null;
      let matchesDate = true;
      if (dateFrom && saleDate) {
        const start = startOfDay(dateFrom);
        const end = endOfDay(dateTo || dateFrom);
        const finalStart = start < end ? start : end;
        const finalEnd = start < end ? end : start;
        matchesDate = isWithinInterval(saleDate, { start: finalStart, end: finalEnd });
      }

      const matchesSearch = 
        sale.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        sale.invoiceId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.clientPhone?.includes(searchTerm.replace(/\s/g, ''));
      
      const matchesStatus = statusFilter === "TOUS" || sale.statut === statusFilter;

      return matchesDate && matchesSearch && matchesStatus;
    });
  }, [rawSales, searchTerm, statusFilter, dateFrom, dateTo, isPrepaMode]);

  const handlePrint = (sale: any) => {
    const isPaid = (sale.reste || 0) <= 0;
    const page = isPaid ? 'facture' : 'recu';
    const params = new URLSearchParams({
      client: sale.clientName, phone: sale.clientPhone, mutuelle: sale.mutuelle,
      total: sale.total.toString(), remise: (sale.remise || 0).toString(), remisePercent: sale.remisePercent || "0",
      avance: sale.avance.toString(), od_sph: sale.prescription?.od?.sph || "", od_cyl: sale.prescription?.od?.cyl || "",
      od_axe: sale.prescription?.od?.axe || "", og_sph: sale.prescription?.og?.sph || "", og_cyl: sale.prescription?.og?.cyl || "",
      og_axe: sale.prescription?.og?.axe || "", monture: sale.monture || "", verres: sale.verres || "",
      date: sale.createdAt?.toDate ? format(sale.createdAt.toDate(), "dd/MM/yyyy") : new Date().toLocaleDateString("fr-FR"),
    });
    router.push(`/ventes/${page}/${sale.invoiceId}?${params.toString()}`);
  };

  const handleEdit = (sale: any) => {
    const params = new URLSearchParams({
      editId: sale.id, invoiceId: sale.invoiceId, client: sale.clientName, phone: sale.clientPhone,
      mutuelle: sale.mutuelle, total: sale.total.toString(), avance: sale.avance.toString(),
      discountValue: sale.discountValue?.toString() || "0", discountType: sale.discountType || "percent",
      purchasePriceFrame: (sale.purchasePriceFrame || 0).toString(), purchasePriceLenses: (sale.purchasePriceLenses || 0).toString(),
      monture: sale.monture || "", verres: sale.verres || "", notes: sale.notes || "",
      od_sph: sale.prescription?.od?.sph || "", od_cyl: sale.prescription?.od?.cyl || "", od_axe: sale.prescription?.od?.axe || "",
      og_sph: sale.prescription?.og?.sph || "", og_cyl: sale.prescription?.og?.cyl || "", og_axe: sale.prescription?.og?.axe || "",
      date_raw: sale.createdAt?.toDate ? sale.createdAt.toDate().toISOString() : "",
    });
    router.push(`/ventes/nouvelle?${params.toString()}`);
  };

  const handleOpenCosts = (sale: any) => {
    setCostDialogSale(sale);
    setPurchaseCosts({ frame: (sale.purchasePriceFrame || 0).toString(), lenses: (sale.purchasePriceLenses || 0).toString(), label: "" });
  };

  const handleUpdateCosts = async () => {
    if (!costDialogSale) return;
    setIsSavingCosts(true);
    const frameCost = parseFloat(purchaseCosts.frame) || 0;
    const lensesCost = parseFloat(purchaseCosts.lenses) || 0;
    const currentUserName = user?.displayName || "Inconnu";
    
    // Libellé de base ou personnalisé
    const labelSuffix = purchaseCosts.label ? purchaseCosts.label : costDialogSale.invoiceId;

    try {
      const saleRef = doc(db, "sales", costDialogSale.id);
      await updateDoc(saleRef, { purchasePriceFrame: frameCost, purchasePriceLenses: lensesCost, updatedAt: serverTimestamp() });
      
      if (frameCost > 0) {
        await addDoc(collection(db, "transactions"), {
          type: "DEPENSE", 
          label: `Achat Monture - ${labelSuffix}`,
          clientName: costDialogSale.clientName || '---',
          category: "Achats", 
          montant: -Math.abs(frameCost), 
          relatedId: costDialogSale.invoiceId, 
          userName: currentUserName,
          isDraft: isPrepaMode, 
          createdAt: serverTimestamp()
        });
      }
      if (lensesCost > 0) {
        await addDoc(collection(db, "transactions"), {
          type: "DEPENSE", 
          label: `Achat Verres - ${labelSuffix}`,
          clientName: costDialogSale.clientName || '---',
          category: "Achats", 
          montant: -Math.abs(lensesCost), 
          relatedId: costDialogSale.invoiceId, 
          userName: currentUserName,
          isDraft: isPrepaMode, 
          createdAt: serverTimestamp()
        });
      }
      
      toast({ variant: "success", title: "Coûts mis à jour" });
      setCostDialogSale(null);
    } catch (e) { 
      toast({ variant: "destructive", title: "Erreur" }); 
    } finally { 
      setIsSavingCosts(false); 
    }
  };

  const handleDelete = async (id: string, invoiceId: string) => {
    if (!confirm(`Voulez-vous vraiment supprimer la facture ${invoiceId} ?`)) return;
    try {
      await deleteDoc(doc(db, "sales", id));
      toast({ variant: "success", title: "Facture supprimée" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Historique {isPrepaMode ? "(Brouillon)" : "Ventes"}</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.3em] opacity-60">
              {isPrepaMode ? "Espace de préparation isolé." : "Suivi complet de vos facturations."}
            </p>
          </div>
          <Button asChild className="w-full sm:w-auto h-14 text-base font-black shadow-xl rounded-2xl px-8">
            <Link href="/ventes/nouvelle"><Plus className="mr-2 h-6 w-6" />NOUVELLE VENTE</Link>
          </Button>
        </div>

        <Card className="shadow-sm border-none overflow-hidden rounded-[32px] bg-white">
          <CardHeader className="p-6 border-b bg-slate-50/50">
            <div className="flex flex-col lg:flex-row items-end gap-4">
              <div className="flex-1 space-y-1.5 w-full">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Client ou N° Document</Label>
                <div className="relative">
                  <Search className="absolute left-4 top-3.5 h-5 w-5 text-primary/40" />
                  <input placeholder="Rechercher..." className="w-full pl-12 h-12 text-sm font-bold rounded-xl border-none shadow-inner bg-white focus:ring-2 focus:ring-primary/20 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
              <div className="w-full lg:w-44 space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Du</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-12 rounded-xl font-bold text-sm bg-white border-none shadow-inner justify-start px-4">
                      <CalendarIcon className="mr-2 h-4 w-4 text-primary/40" />{dateFrom ? format(dateFrom, "dd/MM/yy") : "---"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={fr} initialFocus /></PopoverContent>
                </Popover>
              </div>
              <div className="w-full lg:w-44 space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Au</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-12 rounded-xl font-bold text-sm bg-white border-none shadow-inner justify-start px-4">
                      <CalendarIcon className="mr-2 h-4 w-4 text-primary/40" />{dateTo ? format(dateTo, "dd/MM/yy") : "---"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start"><Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={fr} initialFocus /></PopoverContent>
                </Popover>
              </div>
              <div className="w-full lg:w-48 space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Statut</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-12 rounded-xl font-bold bg-white border-none shadow-inner px-4"><SelectValue /></SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="TOUS" className="font-bold">Tous</SelectItem>
                    <SelectItem value="Payé" className="font-bold text-green-600">Payé</SelectItem>
                    <SelectItem value="Partiel" className="font-bold text-blue-600">Partiel</SelectItem>
                    <SelectItem value="En attente" className="font-bold text-red-600">En attente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4"><Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" /><span className="text-xs font-black uppercase text-muted-foreground">Chargement...</span></div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50/80">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Date & Heure</TableHead>
                      <TableHead className="text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Document</TableHead>
                      <TableHead className="text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Client</TableHead>
                      <TableHead className="text-right text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Total Net</TableHead>
                      <TableHead className="text-right text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Versé</TableHead>
                      <TableHead className="text-right text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Reste</TableHead>
                      <TableHead className="text-center text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Statut</TableHead>
                      <TableHead className="text-right text-[10px] md:text-[11px] uppercase font-black px-4 md:px-8 py-5 tracking-widest whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.length > 0 ? filteredSales.map((sale: any) => (
                      <TableRow key={sale.id} className="hover:bg-primary/5 border-b last:border-0 transition-all group">
                        <TableCell className="px-4 md:px-8 py-5 md:py-6 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2"><CalendarIcon className="h-3 w-3 text-primary/40" /><span className="text-[11px] font-bold text-slate-600">{sale.createdAt?.toDate ? format(sale.createdAt.toDate(), "dd MMM yyyy", { locale: fr }) : "---"}</span></div>
                            <div className="flex items-center gap-2"><Clock className="h-3 w-3 text-primary/40" /><span className="text-[10px] font-black text-primary/60">{sale.createdAt?.toDate ? format(sale.createdAt.toDate(), "HH:mm") : "--:--"}</span></div>
                          </div>
                        </TableCell>
                        <TableCell className="font-black text-xs md:text-sm text-primary px-4 md:px-8 py-5 md:py-6 whitespace-nowrap">{sale.invoiceId}</TableCell>
                        <TableCell className="px-4 md:px-8 py-5 md:py-6 min-w-[150px] whitespace-nowrap">
                          <div className="flex flex-col"><span className="font-black text-xs md:text-sm text-slate-800 uppercase truncate">{sale.clientName}</span><span className="text-[10px] font-black text-slate-400">{formatPhoneNumber(sale.clientPhone)}</span></div>
                        </TableCell>
                        <TableCell className="text-right px-4 md:px-8 py-5 md:py-6 whitespace-nowrap"><span className="font-black text-xs md:text-sm text-slate-900">{formatCurrency(sale.total - (sale.remise || 0))}</span></TableCell>
                        <TableCell className="text-right px-4 md:px-8 py-5 md:py-6 whitespace-nowrap"><span className="font-black text-xs md:text-sm text-green-600">{formatCurrency(sale.avance || 0)}</span></TableCell>
                        <TableCell className="text-right px-4 md:px-8 py-5 md:py-6 whitespace-nowrap"><span className={cn("font-black text-xs md:text-sm", (sale.reste || 0) > 0 ? "text-red-500" : "text-slate-300")}>{formatCurrency(sale.reste || 0)}</span></TableCell>
                        <TableCell className="text-center px-4 md:px-8 py-5 md:py-6"><Badge className={cn("text-[8px] md:text-[9px] px-2 md:px-3 py-1 font-black rounded-lg uppercase tracking-tighter shadow-sm border-none whitespace-nowrap", sale.statut === "Payé" ? "bg-green-100 text-green-700" : sale.statut === "En attente" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700")} variant="outline">{sale.statut}</Badge></TableCell>
                        <TableCell className="text-right px-4 md:px-8 py-5 md:py-6">
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10 hover:bg-primary/10 rounded-xl transition-all"><MoreVertical className="h-4 w-4 md:h-5 md:w-5" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-2xl p-2 shadow-2xl border-primary/10 min-w-[180px]">
                              <DropdownMenuItem onClick={() => handlePrint(sale)} className="py-3 font-black text-[10px] md:text-[11px] uppercase cursor-pointer rounded-xl">{sale.reste <= 0 ? <FileText className="mr-3 h-4 w-4 text-primary" /> : <Printer className="mr-3 h-4 w-4 text-primary" />}{sale.reste <= 0 ? "Facture" : "Reçu"}</DropdownMenuItem>
                              
                              <DropdownMenuItem onClick={() => handleOpenCosts(sale)} className="py-3 font-black text-[10px] md:text-[11px] uppercase cursor-pointer rounded-xl"><Tag className="mr-3 h-4 w-4 text-primary" /> Coûts d'Achat</DropdownMenuItem>
                              
                              {isAdminOrPrepa && (
                                <>
                                  <DropdownMenuItem onClick={() => handleEdit(sale)} className="py-3 font-black text-[10px] md:text-[11px] uppercase cursor-pointer rounded-xl"><Edit2 className="mr-3 h-4 w-4 text-primary" /> Modifier</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDelete(sale.id, sale.invoiceId)} className="py-3 font-black text-[10px] md:text-[11px] uppercase cursor-pointer rounded-xl text-destructive"><Trash2 className="mr-3 h-4 w-4" /> Supprimer</DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )) : <TableRow><TableCell colSpan={8} className="text-center py-32 text-xs font-black uppercase opacity-30 tracking-[0.4em]">Aucun document trouvé.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dialog for Purchase Costs */}
        <Dialog open={!!costDialogSale} onOpenChange={(o) => !o && setCostDialogSale(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
            <DialogHeader className="p-6 md:p-8 bg-primary text-white">
              <DialogTitle className="text-xl md:text-2xl font-black uppercase flex items-center gap-3"><Tag className="h-6 w-6" /> Coûts d'Achat (Interne)</DialogTitle>
              <p className="text-[10px] md:text-sm font-bold opacity-60 mt-1 uppercase tracking-widest">Facture {costDialogSale?.invoiceId}</p>
            </DialogHeader>
            <div className="p-6 md:p-8 space-y-6 bg-white">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Coût Monture (DH)</Label>
                  <Input type="number" className="h-14 text-lg font-black rounded-2xl bg-slate-50 border-none shadow-inner text-center" value={purchaseCosts.frame} onChange={(e) => setPurchaseCosts({...purchaseCosts, frame: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Coût Verres (DH)</Label>
                  <Input type="number" className="h-14 text-lg font-black rounded-2xl bg-slate-50 border-none shadow-inner text-center" value={purchaseCosts.lenses} onChange={(e) => setPurchaseCosts({...purchaseCosts, lenses: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Libellé / Note d'achat</Label>
                <Input placeholder="Ex: Verres Nikon..." className="h-14 text-sm font-bold rounded-2xl bg-slate-50 border-none shadow-inner" value={purchaseCosts.label} onChange={(e) => setPurchaseCosts({...purchaseCosts, label: e.target.value})} />
              </div>
            </div>
            <DialogFooter className="p-6 md:p-8 pt-0 bg-white flex flex-col sm:flex-row gap-3">
              <Button variant="ghost" className="w-full h-12 font-black uppercase text-[10px]" onClick={() => setCostDialogSale(null)}>Annuler</Button>
              <Button className="w-full h-12 font-black uppercase shadow-xl text-[10px] text-white" onClick={handleUpdateCosts} disabled={isSavingCosts}>{isSavingCosts ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />} VALIDER LES COÛTS</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
