"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Search, Printer, Plus, MoreVertical, Edit2, Loader2, Trash2, Calendar as CalendarIcon, FileText, Tag, Save, History as HistoryIcon, HandCoins, Lock, AlertTriangle, XCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, formatPhoneNumber, cn, roundAmount, parseAmount } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, query, orderBy, deleteDoc, doc, updateDoc, addDoc, serverTimestamp, Timestamp, where, runTransaction, arrayUnion, getDoc, limit, getDocs, writeBatch } from "firebase/firestore";
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
  const [isPrepaMode, setIsPrepaMode] = useState(false);
  const [isReady, setIsReady] = useState(false);
  
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  const [costDialogSale, setCostDialogSale] = useState<any>(null);
  const [purchaseCosts, setPurchaseCosts] = useState({ frame: "", lenses: "", label: "" });
  const [isSavingCosts, setIsSavingCosts] = useState(false);

  const [paymentSale, setPaymentSale] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role')?.toUpperCase() || "OPTICIENNE";
    const savedMode = localStorage.getItem('work_mode');
    
    setRole(savedRole);
    setIsPrepaMode(savedRole === 'PREPA' || (savedRole === 'ADMIN' && savedMode === 'DRAFT'));
    setIsReady(true);
  }, []);

  const isAdminOrPrepa = role === 'ADMIN' || role === 'PREPA';

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const sessionDocId = isPrepaMode ? `DRAFT-${todayStr}` : todayStr;
  const sessionRef = useMemoFirebase(() => isReady ? doc(db, "cash_sessions", sessionDocId) : null, [db, sessionDocId, isReady]);
  const { data: sessionData, isLoading: sessionLoading } = useDoc(sessionRef);
  const isTodayClosed = !sessionLoading && sessionData?.status === "CLOSED";
  const isReadOnly = isTodayClosed && !isAdminOrPrepa;

  const salesQuery = useMemoFirebase(() => {
    const startOfYear = new Date(2026, 0, 1);
    return query(
      collection(db, "sales"),
      where("createdAt", ">=", Timestamp.fromDate(startOfYear)),
      orderBy("createdAt", "desc"),
      limit(5000)
    );
  }, [db]);
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
        const matchesSearch = !search || (sale.clientName || "").toLowerCase().includes(search) || (sale.invoiceId || "").toLowerCase().includes(search);
        const matchesStatus = statusFilter === "TOUS" || sale.statut === statusFilter;
        return matchesDate && matchesSearch && matchesStatus;
      });
  }, [rawSales, searchTerm, statusFilter, dateFrom, dateTo, isPrepaMode, isReady]);

  const handleDelete = async (sale: any) => {
    if (!isAdminOrPrepa) return;
    
    const confirmMsg = "Êtes-vous sûr ? Cette action supprimera également le montant de la caisse.";
    if (!confirm(confirmMsg)) return;
    
    try {
      const transQuery = query(
        collection(db, "transactions"), 
        where("saleId", "==", sale.id)
      );
      const transSnap = await getDocs(transQuery);
      
      const batch = writeBatch(db);
      transSnap.docs.forEach((tDoc) => {
        batch.delete(tDoc.ref);
      });
      batch.delete(doc(db, "sales", sale.id));
      await batch.commit();
      
      toast({ variant: "success", title: "Vente supprimée" });
    } catch (e) { 
      toast({ variant: "destructive", title: "Erreur technique" }); 
    }
  };

  const handlePrint = (sale: any) => {
    const page = sale.reste <= 0 ? 'facture' : 'recu';
    let formattedDate = "---";
    try {
      const d = sale.createdAt?.toDate ? sale.createdAt.toDate() : null;
      if (d && isValid(d)) formattedDate = format(d, "dd-MM-yyyy");
    } catch (e) {}

    const params = new URLSearchParams({ 
      client: sale.clientName || "---", phone: sale.clientPhone || "", mutuelle: sale.mutuelle || "---", 
      total: (sale.total || 0).toString(), remise: (sale.remise || 0).toString(), 
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

  const handleOpenPayment = (sale: any) => {
    if (isTodayClosed && !isAdminOrPrepa) {
      toast({ variant: "destructive", title: "Caisse Clôturée", description: "L'enregistrement est verrouillé sur une session fermée." });
      return;
    }
    setPaymentSale(sale);
    setPaymentAmount(formatCurrency(sale.reste || 0));
  };

  const handleValidatePayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!paymentSale || !paymentAmount) return;

    const amount = parseAmount(paymentAmount);
    if (amount <= 0) return;

    if (isReadOnly) {
      toast({ variant: "destructive", title: "Action Impossible", description: "La caisse est clôturée." });
      return;
    }

    setIsProcessingPayment(true);
    const currentUserName = user?.displayName || "Inconnu";

    try {
      await runTransaction(db, async (transaction) => {
        if (sessionRef && !isAdminOrPrepa) {
          const sSnap = await transaction.get(sessionRef);
          if (sSnap.exists() && sSnap.data().status === "CLOSED") {
            throw new Error("SESSION_CLOSED");
          }
        }

        const saleRef = doc(db, "sales", paymentSale.id);
        const saleSnap = await transaction.get(saleRef);
        if (!saleSnap.exists()) throw new Error("Vente introuvable.");

        const currentData = saleSnap.data();
        const totalNet = roundAmount((currentData.total || 0) - (currentData.remise || 0));
        const currentAvance = roundAmount(currentData.avance || 0);
        
        const newAvance = roundAmount(currentAvance + amount);
        const newReste = roundAmount(Math.max(0, totalNet - newAvance));
        const isFullyPaid = newReste <= 0;
        
        let finalInvoiceId = currentData.invoiceId || "---";
        if (isFullyPaid && finalInvoiceId.startsWith("RC-")) {
          finalInvoiceId = finalInvoiceId.replace("RC-", "FC-");
        }

        transaction.update(saleRef, { 
          invoiceId: finalInvoiceId,
          avance: newAvance, 
          reste: newReste, 
          statut: isFullyPaid ? "Payé" : "Partiel", 
          payments: arrayUnion({ 
            amount, 
            date: new Date().toISOString(), 
            userName: currentUserName,
            note: "Règlement"
          }),
          updatedAt: serverTimestamp() 
        });

        const transRef = doc(collection(db, "transactions"));
        transaction.set(transRef, {
          type: "VENTE",
          label: `VENTE ${finalInvoiceId}`,
          clientName: currentData.clientName || "---",
          category: "Optique", 
          montant: amount, 
          relatedId: finalInvoiceId,
          saleId: paymentSale.id, 
          userName: currentUserName, 
          isDraft: isPrepaMode, 
          isBalancePayment: true,
          createdAt: serverTimestamp()
        });
      });

      toast({ variant: "success", title: "Paiement validé" });
      setPaymentSale(null);
    } catch (err: any) {
      console.error("Erreur paiement:", err);
      if (err.message === "SESSION_CLOSED") {
        toast({ variant: "destructive", title: "Caisse Fermée", description: "L'accès est bloqué car la caisse est close." });
      } else {
        toast({ variant: "destructive", title: "Erreur Technique", description: "Échec de l'encaissement." });
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-[#0D1B2A] uppercase tracking-tighter">Historique Ventes</h1>
          <p className="text-[10px] text-[#D4AF37] font-black uppercase tracking-[0.3em] mt-2">Registre complet des transactions optiques.</p>
        </div>
        <Button asChild className="h-12 font-black rounded-full px-10 shadow-xl bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-white transition-all">
          <Link href="/ventes/nouvelle"><Plus className="mr-2 h-5 w-5" />NOUVELLE VENTE</Link>
        </Button>
      </div>

      <Card className="shadow-xl shadow-slate-200/50 rounded-[60px] bg-white border-none overflow-hidden">
        <CardHeader className="p-10 border-b bg-slate-50">
          <div className="flex flex-col lg:flex-row items-end gap-6">
            <div className="flex-1 space-y-2 w-full">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Recherche (Depuis le 01/01/2026)</Label>
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#D4AF37]" />
                <input placeholder="Client ou Document..." className="w-full pl-14 h-12 text-sm font-bold rounded-2xl border-none shadow-inner outline-none bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="w-full lg:w-64 space-y-2">
              <Label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Statut</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-12 rounded-2xl font-black border-none shadow-inner bg-white"><SelectValue /></SelectTrigger>
                <SelectContent className="rounded-[32px]">{["TOUS", "Payé", "Partiel", "En attente"].map(s => <SelectItem key={s} value={s} className="font-black text-[10px] uppercase">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#0D1B2A]">
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Date</TableHead>
                  <TableHead className="text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Document</TableHead>
                  <TableHead className="text-center text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Client</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Total Net</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Avance</TableHead>
                  <TableHead className="text-center text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Reste</TableHead>
                  <TableHead className="text-center text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Statut</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 text-[#D4AF37] tracking-widest">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="py-24 text-center"><Loader2 className="h-10 w-10 animate-spin mx-auto opacity-20" /></TableCell></TableRow>
                ) : filteredSales.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-24 text-[10px] font-black uppercase opacity-20 tracking-widest">Aucune vente enregistrée depuis le 01/01/2026.</TableCell></TableRow>
                ) : (
                  filteredSales.map((sale: any) => (
                    <TableRow key={sale.id} className="hover:bg-slate-50 transition-all group">
                      <TableCell className="px-10 py-6 text-[11px] font-bold text-slate-500 tabular-nums">{sale.createdAt?.toDate ? format(sale.createdAt.toDate(), "dd/MM/yyyy") : "---"}</TableCell>
                      <TableCell className="px-10 py-6 text-[11px] font-black text-[#0D1B2A] whitespace-nowrap tracking-tight">{sale.invoiceId}</TableCell>
                      <TableCell className="px-10 py-6 text-[11px] font-black uppercase text-[#0D1B2A]">{sale.clientName}</TableCell>
                      <TableCell className="text-right px-10 py-6 text-sm font-black text-[#0D1B2A] tabular-nums">{formatCurrency((sale.total || 0) - (sale.remise || 0))}</TableCell>
                      <TableCell className="text-right px-10 py-6 text-sm font-black text-green-600 tabular-nums">{formatCurrency(sale.avance || 0)}</TableCell>
                      <TableCell className="text-center px-10 py-6">
                        <div className="flex items-center justify-center gap-2">
                          <span className="text-sm font-black text-red-500 tabular-nums">{formatCurrency(sale.reste || 0)}</span>
                          {(sale.reste || 0) > 0 && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              disabled={isReadOnly}
                              className={cn(
                                "h-8 w-8 rounded-full transition-all shadow-sm",
                                isReadOnly ? "opacity-30 grayscale cursor-not-allowed bg-slate-50" : "text-red-500 hover:text-white hover:bg-red-500"
                              )}
                              onClick={() => handleOpenPayment(sale)}
                            >
                              <HandCoins className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center px-10 py-6"><Badge className={cn("text-[9px] font-black uppercase py-1 px-3 rounded-full", sale.statut === "Payé" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700")} variant="outline">{sale.statut}</Badge></TableCell>
                      <TableCell className="text-right px-10 py-6">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-slate-100"><MoreVertical className="h-5 w-5 text-slate-400" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-[24px] p-2 min-w-[180px] shadow-2xl">
                            <DropdownMenuItem onClick={() => handlePrint(sale)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl"><FileText className="mr-3 h-4 w-4 text-[#D4AF37]" /> Imprimer</DropdownMenuItem>
                            {isAdminOrPrepa && (
                              <DropdownMenuItem onClick={() => router.push(`/ventes/nouvelle?editId=${sale.id}`)} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl">
                                <Edit2 className="mr-3 h-4 w-4 text-blue-600" /> Modifier
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => { setCostDialogSale(sale); setPurchaseCosts({ frame: formatCurrency(sale.purchasePriceFrame || 0), lenses: formatCurrency(sale.purchasePriceLenses || 0), label: "" }); }} className="py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl"><Tag className="mr-3 h-4 w-4 text-orange-500" /> Coûts d'Achat</DropdownMenuItem>
                            {isAdminOrPrepa && (<DropdownMenuItem onClick={() => handleDelete(sale)} className="text-destructive py-3 font-black text-[10px] uppercase cursor-pointer rounded-xl"><Trash2 className="mr-3 h-4 w-4" /> Supprimer</DropdownMenuItem>)}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!costDialogSale} onOpenChange={(o) => !o && setCostDialogSale(null)}>
        <DialogContent className="max-w-md rounded-[40px] p-10">
          <form onSubmit={handleUpdateCosts}>
            <DialogHeader><DialogTitle className="font-black uppercase text-[#0D1B2A] tracking-widest text-center">Gestion des Coûts</DialogTitle></DialogHeader>
            <div className="py-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Monture (DH)</Label><Input type="text" className="h-12 rounded-2xl font-black bg-slate-50 border-none px-4" value={purchaseCosts.frame} onChange={(e) => setPurchaseCosts({...purchaseCosts, frame: e.target.value})} onBlur={() => setPurchaseCosts({...purchaseCosts, frame: formatCurrency(parseAmount(purchaseCosts.frame))})} /></div>
                <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Verres (DH)</Label><Input type="text" className="h-12 rounded-2xl font-black bg-slate-50 border-none px-4" value={purchaseCosts.lenses} onChange={(e) => setPurchaseCosts({...purchaseCosts, lenses: e.target.value})} onBlur={() => setPurchaseCosts({...purchaseCosts, lenses: formatCurrency(parseAmount(purchaseCosts.lenses))})} /></div>
              </div>
              <div className="space-y-2"><Label className="text-[10px] uppercase font-black ml-2">Désignation Achat</Label><Input className="h-12 rounded-2xl font-bold bg-slate-50 border-none px-4" placeholder="Ex: Verres Nikon..." value={purchaseCosts.label} onChange={(e) => setPurchaseCosts({...purchaseCosts, label: e.target.value})} /></div>
            </div>
            <DialogFooter><Button type="submit" className="w-full h-14 font-black rounded-full tracking-widest shadow-xl" disabled={isSavingCosts}>ENREGISTRER</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!paymentSale} onOpenChange={(open) => !open && setPaymentSale(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-[60px] p-0 overflow-hidden border-none shadow-2xl" onKeyDown={(e) => e.key === 'Enter' && handleValidatePayment(e)}>
          <form onSubmit={handleValidatePayment}>
            <DialogHeader className={cn("p-10 text-white", isReadOnly ? "bg-destructive" : "bg-[#0D1B2A]")}>
              <DialogTitle className="text-2xl font-black uppercase flex items-center justify-center gap-4 tracking-tighter">
                {isReadOnly ? <XCircle className="h-8 w-8" /> : <HandCoins className="h-8 w-8 text-[#D4AF37]" />}
                {isReadOnly ? "Action Impossible" : "Encaisser Vente"}
              </DialogTitle>
              <p className="text-[10px] font-black opacity-60 mt-3 uppercase tracking-[0.3em] text-center">
                {isReadOnly ? "La caisse d'aujourd'hui est clôturée" : `Document ${paymentSale?.invoiceId}`}
              </p>
            </DialogHeader>

            {isTodayClosed && (
              <div className={cn("p-6 border-b flex items-center gap-4", isAdminOrPrepa ? "bg-orange-50 text-orange-700" : "bg-red-50 text-red-700")}>
                {isAdminOrPrepa ? <AlertTriangle className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
                <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">
                  {isAdminOrPrepa ? "Mode Correction : Modification autorisée sur caisse close." : "Accès Refusé : La caisse est clôturée."}
                </p>
              </div>
            )}

            <div className={cn("p-10 space-y-8 transition-all", isReadOnly && "grayscale brightness-95 opacity-80 pointer-events-none")}>
              <div className="bg-slate-50 p-8 rounded-[32px] space-y-4 shadow-inner">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-widest"><span>Client :</span><span className="text-[#0D1B2A] font-black text-xs">{paymentSale?.clientName}</span></div>
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-widest"><span>Reste à verser :</span><span className="text-red-600 font-black text-lg tabular-nums">{formatCurrency(paymentSale?.reste || 0)}</span></div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-[#0D1B2A] ml-4 tracking-[0.3em]">Montant Encaissé (DH)</Label>
                <input 
                  type="text" 
                  className={cn("w-full h-20 text-4xl font-black text-center rounded-[32px] bg-slate-50 border-2 border-[#0D1B2A]/5 outline-none focus:border-[#D4AF37]/30 tabular-nums transition-all", isReadOnly && "cursor-not-allowed")} 
                  value={paymentAmount} 
                  placeholder="0,00"
                  onChange={(e) => !isReadOnly && setPaymentAmount(e.target.value)} 
                  onBlur={() => !isReadOnly && paymentAmount && setPaymentAmount(formatCurrency(parseAmount(paymentAmount)))}
                  autoFocus 
                  readOnly={isReadOnly}
                />
              </div>
            </div>
            <DialogFooter className="p-10 pt-0 flex flex-col sm:flex-row gap-4">
              <Button variant="ghost" className="w-full h-14 font-black uppercase text-[10px] rounded-full tracking-widest hover:bg-slate-100" type="button" onClick={() => setPaymentSale(null)}>Annuler</Button>
              {!isReadOnly && (
                <Button type="submit" className="w-full h-14 font-black uppercase shadow-2xl text-[10px] tracking-widest rounded-full bg-[#D4AF37] text-[#0D1B2A] hover:bg-[#0D1B2A] hover:text-white transition-all" disabled={isProcessingPayment || sessionLoading}>
                  {isProcessingPayment ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : "VALIDER LE PAIEMENT"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SalesHistoryPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>}>
        <SalesHistoryContent />
      </Suspense>
    </AppShell>
  );
}