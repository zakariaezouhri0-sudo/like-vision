
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
import { Textarea } from "@/components/ui/textarea";
import { ShoppingBag, Save, Printer, ChevronDown, Loader2, Search, Calculator, AlertTriangle, CheckCircle2, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn } from "@/lib/utils";
import { AppShell } from "@/components/layout/app-shell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useFirestore } from "@/firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs, increment } from "firebase/firestore";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

function NewSaleForm() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  const [loading, setLoading] = useState(false);
  const [isSearchingClient, setIsSearchingClient] = useState(false);
  const [clientHistory, setClientHistory] = useState<{ totalUnpaid: number, orderCount: number, hasUnpaid: boolean } | null>(null);

  const editId = searchParams.get("edit甩");

  const [mutuelle, setMutuelle] = useState(searchParams.get("mutuelle") || "Aucun");
  const [clientName, setClientName] = useState(searchParams.get("client") || "");
  const [clientPhone, setClientPhone] = useState(searchParams.get("phone") || "");
  const [total, setTotal] = useState<number | string>(searchParams.get("total") || "");
  const [discountType, setDiscountType] = useState<"percent" | "amount">(searchParams.get("discountType") as any || "percent");
  const [discountValue, setDiscountValue] = useState<number | string>(searchParams.get("discountValue") || "");
  const [avance, setAvance] = useState<number | string>(searchParams.get("avance") || "");
  const [monture, setMonture] = useState(searchParams.get("monture") || "");
  const [verres, setVerres] = useState(searchParams.get("verres") || "");
  const [notes, setNotes] = useState(searchParams.get("notes") || "");
  
  const [purchasePriceFrame, setPurchasePriceFrame] = useState<number | string>(searchParams.get("purchasePriceFrame") || "");
  const [purchasePriceLenses, setPurchasePriceLenses] = useState<number | string>(searchParams.get("purchasePriceLenses") || "");

  const [prescription, setPrescription] = useState({
    od: { 
      sph: searchParams.get("od_sph") || "", 
      cyl: searchParams.get("od_cyl") || "", 
      axe: searchParams.get("od_axe") || "" 
    },
    og: { 
      sph: searchParams.get("og_sph") || "", 
      cyl: searchParams.get("og_cyl") || "", 
      axe: searchParams.get("og_axe") || "" 
    }
  });

  useEffect(() => {
    const searchClient = async () => {
      const cleanPhone = clientPhone.toString().replace(/\s/g, "");
      if (cleanPhone.length >= 10 && !editId) {
        setIsSearchingClient(true);
        try {
          const q = query(collection(db, "clients"), where("phone", "==", cleanPhone));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const clientData = querySnapshot.docs[0].data();
            setClientName(clientData.name);
            setMutuelle(clientData.mutuelle || "Aucun");

            const salesQ = query(collection(db, "sales"), where("clientPhone", "==", cleanPhone));
            const salesSnapshot = await getDocs(salesQ);
            
            let unpaid = 0;
            let count = 0;
            salesSnapshot.forEach(doc => {
              const data = doc.data();
              unpaid += (data.reste || 0);
              count++;
            });

            setClientHistory({ totalUnpaid: unpaid, orderCount: count, hasUnpaid: unpaid > 0 });
          } else {
            setClientHistory(null);
          }
        } catch (error) {
          console.error("Erreur recherche client:", error);
        } finally {
          setIsSearchingClient(false);
        }
      } else if (cleanPhone.length < 10) {
        setClientHistory(null);
      }
    };

    const timer = setTimeout(searchClient, 500);
    return () => clearTimeout(timer);
  }, [clientPhone, db, editId]);

  const cleanVal = (val: string | number) => {
    if (typeof val === 'number') return val;
    const cleaned = val.toString().replace(/\s/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  };

  const nTotal = cleanVal(total);
  const nDiscount = cleanVal(discountValue);
  const nAvance = cleanVal(avance);

  const remiseAmount = discountType === "percent" ? (nTotal * nDiscount) / 100 : nDiscount;
  const totalNet = Math.max(0, nTotal - remiseAmount);
  const resteAPayer = Math.max(0, totalNet - nAvance);

  const handlePrescriptionChange = (side: "OD" | "OG", field: string, value: string) => {
    setPrescription(prev => ({ ...prev, [side.toLowerCase()]: { ...prev[side.toLowerCase() as keyof typeof prev], [field]: value } }));
  };

  const handleSave = async (silent = false) => {
    if (!clientName || nTotal === 0 || !clientPhone) {
      toast({ variant: "destructive", title: "Erreur", description: "Nom, téléphone et total obligatoires." });
      return null;
    }

    setLoading(true);
    const statut = resteAPayer <= 0 ? "Payé" : (nAvance > 0 ? "Partiel" : "En attente");
    
    // Format de facture demandé: OPT-2026-**
    const suffix = Date.now().toString().slice(-6);
    const invoiceId = editId ? searchParams.get("invoiceId") || `OPT-2026-${suffix}` : `OPT-2026-${suffix}`;

    const saleData = {
      invoiceId,
      clientName,
      clientPhone: clientPhone.toString().replace(/\s/g, ""),
      mutuelle,
      total: nTotal,
      remise: remiseAmount,
      discountType,
      discountValue: nDiscount,
      remisePercent: discountType === "percent" ? nDiscount.toString() : "Fixe",
      avance: nAvance,
      reste: resteAPayer,
      purchasePriceFrame: cleanVal(purchasePriceFrame),
      purchasePriceLenses: cleanVal(purchasePriceLenses),
      statut,
      prescription,
      monture,
      verres,
      notes,
      updatedAt: serverTimestamp(),
    };

    try {
      const clientsRef = collection(db, "clients");
      const cleanPhone = clientPhone.toString().replace(/\s/g, "");
      const clientSnapshot = await getDocs(query(clientsRef, where("phone", "==", cleanPhone)));

      if (clientSnapshot.empty) {
        await addDoc(clientsRef, { name: clientName, phone: cleanPhone, mutuelle, lastVisit: new Date().toLocaleDateString("fr-FR"), ordersCount: 1, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, "clients", clientSnapshot.docs[0].id), { lastVisit: new Date().toLocaleDateString("fr-FR"), ordersCount: increment(1), name: clientName, mutuelle });
      }

      if (editId) {
        await updateDoc(doc(db, "sales", editId), saleData);
      } else {
        await addDoc(collection(db, "sales"), { ...saleData, createdAt: serverTimestamp() });
      }

      if (nAvance > 0) {
        await addDoc(collection(db, "transactions"), {
          type: "VENTE",
          label: `Vente ${invoiceId}`,
          category: "Optique",
          montant: nAvance,
          relatedId: invoiceId,
          createdAt: serverTimestamp()
        });
      }

      if (!silent) {
        toast({ variant: "success", title: "Vente Enregistrée" });
        router.push("/ventes");
      }
      return saleData;
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: editId ? `sales/${editId}` : "sales", operation: editId ? "update" : "create", requestResourceData: saleData }));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    const saleData = await handleSave(true);
    if (!saleData) return;
    const params = new URLSearchParams({ client: saleData.clientName, phone: saleData.clientPhone, mutuelle: saleData.mutuelle, total: saleData.total.toString(), remise: saleData.remise.toString(), remisePercent: saleData.remisePercent, avance: saleData.avance.toString(), od_sph: saleData.prescription.od.sph, od_cyl: saleData.prescription.od.cyl, od_axe: saleData.prescription.od.axe, og_sph: saleData.prescription.og.sph, og_cyl: saleData.prescription.og.cyl, og_axe: saleData.prescription.og.axe, monture: saleData.monture, verres: saleData.verres, date: new Date().toLocaleDateString("fr-FR") });
    router.push(`/ventes/facture/${saleData.invoiceId}?${params.toString()}`);
  };

  return (
    <AppShell>
      <div className="space-y-4 max-w-5xl mx-auto pb-24">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border shadow-sm">
          <div><h1 className="text-xl md:text-2xl font-black text-primary uppercase tracking-tighter">{editId ? "Modifier la Vente" : "Nouvelle Vente"}</h1><p className="text-[9px] md:text-[10px] text-muted-foreground mt-0.5 uppercase font-black tracking-[0.2em] opacity-60">Saisie client & ordonnance.</p></div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" size="lg" onClick={handlePrint} className="flex-1 sm:flex-none h-12 md:h-14 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs border-primary/20 bg-white" disabled={loading}><Printer className="mr-2 h-4 w-4" />IMPRIMER</Button>
            <Button size="lg" onClick={() => handleSave()} className="flex-1 sm:flex-none h-12 md:h-14 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs shadow-xl px-6" disabled={loading}>{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}ENREGISTRER</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm border-none overflow-hidden rounded-[24px] md:rounded-[32px] bg-white">
              <CardHeader className="py-4 px-6 md:px-8 bg-slate-50/50 border-b"><CardTitle className="text-[10px] uppercase font-black text-primary/60 tracking-[0.2em] flex items-center gap-2"><ShoppingBag className="h-4 w-4" />Informations Client</CardTitle></CardHeader>
              <CardContent className="p-6 md:p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label className="text-[10px] uppercase text-muted-foreground font-black tracking-widest ml-1 flex justify-between">Téléphone{isSearchingClient && <Loader2 className="h-3 w-3 animate-spin text-primary" />}</Label><div className="relative"><Input className="h-12 text-sm font-bold rounded-xl bg-slate-50 border-none shadow-inner pl-10" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="06 00 00 00 00" /><Search className="absolute left-3 top-3.5 h-5 w-5 text-primary/30" /></div></div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase text-muted-foreground font-black tracking-widest ml-1">Nom & Prénom</Label><Input className="h-12 text-sm font-bold rounded-xl bg-slate-50 border-none shadow-inner" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="M. Mohamed Alami" /></div>
                </div>
                <div className="space-y-2"><Label className="text-[10px] uppercase text-muted-foreground font-black tracking-widest ml-1">Couverture / Mutuelle</Label><Select onValueChange={setMutuelle} value={mutuelle}><SelectTrigger className="h-12 text-sm font-bold rounded-xl bg-slate-50 border-none shadow-inner"><SelectValue /></SelectTrigger><SelectContent className="rounded-2xl">{MUTUELLES.map(m => <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>)}</SelectContent></Select></div>
              </CardContent>
            </Card>

            {clientHistory && (
              <div className={cn("p-6 rounded-[24px] md:rounded-[32px] border-2 shadow-lg animate-in fade-in slide-in-from-top-4 duration-500", clientHistory.hasUnpaid ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200")}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="flex items-center gap-4"><div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center shadow-xl shrink-0", clientHistory.hasUnpaid ? "bg-red-500 text-white" : "bg-green-500 text-white")}>{clientHistory.hasUnpaid ? <AlertTriangle className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}</div><div><h3 className={cn("text-lg font-black uppercase tracking-tight", clientHistory.hasUnpaid ? "text-red-900" : "text-green-900")}>Vérification Dossier Client</h3><p className={cn("text-[10px] font-black uppercase tracking-[0.2em] opacity-70", clientHistory.hasUnpaid ? "text-red-700" : "text-green-700")}>{clientHistory.hasUnpaid ? "Attention : Reste à régler détecté" : "Situation financière à jour"}</p></div></div>
                  <div className="grid grid-cols-2 gap-8 w-full md:w-auto"><div className="flex flex-col items-center md:items-end"><span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Dette Totale</span><span className={cn("text-2xl font-black tracking-tighter", clientHistory.hasUnpaid ? "text-red-600" : "text-green-600")}>{formatCurrency(clientHistory.totalUnpaid)}</span></div><div className="flex flex-col items-center md:items-end"><span className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Score Fidélité</span><div className="flex items-center gap-2"><span className="text-2xl font-black text-slate-900 tracking-tighter">{clientHistory.orderCount}</span><Star className="h-4 w-4 text-yellow-500 fill-yellow-500" /></div></div></div>
                </div>
              </div>
            )}

            <Card className="shadow-sm border-none overflow-hidden rounded-[24px] md:rounded-[32px] bg-white"><CardHeader className="py-4 px-6 md:px-8 bg-slate-50/50 border-b"><CardTitle className="text-[10px] uppercase font-black text-primary/60 tracking-[0.2em]">Prescription Optique</CardTitle></CardHeader><CardContent className="p-6 md:p-8"><PrescriptionForm od={prescription.od} og={prescription.og} onChange={handlePrescriptionChange} /></CardContent></Card>
          </div>

          <div className="space-y-6">
            <Card className="shadow-2xl border-none bg-primary p-2 rounded-[32px] md:rounded-[40px] lg:sticky lg:top-24">
              <CardHeader className="py-6 px-8 text-white/60"><CardTitle className="text-[10px] font-black uppercase tracking-[0.3em]">Calcul Financier</CardTitle></CardHeader>
              <CardContent className="p-4 md:p-6 space-y-5">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Prix Brut</Label><div className="flex items-center gap-1.5 flex-1 justify-end ml-4"><input className="w-full h-8 text-right font-black bg-transparent text-slate-950 outline-none text-lg" type="number" value={total} onChange={(e) => setTotal(e.target.value)} /><span className="text-[9px] font-black text-slate-400">DH</span></div></div>
                <div className="space-y-4 pt-4 border-t border-white/10"><div className="flex justify-between items-center px-1"><Label className="text-white/60 text-[10px] font-black uppercase tracking-widest">Remise</Label><Tabs value={discountType} onValueChange={(v) => setDiscountType(v as any)} className="h-7"><TabsList className="h-7 grid grid-cols-2 w-16 p-1 bg-white/10 border-none rounded-lg"><TabsTrigger value="percent" className="text-[9px] font-black h-5 data-[state=active]:bg-white data-[state=active]:text-primary rounded-md">%</TabsTrigger><TabsTrigger value="amount" className="text-[9px] font-black h-5 data-[state=active]:bg-white data-[state=active]:text-primary rounded-md">DH</TabsTrigger></TabsList></Tabs></div><div className="flex items-center gap-2 bg-white rounded-2xl p-4 shadow-sm"><input className="w-full h-8 text-right text-slate-950 font-black bg-transparent outline-none text-lg" type="number" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} /><span className="text-[9px] font-black text-slate-400">{discountType === 'percent' ? '%' : 'DH'}</span></div></div>
                <div className="flex justify-between items-center bg-white/10 p-5 rounded-2xl border border-white/5"><Label className="text-[10px] font-black uppercase text-white tracking-widest">Net à payer</Label><span className="font-black text-xl text-white tracking-tighter">{formatCurrency(totalNet)}</span></div>
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm"><Label className="text-primary text-[10px] font-black uppercase tracking-widest">Avance</Label><div className="flex items-center gap-1.5 flex-1 justify- Cloud-end ml-4"><input className="w-full h-8 text-right text-slate-950 font-black bg-transparent outline-none text-lg" type="number" value={avance} onChange={(e) => setAvance(e.target.value)} /><span className="text-[9px] font-black text-slate-400">DH</span></div></div>
                <div className="bg-slate-950 text-white p-6 rounded-[24px] md:rounded-[32px] flex flex-col items-center gap-1 shadow-2xl border border-white/5 mt-2"><span className="text-[9px] font-black uppercase tracking-[0.4em] text-white/40">Reste à régler</span><div className="flex items-center gap-2"><span className="text-3xl md:text-4xl font-black tracking-tighter text-accent">{formatCurrency(resteAPayer)}</span></div></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function NewSalePage() { return <Suspense fallback={<div className="flex items-center justify-center min-h-screen font-black uppercase text-primary/30 animate-pulse">Chargement...</div>}><NewSaleForm /></Suspense>; }
