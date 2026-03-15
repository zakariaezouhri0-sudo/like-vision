
"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Printer, Plus, MoreVertical, Edit2, Loader2, Trash2, Calendar as CalendarIcon, Filter, X, RotateCcw, FileText, Tag, Save, Clock, History as HistoryIcon, CheckSquare, HandCoins, Lock, MessageSquare } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, formatPhoneNumber, cn, roundAmount, parseAmount, copyAndOpenWhatsApp } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, query, orderBy, deleteDoc, doc, updateDoc, addDoc, serverTimestamp, Timestamp, writeBatch, where, runTransaction, arrayUnion, getDoc, limit } from "firebase/firestore";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { format, isWithinInterval, startOfDay, endOfDay, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

function SalesHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState("TOUS");
  const [role, setRole] = useState<string>("");
  const [isReady, setIsReady] = useState(false);
  
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const [costDialogSale, setCostDialogSale] = useState<any>(null);
  const [purchaseCosts, setPurchaseCosts] = useState({ frame: "", lenses: "", label: "" });
  const [isSavingCosts, setIsSavingCosts] = useState(false);

  const [paymentSale, setPaymentSale] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role') || "OPTICIENNE";
    setRole(savedRole.toUpperCase());
    setIsReady(true);
  }, []);

  const isPrepaMode = role === "PREPA";
  const isAdminOrPrepa = role === 'ADMIN' || role === 'PREPA';

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: settings } = useDoc(settingsRef);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const sessionDocId = isPrepaMode ? `DRAFT-${todayStr}` : todayStr;
  const sessionRef = useMemoFirebase(() => isReady ? doc(db, "cash_sessions", sessionDocId) : null, [db, sessionDocId, isReady]);
  const { data: sessionData, isLoading: sessionLoading } = useDoc(sessionRef);
  const isTodayClosed = !sessionLoading && sessionData?.status === "CLOSED";

  const salesQuery = useMemoFirebase(() => query(
    collection(db, "sales"),
    orderBy("createdAt", "desc"),
    limit(100)
  ), [db]);
  const { data: rawSales, isLoading: loading } = useCollection(salesQuery);

  const filteredSales = useMemo(() => {
    if (!rawSales || !isReady) return [];
    
    return rawSales
      .filter((sale: any) => {
        const matchesMode = isPrepaMode ? sale.isDraft === true : (sale.isDraft !== true);
        if (!matchesMode) return false;

        const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : null;
        let matchesDate = true;
        if (dateFrom) {
          if (!saleDate) {
            matchesDate = false;
          } else {
            const start = startOfDay(dateFrom);
            const end = endOfDay(dateTo || dateFrom);
            matchesDate = isWithinInterval(saleDate, { start: start < end ? start : end, end: start < end ? end : start });
          }
        }

        const search = searchTerm.toLowerCase().trim();
        const matchesSearch = !search || (sale.clientName || "").toLowerCase().includes(search) || (sale.invoiceId || "").toLowerCase().includes(search) || (sale.clientPhone || "").replace(/\s/g, '').includes(search.replace(/\s/g, ''));
        const matchesStatus = statusFilter === "TOUS" || sale.statut === statusFilter;
        return matchesDate && matchesSearch && matchesStatus;
      });
  }, [rawSales, searchTerm, statusFilter, dateFrom, dateTo, isPrepaMode, isReady]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSales.length && filteredSales.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredSales.map(s => s.id)));
  };

  const toggleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const checkSessionStatus = async (sale: any) => {
    if (!sale.createdAt?.toDate) return false;
    const dateStr = format(sale.createdAt.toDate(), "yyyy-MM-dd");
    const sessionId = isPrepaMode ? `DRAFT-${dateStr}` : dateStr;
    const snap = await getDoc(doc(db, "cash_sessions", sessionId));
    return snap.exists() && snap.data().status === "CLOSED";
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Voulez-vous vraiment supprimer les ${selectedIds.size} ventes sélectionnées ?`)) return;

    setIsDeletingBulk(true);
    try {
      const batch = writeBatch(db);
      for (const id of Array.from(selectedIds)) {
        const sale = rawSales?.find(s => s.id === id);
        if (sale && await checkSessionStatus(sale)) {
          toast({ variant: "destructive", title: "Action Rejetée", description: `La vente ${sale.invoiceId} appartient à une caisse clôturée.` });
          continue;
        }
        batch.delete(doc(db, "sales", id));
      }
      await batch.commit();
      toast({ variant: "success", title: "Opération terminée" });
      setSelectedIds(new Set());
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setIsDeletingBulk(false); }
  };

  const handleEdit = async (sale: any) => {
    if (await checkSessionStatus(sale)) {
      toast({ variant: "destructive", title: "Accès Refusé", description: "Cette caisse est clôturée. Ré-ouvrez la pour modifier." });
      return;
    }
    const params = new URLSearchParams({ 
      editId: sale.id, invoiceId: sale.invoiceId, client: sale.clientName || "---", phone: sale.clientPhone || "", 
      mutuelle: sale.mutuelle || "---", total: (sale.total || 0).toString(), avance: (sale.avance || 0).toString(), 
      discountValue: sale.discountValue?.toString() || "0", discountType: sale.discountType || "fixed", 
      monture: sale.monture || "", verres: sale.verres || "", notes: sale.notes || "", 
      od_sph: sale.prescription?.od?.sph || "", od_cyl: sale.prescription?.od?.cyl || "", 
      od_axe: sale.prescription?.od?.axe || "", od_add: sale.prescription?.od?.add || "",
      date_raw: sale.createdAt?.toDate ? sale.createdAt.toDate().toISOString() : "" 
    });
    router.push(`/ventes/nouvelle?${params.toString()}`);
  };

  const handleDelete = async (sale: any) => {
    if (await checkSessionStatus(sale)) {
      toast({ variant: "destructive", title: "Action Rejetée", description: "Impossible de supprimer une vente sur une caisse close." });
      return;
    }
    if (!confirm("Supprimer cette vente ?")) return;
    try {
      await deleteDoc(doc(db, "sales", sale.id));
      toast({ variant: "success", title: "Vente supprimée" });
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); }
  };

  const handlePrint = (sale: any) => {
    const page = sale.reste <= 0 ? 'facture' : 'recu';
    let formattedDate = "---";
    try {
      const d = sale.createdAt?.toDate ? sale.createdAt.toDate() : null;
      if (d && isValid(d)) formattedDate = format(d, "dd-MM-yyyy");
    } catch (e) {}

    const params = new URLSearchParams({ 
      client: sale.clientName || "---", phone: (sale.clientPhone || "").replace(/\s/g, ""), mutuelle: sale.mutuelle || "---", 
      total: sale.total.toString(), remise: (sale.remise || 0).toString(), 
      remisePercent: sale.discountType === 'percent' ? sale.discountValue?.toString() : "Fixe",
      avance: (sale.avance || 0).toString(), od_sph: sale.prescription?.od?.sph || "---", od_cyl: sale.prescription?.od?.cyl || "---", 
      od_axe: sale.prescription?.od?.axe || "---", od_add: sale.prescription?.od?.add || "---",
      og_sph: sale.prescription?.og?.sph || "---", og_cyl: sale.prescription?.og?.cyl || "---", 
      og_axe: sale.prescription?.og?.axe || "---", og_add: sale.prescription?.og?.add || "---",
      monture: sale.monture || "---", verres: sale.verres || "---", date: formattedDate
    });
    router.push(`/ventes/${page}/${sale.invoiceId}?${params.toString()}`);
  };

  const handleUpdateCosts = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!costDialogSale) return;
    setIsSavingCosts(true);
    const frameCost = parseAmount(purchaseCosts.frame);
    const lensesCost = parseAmount(purchaseCosts.lenses);
    const labelSuffix = purchaseCosts.label || costDialogSale.invoiceId;
    try {
      await updateDoc(doc(db, "sales", costDialogSale.id), { purchasePriceFrame: frameCost, purchasePriceLenses: lensesCost, updatedAt: serverTimestamp() });
      if (frameCost > 0) await addDoc(collection(db, "transactions"), { type: "DEPENSE", label: `ACHAT MONTURE - ${labelSuffix}`, clientName: costDialogSale.clientName || "---", category: "Achats", montant: -Math.abs(frameCost), relatedId: costDialogSale.invoiceId, userName: user?.displayName || "---", isDraft: isPrepaMode, createdAt: serverTimestamp() });
      if (lensesCost > 0) await addDoc(collection(db, "transactions"), { type: "DEPENSE", label: `ACHAT VERRES - ${labelSuffix}`, clientName: costDialogSale.clientName || "---", category: "Achats", montant: -Math.abs(lensesCost), relatedId: costDialogSale.invoiceId, userName: user?.displayName || "---", isDraft: isPrepaMode, createdAt: serverTimestamp() });
      toast({ variant: "success", title: "Coûts enregistrés" });
      setCostDialogSale(null);
    } catch (e) { toast({ variant: "destructive", title: "Erreur" }); } finally { setIsSavingCosts(false); }
  };

  const handleValidatePayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!paymentSale || !paymentAmount) return;
    if (isTodayClosed) { toast({ variant: "destructive", title: "Caisse Fermée", description: "Règlement impossible aujourd'hui." }); return; }

    const amount = parseAmount(paymentAmount);
    if (amount <= 0) return;
    setIsProcessingPayment(true);
    const currentUserName = user?.displayName || "Inconnu";

    try {
      await runTransaction(db, async (transaction) => {
        if (sessionRef) {
          const sSnap = await transaction.get(sessionRef);
          if (sSnap.exists() && sSnap.data().status === "CLOSED") throw new Error("SESSION_CLOSED");
        }
        const saleRef = doc(db, "sales", paymentSale.id);
        const saleSnap = await transaction.get(saleRef);
        if (!saleSnap.exists()) throw new Error("NOT_FOUND");

        const currentData = saleSnap.data();
        const totalNet = currentData.total - (currentData.remise || 0);
        const newAvance = (currentData.avance || 0) + amount;
        const newReste = Math.max(0, totalNet - newAvance);
        const isFullyPaid = newReste <= 0;
        let finalInvoiceId = currentData.invoiceId;
        if (isFullyPaid && finalInvoiceId.startsWith("RC-")) finalInvoiceId = finalInvoiceId.replace("RC-", "FC-");

        transaction.update(saleRef, { invoiceId: finalInvoiceId, avance: newAvance, reste: newReste, statut: isFullyPaid ? "Payé" : "Partiel", payments: arrayUnion({ amount, date: new Date().toISOString(), userName: currentUserName, note: "Règlement Historique" }), updatedAt: serverTimestamp() });
        transaction.set(doc(collection(db, "transactions")), { type: "VENTE", label: `VENTE ${finalInvoiceId}`, clientName: currentData.clientName, montant: amount, relatedId: finalInvoiceId, saleId: paymentSale.id, userName: currentUserName, isDraft: isPrepaMode, isBalancePayment: true, createdAt: serverTimestamp() });
      });
      toast({ variant: "success", title: "Paiement enregistré" });
      setPaymentSale(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: err.message === "SESSION_CLOSED" ? "Caisse Fermée" : "Erreur" });
    } finally { setIsProcessingPayment(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Historique Ventes {isPrepaMode ? "(Brouillon)" : ""}</h1><p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.3em] opacity-60">Suivi complet de vos facturations (100 dernières).</p></div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {selectedIds.size > 0 && isAdminOrPrepa && (<Button variant="destructive" onClick={handleBulkDelete} disabled={isDeletingBulk} className="h-14 font-black rounded-2xl px-6 shadow-xl">{isDeletingBulk ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Trash2 className="h-5 w-5 mr-2" />} SUPPRIMER ({selectedIds.size})</Button>)}
          <Button asChild className="flex-1 sm:flex-none h-14 font-black rounded-2xl px-8 shadow-lg"><Link href="/ventes/nouvelle"><Plus className="mr-2 h-6 w-6" />NOUVELLE VENTE</Link></Button>
        </div>
      </div>

      <Card className="shadow-sm rounded-[32px] bg-white">
        <CardHeader className="p-6 border-b bg-slate-50/50">
          <div className="flex flex-col lg:flex-row items-end gap-4">
            <div className="flex-1 space-y-1.5 w-full"><Label className="text-[10px] font-black uppercase text-muted-foreground">Client ou N° Document</Label><div className="relative"><Search className="absolute left-4 top-3.5 h-5 w-5 text-primary/40" /><input placeholder="Chercher..." className="w-full pl-12 h-12 text-sm font-bold rounded-xl border-none shadow-inner outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></div>
            <div className="w-full lg:w-44 space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">Du</Label><Popover><PopoverTrigger asChild><Button variant="outline" className="w-full h-12 rounded-xl font-bold text-sm bg-white border-none shadow-inner justify-start px-4"><CalendarIcon className="mr-2 h-4 w-4 text-primary/40" />{dateFrom ? format(dateFrom, "dd-MM-yyyy") : "Toutes dates"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl"><Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={fr} initialFocus /></PopoverContent></Popover></div>
            <div className="w-full lg:w-48 space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">Statut</Label><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-12 rounded-xl font-bold bg-white border-none shadow-inner px-4"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="TOUS" className="font-bold">Tous</SelectItem><SelectItem value="Payé" className="font-bold text-green-600">Payé</SelectItem><SelectItem value="Partiel" className="font-bold text-blue-600">Partiel</SelectItem><SelectItem value="En attente" className="font-bold text-red-600">En attente</SelectItem></SelectContent></Select></div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[1100px]">
              <TableHeader className="bg-slate-800">
                <TableRow>
                  {isAdminOrPrepa && (<TableHead className="w-12 px-4 py-5 text-center"><Checkbox className="border-white" checked={filteredSales.length > 0 && selectedIds.size === filteredSales.length} onCheckedChange={toggleSelectAll} /></TableHead>)}
                  <TableHead className="text-[10px] uppercase font-black px-4 md:px-8 py-5 text-white">Date</TableHead>
                  <TableHead className="text-[10px] uppercase font-black px-4 md:px-8 py-5 text-white">Document</TableHead>
                  <TableHead className="text-[10px] uppercase font-black px-4 md:px-8 py-5 text-white">Client</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-4 md:px-8 py-5 text-white">Total Net</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-4 md:px-8 py-5 text-white">Versé</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-4 md:px-8 py-5 text-white">Reste</TableHead>
                  <TableHead className="text-center text-[10px] uppercase font-black px-4 md:px-8 py-5 text-white">Statut</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-4 md:px-8 py-5 text-white">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="py-24 text-center"><Loader2 className="h-12 w-12 animate-spin mx-auto opacity-20" /></TableCell></TableRow>
                ) : filteredSales.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-20 text-[10px] font-black uppercase text-muted-foreground opacity-30">Aucune vente trouvée.</TableCell></TableRow>
                ) : (
                  filteredSales.map((sale: any) => {
                    const histAmt = (sale.payments || []).filter((p: any) => p.userName === "Historique" || p.userName === "Import").reduce((acc: number, p: any) => acc + (p.amount || 0), 0);
                    return (
                      <TableRow key={sale.id} className={cn("hover:bg-primary/5 transition-all", selectedIds.has(sale.id) && "bg-primary/5")}>
                        {isAdminOrPrepa && (<TableCell className="w-12 px-4 py-5 text-center"><Checkbox checked={selectedIds.has(sale.id)} onCheckedChange={() => toggleSelectOne(sale.id)} /></TableCell>)}
                        <TableCell className="px-4 md:px-8 py-5 whitespace-nowrap"><div className="flex flex-col"><span className="text-[11px] font-bold">{sale.createdAt?.toDate ? format(sale.createdAt.toDate(), "dd-MM-yyyy") : "---"}</span><span className="text-[10px] font-black text-primary/60">{sale.createdAt?.toDate ? format(sale.createdAt.toDate(), "HH:mm") : "--:--"}</span></div></TableCell>
                        <TableCell className="px-4 md:px-8 py-5 whitespace-nowrap"><span className="font-black text-xs text-primary tabular-nums tracking-tighter">{sale.invoiceId || "---"}</span></TableCell>
                        <TableCell className="px-4 md:px-8 py-5 min-w-[150px]"><div className="flex flex-col"><span className="font-black text-xs uppercase truncate max-w-[180px]">{sale.clientName || "---"}</span><span className="text-[10px] font-black text-slate-400 tabular-nums">{formatPhoneNumber(sale.clientPhone) || "---"}</span></div></TableCell>
                        <TableCell className="text-right px-4 md:px-8 py-5 whitespace-nowrap"><span className="font-black text-xs tabular-nums">{formatCurrency(sale.total - (sale.remise || 0))}</span></TableCell>
                        <TableCell className="text-right px-4 md:px-8 py-5 whitespace-nowrap"><div className="flex flex-col items-end"><span className="font-black text-xs tabular-nums text-green-600">{formatCurrency(sale.avance || 0)}</span>{histAmt > 0 && <span className="text-[8px] font-bold text-slate-400 uppercase flex items-center gap-1"><HistoryIcon className="h-2 w-2" /> {formatCurrency(histAmt)} (Hist)</span>}</div></TableCell>
                        <TableCell className="text-right px-4 md:px-8 py-5 whitespace-nowrap"><div className="flex flex-col items-end gap-1"><span className="font-black text-xs tabular-nums text-red-500">{formatCurrency(sale.reste || 0)}</span>{sale.reste > 0 && (<Button size="sm" variant="outline" disabled={sessionLoading || isTodayClosed} onClick={() => { setPaymentSale(sale); setPaymentAmount(formatCurrency(sale.reste)); }} className="h-6 px-2 text-[8px] font-black uppercase border-red-100 text-red-600 hover:bg-red-50 rounded-md"><HandCoins className="h-2 w-2 mr-1" /> Régler</Button>)}</div></TableCell>
                        <TableCell className="text-center px-4 md:px-8 py-5"><Badge className={cn("text-[8px] px-2 py-1 font-black rounded-lg uppercase", sale.statut === "Payé" ? "bg-green-100 text-green-700" : sale.statut === "En attente" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700")} variant="outline">{sale.statut || "---"}</Badge></TableCell>
                        <TableCell className="text-right px-4 md:px-8 py-5">
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-2xl p-2 min-w-[180px]">
                              <DropdownMenuItem onClick={() => handlePrint(sale)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl"><FileText className="mr-3 h-4 w-4 text-primary" /> {sale.reste <= 0 ? "Facture" : "Reçu"}</DropdownMenuItem>
                              {sale.clientPhone && (
                                <DropdownMenuItem onClick={() => copyAndOpenWhatsApp(sale.clientName, sale.clientPhone, settings?.whatsappDarija, settings?.whatsappFrench)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl text-green-600">
                                  <MessageSquare className="mr-3 h-4 w-4" /> Relancer WhatsApp
                                </DropdownMenuItem>
                              )}
                              {sale.reste > 0 && !isTodayClosed && (<DropdownMenuItem onClick={() => { setPaymentSale(sale); setPaymentAmount(formatCurrency(sale.reste)); }} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl text-green-600"><HandCoins className="mr-3 h-4 w-4" /> Encaisser Règlement</DropdownMenuItem>)}
                              <DropdownMenuItem onClick={() => { setCostDialogSale(sale); setPurchaseCosts({ frame: formatCurrency(sale.purchasePriceFrame || 0), lenses: formatCurrency(sale.purchasePriceLenses || 0), label: "" }); }} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl"><Tag className="mr-3 h-4 w-4 text-primary" /> Coûts d'Achat</DropdownMenuItem>
                              {isAdminOrPrepa && (<><DropdownMenuItem onClick={() => handleEdit(sale)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl"><Edit2 className="mr-3 h-4 w-4 text-primary" /> Modifier</DropdownMenuItem><DropdownMenuItem onClick={() => handleDelete(sale)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl text-destructive"><Trash2 className="mr-3 h-4 w-4" /> Supprimer</DropdownMenuItem></>)}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!costDialogSale} onOpenChange={(o) => !o && setCostDialogSale(null)}>
        <DialogContent className="max-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl">
          <form onSubmit={handleUpdateCosts}>
            <DialogHeader className="p-6 bg-primary text-white"><DialogTitle className="text-xl font-black uppercase">Coûts d'Achat</DialogTitle></DialogHeader>
            <div className="p-6 space-y-6 bg-white"><div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Coût Monture (DH)</Label><Input type="text" className="h-14 font-black rounded-2xl bg-slate-50 border-none text-center tabular-nums" value={purchaseCosts.frame} onChange={(e) => setPurchaseCosts({...purchaseCosts, frame: e.target.value})} onBlur={() => setPurchaseCosts({...purchaseCosts, frame: formatCurrency(parseAmount(purchaseCosts.frame))})} /></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Coût Verres (DH)</Label><Input type="text" className="h-14 font-black rounded-2xl bg-slate-50 border-none text-center tabular-nums" value={purchaseCosts.lenses} onChange={(e) => setPurchaseCosts({...purchaseCosts, lenses: e.target.value})} onBlur={() => setPurchaseCosts({...purchaseCosts, lenses: formatCurrency(parseAmount(purchaseCosts.lenses))})} /></div></div><div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Libellé d'achat</Label><Input placeholder="Ex: Verres Nikon..." className="h-14 rounded-2xl bg-slate-50 border-none" value={purchaseCosts.label} onChange={(e) => setPurchaseCosts({...purchaseCosts, label: e.target.value})} /></div></div>
            <DialogFooter className="p-6 pt-0 bg-white flex gap-3"><Button variant="ghost" className="w-full font-black text-[10px]" onClick={() => setCostDialogSale(null)}>Annuler</Button><Button type="submit" className="w-full font-black text-[10px] text-white" disabled={isSavingCosts}>{isSavingCosts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} VALIDER</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!paymentSale} onOpenChange={(o) => !o && setPaymentSale(null)}>
        <DialogContent className="max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl" onKeyDown={(e) => e.key === 'Enter' && handleValidatePayment(e)}>
          <form onSubmit={handleValidatePayment}>
            <DialogHeader className="p-8 bg-primary text-white"><DialogTitle className="text-2xl font-black uppercase flex items-center gap-3"><HandCoins className="h-7 w-7" /> Règlement Vente</DialogTitle><p className="text-[10px] font-bold opacity-60 mt-1 uppercase tracking-widest">{paymentSale?.clientName} | {paymentSale?.invoiceId}</p></DialogHeader>
            {isTodayClosed && (<div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-3"><Lock className="h-5 w-5 text-red-600" /><p className="text-[10px] font-black text-red-700 uppercase">Attention : La caisse d'aujourd'hui est clôturée.</p></div>)}
            <div className="p-8 space-y-6 bg-white"><div className="bg-slate-50 p-6 rounded-2xl border space-y-3"><div className="flex justify-between text-[10px] font-black uppercase text-slate-400"><span>Reste actuel :</span><span className="text-destructive font-black text-sm tabular-nums">{formatCurrency(paymentSale?.reste || 0)}</span></div></div><div className="space-y-3"><Label className="text-[10px] font-black uppercase text-primary ml-1">Montant à Encaisser (DH)</Label><input type="text" className={cn("w-full h-20 text-4xl font-black text-center rounded-2xl bg-slate-50 border-2 border-primary/10 outline-none focus:border-primary/30 tabular-nums", (isTodayClosed || sessionLoading) && "opacity-50 cursor-not-allowed")} value={paymentAmount} placeholder="0,00" onChange={(e) => !isTodayClosed && !sessionLoading && setPaymentAmount(e.target.value)} onBlur={() => !isTodayClosed && !sessionLoading && paymentAmount && setPaymentAmount(formatCurrency(parseAmount(paymentAmount)))} autoFocus readOnly={isTodayClosed || sessionLoading} /></div></div>
            <DialogFooter className="p-8 pt-0 bg-white flex flex-col sm:flex-row gap-3"><Button variant="ghost" className="w-full h-14 font-black uppercase text-[10px]" onClick={() => setPaymentSale(null)}>Annuler</Button><Button type="submit" className="w-full h-14 font-black uppercase shadow-xl text-[10px] text-white" disabled={isProcessingPayment || isTodayClosed || sessionLoading}>{isProcessingPayment ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "VALIDER LE PAIEMENT"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SalesHistoryPage() { 
  return (
    <AppShell>
      <Suspense fallback={<div className="flex items-center justify-center py-24"><Loader2 className="h-12 w-12 animate-spin text-primary opacity-20" /></div>}>
        <SalesHistoryContent />
      </Suspense>
    </AppShell>
  ); 
}
