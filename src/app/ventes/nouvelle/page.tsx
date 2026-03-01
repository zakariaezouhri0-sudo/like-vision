
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrescriptionForm } from "@/components/optical/prescription-form";
import { ShoppingBag, Save, Loader2, Calendar as CalendarIcon, User, Phone, ShieldCheck, FileText, Glasses } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn } from "@/lib/utils";
import { AppShell } from "@/components/layout/app-shell";
import { useFirestore, useUser } from "@/firebase";
import { collection, doc, serverTimestamp, runTransaction, Timestamp } from "firebase/firestore";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { MUTUELLES } from "@/lib/constants";

function NewSaleForm() {
  const { toast } = useToast();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeEditId] = useState<string | null>(searchParams.get("editId"));

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role');
    if (savedRole) setRole(savedRole.toUpperCase());
    else router.push('/login');
  }, [router]);

  const isPrepaMode = role === "PREPA";

  const [saleDate, setSaleDate] = useState<Date>(() => {
    const d = searchParams.get("date_raw");
    return d ? new Date(d) : new Date();
  });
  
  const [clientName, setClientName] = useState(searchParams.get("client") || "");
  const [clientPhone, setClientPhone] = useState(searchParams.get("phone") || "");
  const [mutuelle, setMutuelle] = useState(searchParams.get("mutuelle") || "Aucun");
  const [monture, setMonture] = useState(searchParams.get("monture") || "");
  const [verres, setVerres] = useState(searchParams.get("verres") || "");
  const [notes, setNotes] = useState(searchParams.get("notes") || "");
  const [total, setTotal] = useState<string>(searchParams.get("total") || "");
  const [discountValue, setDiscountValue] = useState<string>(searchParams.get("discountValue") || "");
  const [avance, setAvance] = useState<string>(searchParams.get("avance") || "");

  const [prescription, setPrescription] = useState({
    od: { sph: searchParams.get("od_sph") || "", cyl: searchParams.get("od_cyl") || "", axe: searchParams.get("od_axe") || "", add: searchParams.get("od_add") || "" },
    og: { sph: searchParams.get("og_sph") || "", cyl: searchParams.get("og_cyl") || "", axe: searchParams.get("og_axe") || "", add: searchParams.get("og_add") || "" }
  });

  const cleanVal = (val: string | number): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const cleaned = val.toString().replace(/\s/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  };

  const nTotal = cleanVal(total);
  const nDiscount = cleanVal(discountValue);
  const nAvance = cleanVal(avance);
  
  const totalNetValue = Math.max(0, nTotal - nDiscount);
  const resteAPayerValue = Math.max(0, totalNetValue - nAvance);

  const handleSave = async () => {
    if (!clientName) {
      toast({ variant: "destructive", title: "Erreur", description: "Le nom du client est requis." });
      return;
    }
    
    setLoading(true);
    const currentIsDraft = role === "PREPA";
    const currentUserName = user?.displayName || "Inconnu";

    try {
      await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, "settings", currentIsDraft ? "counters_draft" : "counters");
        const counterSnap = await transaction.get(counterRef);
        const saleRef = activeEditId ? doc(db, "sales", activeEditId) : doc(collection(db, "sales"));
        
        let counters = { fc: 0, rc: 0 };
        if (counterSnap.exists()) counters = counterSnap.data() as any;

        const isPaid = resteAPayerValue <= 0;
        const statut = isPaid ? "Payé" : (nAvance > 0 ? "Partiel" : "En attente");
        let invoiceId = searchParams.get("invoiceId") || "";

        if (!activeEditId) {
          const prefix = currentIsDraft ? "PREPA-" : "";
          if (isPaid) { 
            counters.fc += 1; 
            invoiceId = `${prefix}FC-2026-${counters.fc.toString().padStart(4, '0')}`; 
          } else { 
            counters.rc += 1; 
            invoiceId = `${prefix}RC-2026-${counters.rc.toString().padStart(4, '0')}`; 
          }
          transaction.set(counterRef, counters, { merge: true });
        }

        const saleData: any = {
          invoiceId,
          clientName, 
          clientPhone: clientPhone.replace(/\s/g, ""),
          mutuelle,
          monture,
          verres,
          notes,
          total: nTotal, 
          remise: nDiscount,
          avance: nAvance, 
          reste: resteAPayerValue, 
          statut,
          prescription, 
          isDraft: currentIsDraft, 
          updatedAt: serverTimestamp()
        };

        if (!activeEditId) {
          saleData.createdAt = Timestamp.fromDate(saleDate);
          saleData.createdBy = currentUserName;
          saleData.payments = [];
          if (nAvance > 0) saleData.payments.push({ amount: nAvance, date: new Date().toISOString(), userName: currentUserName });
        }

        transaction.set(saleRef, saleData, { merge: true });

        if (nAvance > 0 && !activeEditId) {
          const transRef = doc(collection(db, "transactions"));
          transaction.set(transRef, {
            type: "VENTE", label: `VENTE ${invoiceId}`, clientName, montant: nAvance, relatedId: invoiceId,
            userName: currentUserName, isDraft: currentIsDraft, createdAt: serverTimestamp()
          }, { merge: true });
        }
      });

      toast({ variant: "success", title: "Vente Enregistrée" });
      router.push("/ventes");
    } catch (err) { 
      toast({ variant: "destructive", title: "Erreur lors de l'enregistrement" }); 
    } finally { 
      setLoading(false); 
    }
  };

  if (!role) return null;

  return (
    <AppShell>
      <div className="space-y-4 max-w-6xl mx-auto pb-24">
        <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border shadow-sm">
          <div className="flex items-center gap-4">
            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", isPrepaMode ? "bg-orange-100 text-orange-600" : "bg-primary/10 text-primary")}><ShoppingBag className="h-6 w-6" /></div>
            <div><h1 className="text-2xl font-black text-primary uppercase tracking-tighter">{isPrepaMode ? "Saisie Historique" : "Nouvelle Vente"}</h1></div>
          </div>
          <Button onClick={handleSave} className="h-12 rounded-xl font-black text-[10px] px-8 shadow-xl" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : <Save className="mr-2 h-4 w-4" />}ENREGISTRER</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Dossier Client */}
            <Card className="rounded-[32px] bg-white border-none shadow-sm overflow-hidden">
              <CardHeader className="py-4 px-8 bg-slate-50 border-b flex flex-row items-center gap-2">
                <User className="h-4 w-4 text-primary/40" />
                <CardTitle className="text-[10px] uppercase font-black text-primary/60">Dossier Client & Date</CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase ml-1">Nom Complet</Label>
                    <Input className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold" placeholder="M. Mohamed..." value={clientName} onChange={e => setClientName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase ml-1">Téléphone</Label>
                    <Input className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold" placeholder="06..." value={clientPhone} onChange={e => setClientPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase ml-1">Mutuelle</Label>
                    <Select value={mutuelle} onValueChange={setMutuelle}>
                      <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {MUTUELLES.map(m => <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase ml-1">Date de la vente</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full h-12 rounded-xl bg-slate-50 border-none justify-start font-bold shadow-inner text-slate-700">
                          <CalendarIcon className="mr-2 h-4 w-4 text-primary/40" />
                          {format(saleDate, "dd MMMM yyyy", { locale: fr })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 border-none shadow-2xl rounded-2xl" align="start">
                        <Calendar mode="single" selected={saleDate} onSelect={(d) => d && setSaleDate(d)} locale={fr} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Prescription */}
            <Card className="rounded-[32px] bg-white border-none shadow-sm overflow-hidden">
              <CardHeader className="py-4 px-8 bg-slate-50 border-b flex flex-row items-center gap-2">
                <FileText className="h-4 w-4 text-primary/40" />
                <CardTitle className="text-[10px] uppercase font-black text-primary/60">Prescription Optique</CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <PrescriptionForm od={prescription.od} og={prescription.og} onChange={(s, f, v) => setPrescription(prev => ({...prev, [s.toLowerCase()]: {...(prev as any)[s.toLowerCase()], [f]: v}}))} />
              </CardContent>
            </Card>

            {/* Détails Produits */}
            <Card className="rounded-[32px] bg-white border-none shadow-sm overflow-hidden">
              <CardHeader className="py-4 px-8 bg-slate-50 border-b flex flex-row items-center gap-2">
                <Glasses className="h-4 w-4 text-primary/40" />
                <CardTitle className="text-[10px] uppercase font-black text-primary/60">Équipement & Notes</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Monture</Label><Input className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold" placeholder="Marque, Modèle..." value={monture} onChange={e => setMonture(e.target.value)} /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Verres</Label><Input className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold" placeholder="Type, Traitement..." value={verres} onChange={e => setVerres(e.target.value)} /></div>
                </div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Commentaires / Observations</Label><Textarea className="min-h-[100px] rounded-2xl bg-slate-50 border-none shadow-inner font-medium" placeholder="Informations complémentaires..." value={notes} onChange={e => setNotes(e.target.value)} /></div>
              </CardContent>
            </Card>
          </div>

          {/* Côté Finances */}
          <div className="space-y-6">
            <Card className="bg-primary text-white rounded-[40px] shadow-2xl overflow-hidden sticky top-24">
              <CardHeader className="py-6 px-8 text-white/60 border-b border-white/5 flex flex-row items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                <CardTitle className="text-[10px] font-black uppercase tracking-widest">Calcul de la Facture</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-inner group transition-all focus-within:ring-2 focus-within:ring-accent">
                  <Label className="text-[10px] font-black text-primary uppercase">Prix Brut (DH)</Label>
                  <input 
                    type="number" 
                    className="bg-transparent text-right font-black text-slate-950 outline-none text-xl w-28 tabular-nums" 
                    placeholder="---" 
                    value={total === "0" || total === "" ? "" : total} 
                    onChange={e => setTotal(e.target.value)} 
                  />
                </div>
                
                <div className="bg-white/10 p-4 rounded-2xl flex justify-between items-center group transition-all focus-within:bg-white/20">
                  <Label className="text-[10px] font-black uppercase text-white/80">Remise (DH)</Label>
                  <input 
                    type="number" 
                    className="bg-transparent text-right font-black text-white outline-none text-xl w-28 tabular-nums" 
                    placeholder="---" 
                    value={discountValue === "0" || discountValue === "" ? "" : discountValue} 
                    onChange={e => setDiscountValue(e.target.value)} 
                  />
                </div>

                <div className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-inner group transition-all focus-within:ring-2 focus-within:ring-accent">
                  <Label className="text-[10px] font-black text-primary uppercase">Versé ce jour (DH)</Label>
                  <input 
                    type="number" 
                    className="bg-transparent text-right font-black text-slate-950 outline-none text-xl w-28 tabular-nums" 
                    placeholder="---" 
                    value={avance === "0" || avance === "" ? "" : avance} 
                    onChange={e => setAvance(e.target.value)} 
                  />
                </div>

                <div className="bg-slate-950/40 p-6 rounded-3xl text-center space-y-1 border border-white/5 shadow-2xl">
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Net à payer</p>
                  <p className="text-3xl font-black text-white tabular-nums tracking-tighter">{formatCurrency(totalNetValue)}</p>
                </div>

                <div className="bg-accent p-6 rounded-3xl text-center space-y-1 shadow-lg transform scale-105">
                  <p className="text-[9px] font-black text-primary/60 uppercase tracking-widest">Reste à recouvrer</p>
                  <p className="text-3xl font-black text-primary tabular-nums tracking-tighter">{formatCurrency(resteAPayerValue)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function NewSalePage() { return <Suspense fallback={null}><NewSaleForm /></Suspense>; }
