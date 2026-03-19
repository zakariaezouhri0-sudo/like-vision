
"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Search, Printer, Plus, MoreVertical, Edit2, Loader2, Trash2, Calendar as CalendarIcon, FileText, Tag, Save, History as HistoryIcon, HandCoins, Lock, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { formatCurrency, formatPhoneNumber, cn, roundAmount, parseAmount } from "@/lib/utils";
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, query, orderBy, deleteDoc, doc, updateDoc, addDoc, serverTimestamp, Timestamp, where, runTransaction, arrayUnion, getDoc, limit } from "firebase/firestore";
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

  // States pour le paiement direct
  const [paymentSale, setPaymentSale] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role') || "OPTICIENNE";
    setRole(savedRole.toUpperCase());
    setIsReady(true);
  }, []);

  const isPrepaMode = role === "PREPA";
  const isAdminOrPrepa = role === 'ADMIN' || role === 'PREPA';

  // Vérification de la caisse pour le règlement direct
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
      client: sale.clientName || "---", phone: sale.clientPhone || "", mutuelle: sale.mutuelle || "---", 
      total: sale.total.toString(), remise: (sale.remise || 0).toString(), 
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

  // Logique de paiement direct
  const handleOpenPayment = (sale: any) => {
    if (isTodayClosed && !isAdminOrPrepa) {
      toast({ variant: "destructive", title: "Caisse Clôturée", description: "Impossible d'enregistrer un règlement sur une session fermée." });
      return;
    }
    setPaymentSale(sale);
    setPaymentAmount(formatCurrency(sale.reste));
  };

  const handleValidatePayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!paymentSale || !paymentAmount) return;

    if (isReadOnly) {
      toast({ variant: "destructive", title: "Caisse Fermée", description: "L'enregistrement est verrouillé." });
      return;
    }

    const amount = parseAmount(paymentAmount);
    if (amount <= 0) return;

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
        if (!saleSnap.exists()) throw new Error("Vente inexistante.");

        const currentData = saleSnap.data();
        const totalNet = currentData.total - (currentData.remise || 0);
        const newAvance = (currentData.avance || 0) + amount;
        const newReste = Math.max(0, totalNet - newAvance);
        const isFullyPaid = newReste <= 0;
        
        let finalInvoiceId = currentData.invoiceId;
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
          clientName: currentData.clientName,
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
      if (err.message === "SESSION_CLOSED") {
        toast({ variant: "destructive", title: "Caisse Fermée", description: "La caisse a été clôturée." });
      } else {
        toast({ variant: "destructive", title: "Erreur lors du paiement" });
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h1 className="text-2xl font-black text-primary uppercase">Historique Ventes</h1></div>
        <Button asChild className="h-12 font-black rounded-xl px-8 shadow-lg"><Link href="/ventes/nouvelle"><Plus className="mr-2 h-5 w-5" />NOUVELLE VENTE</Link></Button>
      </div>

      <Card className="shadow-sm rounded-[24px] bg-white">
        <CardHeader className="p-6 border-b bg-slate-50/50">
          <div className="flex flex-col lg:flex-row items-end gap-4">
            <div className="flex-1 space-y-1.5 w-full"><Label className="text-[10px] font-black uppercase text-muted-foreground">Recherche (Depuis le 01/01/2026)</Label><div className="relative"><Search className="absolute left-4 top-3 h-4 w-4 text-primary/40" /><input placeholder="Client ou Document..." className="w-full pl-11 h-10 text-sm font-bold rounded-xl border-none shadow-inner outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div></div>
            <div className="w-full lg:w-48 space-y-1.5"><Label className="text-[10px] font-black uppercase text-muted-foreground">Statut</Label><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="h-10 rounded-xl font-bold"><SelectValue /></SelectTrigger><SelectContent className="rounded-xl"><SelectItem value="TOUS">Tous</SelectItem><SelectItem value="Payé">Payé</SelectItem><SelectItem value="Partiel">Partiel</SelectItem><SelectItem value="En attente">En attente</SelectItem></SelectContent></Select></div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#6a8036]">
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-black px-6 py-4 text-white">Date</TableHead>
                  <TableHead className="text-[10px] uppercase font-black px-6 py-4 text-white">Document</TableHead>
                  <TableHead className="text-[10px] uppercase font-black px-6 py-4 text-white">Client</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-6 py-4 text-white">Total Net</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-6 py-4 text-white">Avance</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-6 py-4 text-white">Reste</TableHead>
                  <TableHead className="text-center text-[10px] uppercase font-black px-6 py-4 text-white">Statut</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-6 py-4 text-white">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="py-20 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto opacity-20" /></TableCell></TableRow>
                ) : filteredSales.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-20 text-[10px] font-black uppercase opacity-20">Aucune vente enregistrée depuis le 01/01/2026.</TableCell></TableRow>
                ) : (
                  filteredSales.map((sale: any) => (
                    <TableRow key={sale.id} className="hover:bg-slate-50">
                      <TableCell className="px-6 py-4 text-xs font-bold">{sale.createdAt?.toDate ? format(sale.createdAt.toDate(), "dd/MM/yyyy") : "---"}</TableCell>
                      <TableCell className="px-6 py-4 text-xs font-black text-primary whitespace-nowrap">{sale.invoiceId}</TableCell>
                      <TableCell className="px-6 py-4 text-xs font-bold uppercase">{sale.clientName}</TableCell>
                      <TableCell className="text-right px-6 py-4 text-xs font-black">{formatCurrency(sale.total - (sale.remise || 0))}</TableCell>
                      <TableCell className="text-right px-6 py-4 text-xs font-black text-green-600">{formatCurrency(sale.avance || 0)}</TableCell>
                      <TableCell className="text-right px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs font-black text-red-500 tabular-nums">{formatCurrency(sale.reste || 0)}</span>
                          {(sale.reste || 0) > 0 && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className={cn(
                                "h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg",
                                isReadOnly && "opacity-30 grayscale cursor-not-allowed"
                              )}
                              onClick={() => handleOpenPayment(sale)}
                              title="Régler le reste"
                            >
                              <HandCoins className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center px-6 py-4"><Badge className={cn("text-[8px] font-black uppercase", sale.statut === "Payé" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700")} variant="outline">{sale.statut}</Badge></TableCell>
                      <TableCell className="text-right px-6 py-4">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl p-2 min-w-[160px]">
                            <DropdownMenuItem onClick={() => handlePrint(sale)} className="py-2.5 font-bold text-xs cursor-pointer"><FileText className="mr-2 h-4 w-4" /> Imprimer</DropdownMenuItem>
                            {isAdminOrPrepa && (
                              <DropdownMenuItem onClick={() => router.push(`/ventes/nouvelle?editId=${sale.id}`)} className="py-2.5 font-bold text-xs cursor-pointer">
                                <Edit2 className="mr-2 h-4 w-4" /> Modifier
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => { setCostDialogSale(sale); setPurchaseCosts({ frame: formatCurrency(sale.purchasePriceFrame || 0), lenses: formatCurrency(sale.purchasePriceLenses || 0), label: "" }); }} className="py-2.5 font-bold text-xs cursor-pointer"><Tag className="mr-2 h-4 w-4" /> Coûts d'Achat</DropdownMenuItem>
                            {isAdminOrPrepa && (<DropdownMenuItem onClick={() => handleDelete(sale)} className="text-destructive py-2.5 font-bold text-xs cursor-pointer"><Trash2 className="mr-2 h-4 w-4" /> Supprimer</DropdownMenuItem>)}
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

      {/* Dialog Coûts d'Achat */}
      <Dialog open={!!costDialogSale} onOpenChange={(o) => !o && setCostDialogSale(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <form onSubmit={handleUpdateCosts}>
            <DialogHeader><DialogTitle className="font-black uppercase text-primary">Coûts d'Achat</DialogTitle></DialogHeader>
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Monture (DH)</Label><Input type="text" className="font-bold" value={purchaseCosts.frame} onChange={(e) => setPurchaseCosts({...purchaseCosts, frame: e.target.value})} onBlur={() => setPurchaseCosts({...purchaseCosts, frame: formatCurrency(parseAmount(purchaseCosts.frame))})} /></div>
                <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Verres (DH)</Label><Input type="text" className="font-bold" value={purchaseCosts.lenses} onChange={(e) => setPurchaseCosts({...purchaseCosts, lenses: e.target.value})} onBlur={() => setPurchaseCosts({...purchaseCosts, lenses: formatCurrency(parseAmount(purchaseCosts.lenses))})} /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-[10px] uppercase font-black">Désignation Achat</Label><Input placeholder="Ex: Verres Nikon..." value={purchaseCosts.label} onChange={(e) => setPurchaseCosts({...purchaseCosts, label: e.target.value})} /></div>
            </div>
            <DialogFooter><Button type="submit" className="w-full font-black rounded-xl" disabled={isSavingCosts}>ENREGISTRER</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Règlement Direct */}
      <Dialog open={!!paymentSale} onOpenChange={(open) => !open && setPaymentSale(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-[32px] p-0 overflow-hidden border-none shadow-2xl" onKeyDown={(e) => e.key === 'Enter' && handleValidatePayment(e)}>
          <form onSubmit={handleValidatePayment}>
            <DialogHeader className="p-6 md:p-8 bg-primary text-white">
              <DialogTitle className="text-xl md:text-2xl font-black uppercase flex items-center gap-3"><HandCoins className="h-6 w-6 md:h-7 md:w-7" />Encaisser Vente</DialogTitle>
              <p className="text-[10px] md:text-sm font-bold opacity-60 mt-1 uppercase tracking-widest">Document {paymentSale?.invoiceId}</p>
            </DialogHeader>

            {isTodayClosed && isAdminOrPrepa && (
              <div className="bg-orange-50 p-4 border-b border-orange-100 flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <p className="text-[10px] font-black text-orange-700 uppercase">Mode Correction : Modification autorisée sur caisse close.</p>
              </div>
            )}

            <div className={cn("p-6 md:p-8 space-y-6 transition-all", isReadOnly && "grayscale brightness-95 opacity-80 pointer-events-none")}>
              <div className="bg-slate-50 p-4 md:p-6 rounded-2xl border space-y-3">
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400"><span>Client :</span><span className="text-slate-900 font-bold uppercase">{paymentSale?.clientName}</span></div>
                <div className="flex justify-between text-[10px] font-black uppercase text-slate-400 whitespace-nowrap"><span>Reste à verser :</span><span className="text-destructive font-black text-sm tabular-nums">{formatCurrency(paymentSale?.reste || 0)}</span></div>
              </div>
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-primary ml-1 tracking-widest">Montant Encaissé (DH)</Label>
                <input 
                  type="text" 
                  className={cn("w-full h-16 md:h-20 text-3xl md:text-4xl font-black text-center rounded-2xl bg-slate-50 border-2 border-primary/10 outline-none focus:border-primary/30 tabular-nums", isReadOnly && "cursor-not-allowed")} 
                  value={paymentAmount} 
                  placeholder="0,00"
                  onChange={(e) => !isReadOnly && setPaymentAmount(e.target.value)} 
                  onBlur={() => !isReadOnly && paymentAmount && setPaymentAmount(formatCurrency(parseAmount(paymentAmount)))}
                  autoFocus 
                  readOnly={isReadOnly}
                />
              </div>
            </div>
            <DialogFooter className="p-6 md:p-8 pt-0 flex flex-col sm:flex-row gap-3">
              <Button variant="ghost" className="w-full h-12 md:h-14 font-black uppercase text-[10px]" type="button" onClick={() => setPaymentSale(null)}>Annuler</Button>
              <Button type="submit" className="w-full h-12 md:h-14 font-black uppercase shadow-xl text-[10px] text-white" disabled={isProcessingPayment || isReadOnly || sessionLoading}>{isProcessingPayment ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "VALIDER LE PAIEMENT"}</Button>
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
