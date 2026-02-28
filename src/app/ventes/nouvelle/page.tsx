"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrescriptionForm } from "@/components/optical/prescription-form";
import { MUTUELLES } from "@/lib/constants";
import { ShoppingBag, Save, Printer, Loader2, Search, AlertTriangle, CheckCircle2, Star, Calendar as CalendarIcon, Tag, History, Landmark, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn } from "@/lib/utils";
import { AppShell } from "@/components/layout/app-shell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFirestore, useUser } from "@/firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs, increment, Timestamp, runTransaction, arrayUnion, limit, orderBy, setDoc } from "firebase/firestore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

function NewSaleForm() {
  const { toast } = useToast();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  
  const [role, setRole] = useState<string>("OPTICIENNE");
  const [loading, setLoading] = useState(false);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [activeEditId, setActiveEditId] = useState<string | null>(searchParams.get("editId"));
  const [clientHistory, setClientHistory] = useState<{ totalUnpaid: number, orderCount: number, hasUnpaid: boolean } | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    setRole(localStorage.getItem('user_role') || "OPTICIENNE");
  }, []);

  const isPrepaMode = role === "PREPA";

  const [saleDate, setSaleDate] = useState<Date>(() => {
    const d = searchParams.get("date_raw");
    return d ? new Date(d) : new Date();
  });
  
  const initialMutuelle = searchParams.get("mutuelle") || "Aucun";
  const isCustomMutuelle = initialMutuelle !== "Aucun" && !MUTUELLES.includes(initialMutuelle);
  
  const [mutuelle, setMutuelle] = useState(isCustomMutuelle ? "Autre" : initialMutuelle);
  const [customMutuelle, setCustomMutuelle] = useState(isCustomMutuelle ? initialMutuelle : "");
  
  const [clientName, setClientName] = useState(searchParams.get("client") || "");
  const [clientPhone, setClientPhone] = useState(searchParams.get("phone") || "");
  const [total, setTotal] = useState<number | string>(searchParams.get("total") || "");
  const [discountType, setDiscountType] = useState<"percent" | "amount">(searchParams.get("discountType") as any || "percent");
  const [discountValue, setDiscountValue] = useState<number | string>(searchParams.get("discountValue") || "");
  
  const [historicalAdvance, setHistoricalAdvance] = useState<number | string>("");
  const [avance, setAvance] = useState<number | string>(searchParams.get("avance") || "");
  
  const [monture, setMonture] = useState(searchParams.get("monture") || "");
  const [verres, setVerres] = useState(searchParams.get("verres") || "");
  const [notes, setNotes] = useState(searchParams.get("notes") || "");
  
  const [purchasePriceFrame, setPurchasePriceFrame] = useState<number | string>(searchParams.get("purchasePriceFrame") || "");
  const [purchasePriceLenses, setPurchasePriceLenses] = useState<number | string>(searchParams.get("purchasePriceLenses") || "");

  const [prescription, setPrescription] = useState({
    od: { sph: searchParams.get("od_sph") || "", cyl: searchParams.get("od_cyl") || "", axe: searchParams.get("od_axe") || "", add: searchParams.get("od_add") || "" },
    og: { sph: searchParams.get("og_sph") || "", cyl: searchParams.get("og_cyl") || "", axe: searchParams.get("og_axe") || "", add: searchParams.get("og_add") || "" }
  });

  useEffect(() => {
    const searchClient = async () => {
      const cleanPhone = clientPhone ? clientPhone.toString().replace(/\s/g, "") : "";
      
      if (cleanPhone.length === 0) {
        setPhoneError(null);
        return;
      }

      const isValidFormat = /^(06|07|08)\d{8}$/.test(cleanPhone);
      if (cleanPhone.length === 10 && !isValidFormat) {
        setPhoneError("Numéro invalide (06, 07 ou 08 requis)");
      } else if (cleanPhone.length > 10) {
        setPhoneError("Trop de chiffres (10 requis)");
      } else {
        setPhoneError(null);
      }

      if (cleanPhone.length < 10) {
        return;
      }
      
      if (cleanPhone.length >= 10 && !searchParams.get("editId")) {
        setIsSearchingClient(true);
        try {
          const clientQ = query(
            collection(db, "clients"), 
            where("phone", "==", cleanPhone), 
            where("isDraft", "==", isPrepaMode),
            limit(1)
          );
          const clientSnapshot = await getDocs(clientQ);
          
          if (!clientSnapshot.empty) {
            const clientData = clientSnapshot.docs[0].data();
            setClientName(clientData.name);
            const clientMutuelle = clientData.mutuelle || "Aucun";
            if (MUTUELLES.includes(clientMutuelle)) {
              setMutuelle(clientMutuelle);
              setCustomMutuelle("");
            } else {
              setMutuelle("Autre");
              setCustomMutuelle(clientMutuelle);
            }
          }

          const allSalesQ = query(
            collection(db, "sales"), 
            where("clientPhone", "==", cleanPhone),
            where("isDraft", "==", isPrepaMode)
          );
          const allSalesSnapshot = await getDocs(allSalesQ);
          let unpaid = 0;
          let count = 0;
          allSalesSnapshot.forEach(doc => {
            const data = doc.data();
            unpaid += (data.reste || 0);
            count++;
          });
          setClientHistory({ totalUnpaid: unpaid, orderCount: count, hasUnpaid: unpaid > 0 });
        } catch (error) { console.error(error); } finally { setIsSearchingClient(false); }
      }
    };
    const timer = setTimeout(searchClient, 600);
    return () => clearTimeout(timer);
  }, [clientPhone, db, searchParams, isPrepaMode]);

  const cleanVal = (val: string | number) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleaned = val.toString().replace(/\s/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const nTotal = cleanVal(total);
  const nDiscount = cleanVal(discountValue);
  const nHistorical = cleanVal(historicalAdvance);
  const nAvance = cleanVal(avance);
  
  const remiseAmountValue = discountType === "percent" ? (nTotal * nDiscount) / 100 : nDiscount;
  const totalNetValue = Math.max(0, nTotal - remiseAmountValue);
  const resteAvantVersement = Math.max(0, totalNetValue - nHistorical);
  const resteAPayerValue = Math.max(0, resteAvantVersement - nAvance);

  const handleSave = async (silent = false) => {
    const cleanPhone = clientPhone ? clientPhone.toString().replace(/\s/g, "") : "";
    const isValidPhone = cleanPhone === "" || /^(06|07|08)\d{8}$/.test(cleanPhone);

    if (!clientName) {
      toast({ variant: "destructive", title: "Champs obligatoires", description: "Veuillez saisir au moins le nom du client." });
      return null;
    }

    if (cleanPhone !== "" && !isValidPhone) {
      toast({ variant: "destructive", title: "Téléphone non valide", description: "Le numéro doit comporter 10 chiffres et commencer par 06, 07 ou 08." });
      setPhoneError("Numéro non valide");
      return null;
    }

    setLoading(true);
    const finalMutuelle = mutuelle === "Autre" ? customMutuelle : mutuelle;
    const currentUserName = user?.displayName || "Inconnu";

    try {
      let existingClientId = null;
      if (cleanPhone) {
        const clientQuerySnap = await getDocs(query(
          collection(db, "clients"), 
          where("phone", "==", cleanPhone), 
          where("isDraft", "==", isPrepaMode),
          limit(1)
        ));
        if (!clientQuerySnap.empty) {
          existingClientId = clientQuerySnap.docs[0].id;
        }
      }

      const result = await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, "settings", isPrepaMode ? "counters_draft" : "counters");
        const counterSnap = await transaction.get(counterRef);
        const saleRef = activeEditId ? doc(db, "sales", activeEditId) : doc(collection(db, "sales"));
        
        let counters = { fc: 0, rc: 0 };
        if (counterSnap.exists()) counters = counterSnap.data() as any;

        const isPaid = resteAPayerValue <= 0;
        const statut = isPaid ? "Payé" : ((nAvance + nHistorical) > 0 ? "Partiel" : "En attente");
        let invoiceId = "";

        if (!activeEditId) {
          const prefix = isPrepaMode ? "PREPA-" : "";
          if (isPaid) { counters.fc += 1; invoiceId = `${prefix}FC-2026-${counters.fc.toString().padStart(4, '0')}`; }
          else { counters.rc += 1; invoiceId = `${prefix}RC-2026-${counters.rc.toString().padStart(4, '0')}`; }
          transaction.set(counterRef, counters, { merge: true });
        }

        const saleData: any = {
          invoiceId: activeEditId ? searchParams.get("invoiceId") : invoiceId,
          clientName, clientPhone: cleanPhone, mutuelle: finalMutuelle || "Aucun",
          total: nTotal, remise: remiseAmountValue, discountType, discountValue: nDiscount,
          remisePercent: discountType === "percent" ? nDiscount.toString() : "Fixe",
          avance: nHistorical + nAvance, reste: resteAPayerValue, statut,
          prescription, monture, verres, notes, isDraft: isPrepaMode, updatedAt: serverTimestamp(),
          purchasePriceFrame: cleanVal(purchasePriceFrame), purchasePriceLenses: cleanVal(purchasePriceLenses)
        };

        if (!activeEditId) {
          saleData.createdAt = Timestamp.fromDate(saleDate);
          saleData.createdBy = currentUserName;
          saleData.payments = [];
          if (nHistorical > 0) saleData.payments.push({ amount: nHistorical, date: saleDate.toISOString(), userName: "Historique", note: "Avance antérieure" });
          if (nAvance > 0) saleData.payments.push({ amount: nAvance, date: new Date().toISOString(), userName: currentUserName });
        }

        transaction.set(saleRef, saleData, { merge: true });

        const clientData = {
          name: clientName,
          phone: cleanPhone,
          mutuelle: finalMutuelle || "Aucun",
          lastVisit: format(saleDate, "dd/MM/yyyy"),
          updatedAt: serverTimestamp(),
          isDraft: isPrepaMode
        };

        if (existingClientId) {
          const clientRef = doc(db, "clients", existingClientId);
          transaction.update(clientRef, { ...clientData, ordersCount: increment(activeEditId ? 0 : 1) });
        } else if (cleanPhone) {
          const clientRef = doc(collection(db, "clients"));
          transaction.set(clientRef, { ...clientData, createdAt: serverTimestamp(), ordersCount: 1 });
        }

        if (nAvance > 0 && !activeEditId) {
          const transRef = doc(collection(db, "transactions"));
          transaction.set(transRef, {
            type: "VENTE", label: isPaid ? `Vente Directe ${invoiceId}` : `Acompte Reçu ${invoiceId}`,
            clientName, category: "Optique", montant: nAvance, relatedId: invoiceId,
            userName: currentUserName, isDraft: isPrepaMode, createdAt: serverTimestamp()
          });
        }
        return { ...saleData, id: saleRef.id };
      });

      if (!silent) { router.push("/ventes"); toast({ variant: "success", title: "Enregistré" }); }
      return result;
    } catch (err) { toast({ variant: "destructive", title: "Erreur" }); return null; } finally { setLoading(false); }
  };

  const handlePrint = async () => {
    const res = await handleSave(true);
    if (!res) return;
    const page = res.reste <= 0 ? 'facture' : 'recu';
    const params = new URLSearchParams({ 
      client: res.clientName, 
      phone: res.clientPhone, 
      mutuelle: res.mutuelle, 
      total: res.total.toString(), 
      remise: res.remise.toString(), 
      remisePercent: res.remisePercent, 
      avance: res.avance.toString(), 
      od_sph: res.prescription.od.sph, 
      od_cyl: res.prescription.od.cyl, 
      od_axe: res.prescription.od.axe, 
      od_add: res.prescription.od.add,
      og_sph: res.prescription.og.sph, 
      og_cyl: res.prescription.og.cyl, 
      og_axe: res.prescription.og.axe, 
      og_add: res.prescription.og.add,
      monture: res.monture, 
      verres: res.verres, 
      date: format(saleDate, "dd/MM/yyyy") + " " + format(new Date(), "HH:mm")
    });
    router.push(`/ventes/${page}/${res.invoiceId}?${params.toString()}`);
  };

  return (
    <AppShell>
      <div className="space-y-4 max-w-5xl mx-auto pb-24">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border shadow-sm">
          <div className="flex items-center gap-4">
            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", isPrepaMode ? "bg-orange-100 text-orange-600" : "bg-primary/10 text-primary")}>
              {isPrepaMode ? <AlertTriangle className="h-6 w-6" /> : <ShoppingBag className="h-6 w-6" />}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-primary uppercase tracking-tighter">{isPrepaMode ? "Saisie Historique" : (activeEditId ? "Mise à jour" : "Nouvelle Vente")}</h1>
              <p className="text-[9px] text-muted-foreground mt-0.5 uppercase font-black tracking-[0.2em] opacity-60">Saisie client & ordonnance</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={handlePrint} className="flex-1 sm:flex-none h-12 md:h-14 rounded-xl font-black text-[10px] border-primary/20 bg-white" disabled={loading}><Printer className="mr-2 h-4 w-4" />IMPRIMER</Button>
            <Button onClick={() => handleSave()} className="flex-1 sm:flex-none h-12 md:h-14 rounded-xl font-black text-[10px] shadow-xl text-white" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}ENREGISTRER</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm rounded-[24px] md:rounded-[32px] bg-white">
              <CardHeader className="py-4 px-6 md:px-8 bg-slate-50/50 border-b"><CardTitle className="text-[10px] uppercase font-black text-primary/60 tracking-[0.2em] flex items-center gap-2">Informations Client</CardTitle></CardHeader>
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                  <div className="space-y-2">
                    <Label className={cn("text-[10px] uppercase font-black tracking-widest ml-1 transition-colors", phoneError ? "text-destructive" : "text-muted-foreground")}>
                      Téléphone {isSearchingClient && <Loader2 className="h-3 w-3 animate-spin inline ml-1" />}
                    </Label>
                    <div className="relative">
                      <Input 
                        className={cn(
                          "h-12 text-sm font-bold rounded-xl bg-slate-50 border-none shadow-inner pl-10 tabular-nums transition-all",
                          phoneError ? "ring-2 ring-destructive bg-red-50" : "focus:ring-2 focus:ring-primary/20"
                        )} 
                        value={clientPhone} 
                        onChange={(e) => setClientPhone(e.target.value)} 
                        placeholder="06 00 00 00 00 (Optionnel)" 
                      />
                      <Search className={cn("absolute left-3 top-3.5 h-5 w-5 transition-colors", phoneError ? "text-destructive" : "text-primary/30")} />
                      {phoneError && (
                        <div className="absolute -bottom-5 left-1 flex items-center gap-1 text-destructive animate-in fade-in slide-in-from-top-1">
                          <XCircle className="h-2.5 w-2.5" />
                          <span className="text-[8px] font-black uppercase tracking-tighter">{phoneError}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase text-muted-foreground font-black tracking-widest ml-1">Nom & Prénom</Label><Input className="h-12 text-sm font-bold rounded-xl bg-slate-50 border-none shadow-inner uppercase" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="M. Mohamed Alami" /></div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground font-black tracking-widest ml-1">Date</Label>
                    <Popover><PopoverTrigger asChild><Button variant="outline" className="w-full h-12 rounded-xl bg-slate-50 border-none justify-start font-bold text-sm px-4"><CalendarIcon className="mr-2 h-4 w-4 text-primary" />{format(saleDate, "dd/MM/yyyy")}</Button></PopoverTrigger><PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start"><Calendar mode="single" selected={saleDate} onSelect={(d) => d && setSaleDate(d)} locale={fr} initialFocus /></PopoverContent></Popover>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase text-muted-foreground font-black tracking-widest ml-1">Mutuelle</Label>
                  <div className="flex flex-col sm:flex-row gap-4"><div className="flex-1"><Select onValueChange={setMutuelle} value={mutuelle}><SelectTrigger className="h-12 text-sm font-bold rounded-xl bg-slate-50 border-none shadow-inner"><SelectValue /></SelectTrigger><SelectContent className="rounded-2xl">{MUTUELLES.map(m => <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>)}</SelectContent></Select></div>{mutuelle === "Autre" && <div className="flex-1 animate-in fade-in slide-in-from-left-2"><Input className="h-12 text-sm font-bold rounded-xl bg-slate-50 border-none shadow-inner" placeholder="Nom de la mutuelle..." value={customMutuelle} onChange={(e) => setCustomMutuelle(e.target.value)} /></div>}</div>
                </div>
              </CardContent>
            </Card>

            {clientHistory && (
              <div className={cn("p-6 rounded-[24px] md:rounded-[32px] border-2 shadow-lg transition-colors", clientHistory.hasUnpaid ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200")}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex items-center gap-4"><div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center shadow-xl shrink-0", clientHistory.hasUnpaid ? "bg-red-500 text-white" : "bg-green-500 text-white")}>{clientHistory.hasUnpaid ? <AlertTriangle className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}</div><div><h3 className={cn("text-lg font-black uppercase tracking-tight", clientHistory.hasUnpaid ? "text-red-900" : "text-green-900")}>Historique Client</h3><p className={cn("text-[10px] font-black uppercase tracking-[0.2em] opacity-70", clientHistory.hasUnpaid ? "text-red-700" : "text-green-700")}>{clientHistory.hasUnpaid ? "Reste à régler détecté" : "Situation à jour"}</p></div></div>
                  <div className="grid grid-cols-2 gap-8 w-full md:w-auto">
                    <div className="flex flex-col items-center md:items-end">
                      <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Dette Totale</span>
                      <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                        <span className={cn("text-2xl font-black tracking-tighter tabular-nums", clientHistory.hasUnpaid ? "text-red-600" : "text-green-600")}>{new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(clientHistory.totalUnpaid).replace(/\s/g, '\u00A0')}</span>
                        <span className={cn("text-[10px] font-black uppercase opacity-60", clientHistory.hasUnpaid ? "text-red-500" : "text-green-500")}>DH</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center md:items-end"><span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Score Fidélité</span><div className="flex items-center gap-2"><span className="text-2xl font-black text-slate-900 tracking-tighter tabular-nums">{clientHistory.orderCount}</span><Star className="h-4 w-4 text-yellow-500 fill-yellow-500" /></div></div>
                  </div>
                </div>
              </div>
            )}
            <Card className="shadow-sm rounded-[24px] md:rounded-[32px] bg-white"><CardHeader className="py-4 px-6 md:px-8 bg-slate-50/50 border-b"><CardTitle className="text-[10px] uppercase font-black text-primary/60 tracking-[0.2em]">Prescription</CardTitle></CardHeader><CardContent className="p-6 md:p-8"><PrescriptionForm od={prescription.od} og={prescription.og} onChange={(s, f, v) => setPrescription(prev => ({...prev, [s.toLowerCase()]: {...(prev as any)[s.toLowerCase()], [f]: v}}))} /></CardContent></Card>
          </div>

          <div className="space-y-6">
            <Card className="shadow-2xl border-none bg-primary p-2 rounded-[32px] md:rounded-[40px] lg:sticky lg:top-24">
              <CardHeader className="py-6 px-8 text-white/60"><CardTitle className="text-[10px] font-black uppercase tracking-[0.3em]">Calcul Financier</CardTitle></CardHeader>
              <CardContent className="p-4 md:p-6 space-y-5">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest shrink-0">Prix Brut</Label>
                  <div className="flex items-center gap-1.5 flex-1 justify-end ml-4">
                    <input className="w-full max-w-[120px] h-8 text-right font-black bg-transparent text-slate-950 outline-none text-lg tabular-nums" type="number" value={total} onChange={(e) => setTotal(e.target.value)} />
                    <span className="text-[9px] font-black text-slate-400">DH</span>
                  </div>
                </div>
                
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="flex justify-between items-center px-1">
                    <Label className="text-white/60 text-[10px] font-black uppercase tracking-widest">Remise</Label>
                    <Tabs value={discountType} onValueChange={(v) => setDiscountType(v as any)} className="h-7">
                      <TabsList className="h-7 grid grid-cols-2 w-16 p-1 bg-white/10 border-none rounded-lg">
                        <TabsTrigger value="percent" className="text-[9px] font-black h-5 data-[state=active]:bg-white data-[state=active]:text-primary rounded-md">%</TabsTrigger>
                        <TabsTrigger value="amount" className="text-[9px] font-black h-5 data-[state=active]:bg-white data-[state=active]:text-primary rounded-md">DH</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  <div className="flex items-center gap-2 bg-white rounded-2xl p-4 shadow-sm">
                    <input className="w-full h-8 text-right text-slate-950 font-black bg-transparent outline-none text-lg tabular-nums" type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} />
                    <span className="text-[9px] font-black text-slate-400">{discountType === 'percent' ? '%' : 'DH'}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-white/10 p-5 rounded-2xl border border-white/5 whitespace-nowrap">
                  <Label className="text-[10px] font-black uppercase text-white tracking-widest">Net à payer</Label>
                  <span className="font-black text-xl text-white tracking-tighter tabular-nums">{formatCurrency(totalNetValue)}</span>
                </div>

                <div className="pt-4 border-t border-white/10 space-y-4">
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10">
                    <div className="space-y-1">
                      <Label className="text-white/60 text-[10px] font-black uppercase tracking-widest">Déjà Versé (Ancien)</Label>
                      <p className="text-[8px] font-bold text-accent uppercase">Historique</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-1 justify-end ml-4">
                      <input className="w-full max-w-[100px] h-8 text-right font-black bg-transparent text-white outline-none text-lg tabular-nums" type="number" value={historicalAdvance} onChange={(e) => setHistoricalAdvance(e.target.value)} placeholder="0" />
                      <span className="text-[9px] font-black text-white/20">DH</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center px-4 whitespace-nowrap">
                    <span className="text-[9px] font-black uppercase text-white/40 tracking-widest">Reste à percevoir :</span>
                    <span className="text-xs font-black text-white tracking-tighter tabular-nums">{formatCurrency(resteAvantVersement)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
                  <Label className="text-primary text-[10px] font-black uppercase tracking-widest shrink-0">Versé ce jour</Label>
                  <div className="flex items-center gap-1.5 flex-1 justify-end ml-4">
                    <input className="w-full max-w-[120px] h-8 text-right font-black bg-transparent text-slate-950 outline-none text-lg tabular-nums" type="number" value={avance} onChange={(e) => setAvance(e.target.value)} />
                    <span className="text-[9px] font-black text-slate-400">DH</span>
                  </div>
                </div>

                <div className="bg-slate-950 text-white p-6 rounded-[24px] md:rounded-[32px] flex flex-col items-center gap-1 shadow-2xl border border-white/5 mt-2 whitespace-nowrap">
                  <span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/40">Reste à régler final</span>
                  <span className="text-xl md:text-2xl font-black tracking-tighter text-accent tabular-nums">{formatCurrency(resteAPayerValue)}</span>
                </div>

                <div className="pt-6 border-t border-white/10 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 flex items-center gap-2"><Tag className="h-3 w-3" /> Coûts d'Achat (Interne)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <Label className="text-[8px] font-black uppercase text-white/60 block mb-1">Monture</Label>
                      <div className="flex items-center gap-1">
                        <input className="w-full h-6 text-right font-bold bg-transparent text-white outline-none text-sm tabular-nums" type="number" value={purchasePriceFrame} onChange={(e) => setPurchasePriceFrame(e.target.value)} />
                        <span className="text-[8px] font-black text-white/20">DH</span>
                      </div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                      <Label className="text-[8px] font-black uppercase text-white/60 block mb-1">Verres</Label>
                      <div className="flex items-center gap-1">
                        <input className="w-full h-6 text-right font-bold bg-transparent text-white outline-none text-sm tabular-nums" type="number" value={purchasePriceLenses} onChange={(e) => setPurchasePriceLenses(e.target.value)} />
                        <span className="text-[8px] font-black text-white/20">DH</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function NewSalePage() { return <Suspense fallback={<div className="flex items-center justify-center min-h-screen font-black uppercase text-primary/30 animate-pulse">Chargement...</div>}><NewSaleForm /></Suspense>; }
