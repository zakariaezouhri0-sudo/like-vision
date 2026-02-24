
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
import { ShoppingBag, Save, Printer, ChevronDown, Loader2, Search, Calculator, Target } from "lucide-react";
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

  const editId = searchParams.get("editId");

  const [mutuelle, setMutuelle] = useState(searchParams.get("mutuelle") || "Aucun");
  const [clientName, setClientName] = useState(searchParams.get("client") || "");
  const [clientPhone, setClientPhone] = useState(searchParams.get("phone") || "");
  const [total, setTotal] = useState(Number(searchParams.get("total")) || 0);
  const [discountType, setDiscountType] = useState<"percent" | "amount">(searchParams.get("discountType") as any || "percent");
  const [discountValue, setDiscountValue] = useState(Number(searchParams.get("discountValue")) || 0);
  const [avance, setAvance] = useState(Number(searchParams.get("avance")) || 0);
  const [monture, setMonture] = useState(searchParams.get("monture") || "");
  const [verres, setVerres] = useState(searchParams.get("verres") || "");
  const [notes, setNotes] = useState(searchParams.get("notes") || "");
  
  // Nouveaux champs pour le calcul de la marge (Interne)
  const [purchasePriceFrame, setPurchasePriceFrame] = useState(Number(searchParams.get("purchasePriceFrame")) || 0);
  const [purchasePriceLenses, setPurchasePriceLenses] = useState(Number(searchParams.get("purchasePriceLenses")) || 0);

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
      const cleanPhone = clientPhone.replace(/\s/g, "");
      if (cleanPhone.length >= 10 && !editId) {
        setIsSearchingClient(true);
        try {
          const q = query(collection(db, "clients"), where("phone", "==", clientPhone));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const clientData = querySnapshot.docs[0].data();
            setClientName(clientData.name);
            setMutuelle(clientData.mutuelle || "Aucun");
            toast({
              variant: "success",
              title: "Client trouvé",
              description: `Dossier de ${clientData.name} récupéré automatiquement.`,
            });
          }
        } catch (error) {
          console.error("Erreur recherche client:", error);
        } finally {
          setIsSearchingClient(false);
        }
      }
    };

    const timer = setTimeout(searchClient, 500);
    return () => clearTimeout(timer);
  }, [clientPhone, db, editId, toast]);

  // Calculs Financiers Précis
  const remiseAmount = discountType === "percent" 
    ? (Number(total) * Number(discountValue)) / 100 
    : Number(discountValue);

  const totalNet = Math.max(0, Number(total) - remiseAmount);
  const resteAPayer = Math.max(0, totalNet - Number(avance));
  
  // Calcul de la marge brute
  const totalPurchase = Number(purchasePriceFrame) + Number(purchasePriceLenses);
  const margeBrute = totalNet - totalPurchase;

  const handlePrescriptionChange = (side: "OD" | "OG", field: string, value: string) => {
    setPrescription(prev => ({
      ...prev,
      [side.toLowerCase()]: {
        ...prev[side.toLowerCase() as keyof typeof prev],
        [field]: value
      }
    }));
  };

  const handleSave = async (silent = false) => {
    if (!clientName || !total || !clientPhone) {
      toast({ variant: "destructive", title: "Erreur", description: "Nom, téléphone et total obligatoires." });
      return null;
    }

    setLoading(true);

    const statut = resteAPayer <= 0 ? "Payé" : (Number(avance) > 0 ? "Partiel" : "En attente");
    const invoiceId = editId ? searchParams.get("invoiceId") || `OPT-${Date.now().toString().slice(-6)}` : `OPT-${Date.now().toString().slice(-6)}`;

    const saleData = {
      invoiceId,
      clientName,
      clientPhone,
      mutuelle,
      total: Number(total),
      remise: remiseAmount,
      discountType,
      discountValue: Number(discountValue),
      remisePercent: discountType === "percent" ? discountValue.toString() : "Fixe",
      avance: Number(avance),
      reste: resteAPayer,
      purchasePriceFrame: Number(purchasePriceFrame),
      purchasePriceLenses: Number(purchasePriceLenses),
      statut,
      prescription,
      monture,
      verres,
      notes,
      updatedAt: serverTimestamp(),
    };

    try {
      const clientsRef = collection(db, "clients");
      const clientQuery = query(clientsRef, where("phone", "==", clientPhone));
      const clientSnapshot = await getDocs(clientQuery);

      if (clientSnapshot.empty) {
        await addDoc(clientsRef, {
          name: clientName,
          phone: clientPhone,
          mutuelle: mutuelle,
          lastVisit: new Date().toLocaleDateString("fr-FR"),
          ordersCount: 1,
          createdAt: serverTimestamp(),
        });
      } else {
        const clientId = clientSnapshot.docs[0].id;
        await updateDoc(doc(db, "clients", clientId), {
          lastVisit: new Date().toLocaleDateString("fr-FR"),
          ordersCount: increment(1),
          name: clientName,
          mutuelle: mutuelle
        });
      }

      if (editId) {
        await updateDoc(doc(db, "sales", editId), saleData);
      } else {
        await addDoc(collection(db, "sales"), { ...saleData, createdAt: serverTimestamp() });
      }

      if (!silent) {
        toast({ 
          variant: "success", 
          title: "Vente Enregistrée", 
          description: editId ? "La facture a été mise à jour." : "La vente et le dossier client ont été enregistrés." 
        });
        router.push("/ventes");
      }
      return saleData;
    } catch (err) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({ 
        path: editId ? `sales/${editId}` : "sales", 
        operation: editId ? "update" : "create", 
        requestResourceData: saleData 
      }));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    const saleData = await handleSave(true);
    if (!saleData) return;

    const params = new URLSearchParams({
      client: saleData.clientName,
      phone: saleData.clientPhone,
      mutuelle: saleData.mutuelle,
      total: saleData.total.toString(),
      remise: saleData.remise.toString(),
      remisePercent: saleData.remisePercent,
      avance: saleData.avance.toString(),
      od_sph: saleData.prescription.od.sph,
      od_cyl: saleData.prescription.od.cyl,
      od_axe: saleData.prescription.od.axe,
      og_sph: saleData.prescription.og.sph,
      og_cyl: saleData.prescription.og.cyl,
      og_axe: saleData.prescription.og.axe,
      monture: saleData.monture,
      verres: saleData.verres,
      date: new Date().toLocaleDateString("fr-FR"),
    });
    router.push(`/ventes/facture/${saleData.invoiceId}?${params.toString()}`);
  };

  return (
    <AppShell>
      <div className="space-y-4 max-w-5xl mx-auto pb-24">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[32px] border shadow-sm">
          <div>
            <h1 className="text-2xl font-black text-primary uppercase tracking-tighter">
              {editId ? "Modifier la Vente" : "Nouvelle Vente"}
            </h1>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase font-black tracking-[0.2em] opacity-60">Saisie client & ordonnance.</p>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button variant="outline" size="lg" onClick={handlePrint} className="flex-1 sm:flex-none h-14 rounded-2xl font-black text-xs border-primary/20 bg-white hover:bg-primary/5 shadow-sm" disabled={loading}>
              <Printer className="mr-2 h-5 w-5" />
              IMPRIMER
            </Button>
            <Button size="lg" onClick={() => handleSave()} className="flex-1 sm:flex-none h-14 rounded-2xl font-black text-xs shadow-xl px-10" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              ENREGISTRER
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm border-none overflow-hidden rounded-[32px] bg-white">
              <CardHeader className="py-4 px-8 bg-slate-50/50 border-b">
                <CardTitle className="text-[10px] uppercase font-black text-primary/60 tracking-[0.2em] flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Informations Client
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground font-black tracking-widest ml-1 flex justify-between">
                      Téléphone
                      {isSearchingClient && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                    </Label>
                    <div className="relative">
                      <Input className="h-12 text-sm font-bold rounded-xl bg-slate-50 border-none shadow-inner pl-10" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="06 00 00 00 00" />
                      <Search className="absolute left-3 top-3.5 h-5 w-5 text-primary/30" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground font-black tracking-widest ml-1">Nom & Prénom</Label>
                    <Input className="h-12 text-sm font-bold rounded-xl bg-slate-50 border-none shadow-inner" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="M. Mohamed Alami" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase text-muted-foreground font-black tracking-widest ml-1">Couverture / Mutuelle</Label>
                  <Select onValueChange={setMutuelle} value={mutuelle}>
                    <SelectTrigger className="h-12 text-sm font-bold rounded-xl bg-slate-50 border-none shadow-inner">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {MUTUELLES.map(m => <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-none overflow-hidden rounded-[32px] bg-white">
              <CardHeader className="py-4 px-8 bg-slate-50/50 border-b">
                <CardTitle className="text-[10px] uppercase font-black text-primary/60 tracking-[0.2em]">Prescription Optique</CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <PrescriptionForm od={prescription.od} og={prescription.og} onChange={handlePrescriptionChange} />
              </CardContent>
            </Card>

            <Collapsible defaultOpen={false} className="border-none rounded-[32px] bg-white shadow-sm overflow-hidden">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full flex justify-between px-8 py-5 h-auto hover:bg-slate-50 transition-all">
                  <span className="text-[10px] font-black uppercase text-primary/40 tracking-[0.2em]">Options Monture & Verres (Détails)</span>
                  <ChevronDown className="h-4 w-4 opacity-40" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-8 pt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground font-black tracking-widest ml-1">Détail Monture</Label>
                    <Input className="h-12 text-sm font-bold rounded-xl bg-slate-50 border-none" value={monture} onChange={(e) => setMonture(e.target.value)} placeholder="Marque, Modèle..." />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground font-black tracking-widest ml-1">Détail Verres</Label>
                    <Input className="h-12 text-sm font-bold rounded-xl bg-slate-50 border-none" value={verres} onChange={(e) => setVerres(e.target.value)} placeholder="Type, Traitement..." />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase text-muted-foreground font-black tracking-widest ml-1">Notes additionnelles</Label>
                  <Textarea className="text-sm font-bold rounded-xl bg-slate-50 border-none min-h-[100px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observations particulières..." />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="space-y-6">
            <Card className="shadow-2xl border-none bg-primary p-2 rounded-[40px] sticky top-24 overflow-hidden">
              <CardHeader className="py-6 px-8 text-white">
                <CardTitle className="text-xs font-black uppercase tracking-[0.3em] opacity-60">Calcul Financier</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Prix de Vente Brut</Label>
                  <div className="relative">
                    <Input className="w-32 h-10 text-right font-black pr-10 border-none bg-transparent text-slate-900 focus-visible:ring-0 text-lg" type="number" value={total} onChange={(e) => setTotal(Number(e.target.value))} />
                    <span className="absolute right-3 top-2.5 text-[9px] font-black text-slate-400">DH</span>
                  </div>
                </div>
                
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="flex justify-between items-center">
                    <Label className="text-white/60 text-[10px] font-black uppercase tracking-widest">Remise Client</Label>
                    <Tabs value={discountType} onValueChange={(v) => setDiscountType(v as any)} className="h-8">
                      <TabsList className="h-8 grid grid-cols-2 w-20 p-1 bg-white/10 border-none">
                        <TabsTrigger value="percent" className="text-[10px] font-black h-6 data-[state=active]:bg-white data-[state=active]:text-primary">%</TabsTrigger>
                        <TabsTrigger value="amount" className="text-[10px] font-black h-6 data-[state=active]:bg-white data-[state=active]:text-primary">DH</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  <div className="flex justify-end relative bg-white rounded-2xl overflow-hidden">
                    <Input className="w-full h-12 text-right text-slate-900 font-black pr-10 border-none focus-visible:ring-0" type="number" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} />
                    <span className="absolute right-4 top-3.5 text-[9px] font-black text-slate-400">{discountType === 'percent' ? '%' : 'DH'}</span>
                  </div>
                  {discountType === 'percent' && (
                    <p className="text-right text-[10px] font-black text-white/40 italic">
                      = -{formatCurrency(remiseAmount)}
                    </p>
                  )}
                </div>

                <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-inner border border-white/10">
                  <Label className="text-[10px] font-black uppercase text-primary tracking-widest">Net à payer</Label>
                  <span className="font-black text-xl text-primary tracking-tighter">{formatCurrency(totalNet)}</span>
                </div>
                
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl">
                  <Label className="text-primary text-[10px] font-black uppercase tracking-widest">Avance payée</Label>
                  <div className="relative">
                    <Input className="w-32 h-10 text-right text-slate-900 font-black pr-10 border-none bg-transparent focus-visible:ring-0 text-lg" type="number" value={avance} onChange={(e) => setAvance(Number(e.target.value))} />
                    <span className="absolute right-3 top-2.5 text-[9px] font-black text-slate-400">DH</span>
                  </div>
                </div>
                
                <div className="bg-slate-900 text-white p-6 rounded-[32px] flex flex-col items-center gap-1 shadow-2xl border border-white/5">
                  <span className="text-[9px] font-black uppercase tracking-[0.4em] opacity-40">Reste à régler</span>
                  <span className="text-3xl font-black tracking-tighter text-primary">
                    {formatCurrency(resteAPayer).split(' ')[0]}
                    <span className="text-xs ml-1 opacity-40">DH</span>
                  </span>
                </div>

                {/* Section Interne - Prix d'achat & Marge */}
                <div className="pt-6 mt-6 border-t border-white/20 space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-white/50 tracking-[0.3em] flex items-center gap-2">
                    <Calculator className="h-3 w-3" />
                    Données d'achat (Interne)
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black/20 p-3 rounded-xl space-y-1">
                      <Label className="text-[9px] font-black uppercase text-white/40 tracking-widest">Achat Monture</Label>
                      <Input className="h-8 text-right font-black text-white bg-transparent border-none p-0 focus-visible:ring-0 text-xs" type="number" value={purchasePriceFrame} onChange={(e) => setPurchasePriceFrame(Number(e.target.value))} />
                    </div>
                    <div className="bg-black/20 p-3 rounded-xl space-y-1">
                      <Label className="text-[9px] font-black uppercase text-white/40 tracking-widest">Achat Verres</Label>
                      <Input className="h-8 text-right font-black text-white bg-transparent border-none p-0 focus-visible:ring-0 text-xs" type="number" value={purchasePriceLenses} onChange={(e) => setPurchasePriceLenses(Number(e.target.value))} />
                    </div>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-green-400" />
                      <span className="text-[10px] font-black uppercase text-green-400 tracking-widest">Marge Brute</span>
                    </div>
                    <span className={cn("font-black text-sm", margeBrute >= 0 ? "text-green-400" : "text-destructive")}>
                      {formatCurrency(margeBrute)}
                    </span>
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

export default function NewSalePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Chargement du formulaire...</div>}>
      <NewSaleForm />
    </Suspense>
  );
}
