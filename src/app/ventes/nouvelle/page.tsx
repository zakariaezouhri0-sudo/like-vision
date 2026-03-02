"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrescriptionForm } from "@/components/optical/prescription-form";
import { ShoppingBag, Save, Loader2, Calendar as CalendarIcon, User, Phone, ShieldCheck, FileText, Glasses, AlertCircle, Printer, Percent, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn, roundAmount } from "@/lib/utils";
import { AppShell } from "@/components/layout/app-shell";
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc, serverTimestamp, runTransaction, Timestamp, query, where } from "firebase/firestore";
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
  const isAdminOrPrepa = role === "ADMIN" || role === "PREPA";

  const [saleDate, setSaleDate] = useState<Date>(() => {
    const d = searchParams.get("date_raw");
    return d ? new Date(d) : new Date();
  });
  
  const [clientName, setClientName] = useState(searchParams.get("client") || "");
  const [clientPhone, setClientPhone] = useState(searchParams.get("phone") || "");
  
  const [mutuelle, setMutuelle] = useState(() => {
    const m = searchParams.get("mutuelle");
    if (m && m !== "Aucun" && !MUTUELLES.filter(opt => opt !== "Autre").includes(m)) return "Autre";
    return m || "Aucun";
  });
  const [customMutuelle, setCustomMutuelle] = useState(() => {
    const m = searchParams.get("mutuelle");
    if (m && m !== "Aucun" && !MUTUELLES.filter(opt => opt !== "Autre").includes(m)) return m;
    return "";
  });

  const [monture, setMonture] = useState(searchParams.get("monture") || "");
  const [verres, setVerres] = useState(searchParams.get("verres") || "");
  const [notes, setNotes] = useState(searchParams.get("notes") || "");
  const [total, setTotal] = useState<string>(searchParams.get("total") || "");
  
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>(
    (searchParams.get("discountType") as 'fixed' | 'percent') || 'fixed'
  );
  const [discountValue, setDiscountValue] = useState<string>(searchParams.get("discountValue") || "");
  const [avance, setAvance] = useState<string>(searchParams.get("avance") || "");

  const [prescription, setPrescription] = useState({
    od: { sph: searchParams.get("od_sph") || "", cyl: searchParams.get("od_cyl") || "", axe: searchParams.get("od_axe") || "", add: searchParams.get("od_add") || "" },
    og: { sph: searchParams.get("og_sph") || "", cyl: searchParams.get("og_cyl") || "", axe: searchParams.get("og_axe") || "", add: searchParams.get("og_add") || "" }
  });

  // Vérification du statut de la caisse pour la date sélectionnée
  const dateStr = format(saleDate, "yyyy-MM-dd");
  const sessionDocId = isPrepaMode ? `DRAFT-${dateStr}` : dateStr;
  const sessionRef = useMemoFirebase(() => doc(db, "cash_sessions", sessionDocId), [db, sessionDocId]);
  const { data: sessionData } = useDoc(sessionRef);
  const isSessionClosed = sessionData?.status === "CLOSED";

  const clientsQuery = useMemoFirebase(() => collection(db, "clients"), [db]);
  const { data: allClients } = useCollection(clientsQuery);

  const salesQuery = useMemoFirebase(() => collection(db, "sales"), [db]);
  const { data: allSales } = useCollection(salesQuery);

  useEffect(() => {
    if (!clientPhone || clientPhone.length < 8 || activeEditId) return;

    const cleanedSearch = clientPhone.replace(/\s/g, "");
    const foundClient = allClients?.find(c => {
      const matchMode = isPrepaMode ? c.isDraft === true : !c.isDraft;
      if (!matchMode) return false;
      const phone = (c.phone || "").replace(/\s/g, "");
      return phone === cleanedSearch;
    });

    if (foundClient) {
      setClientName(foundClient.name);
      if (foundClient.mutuelle) {
        if (MUTUELLES.filter(m => m !== 'Autre').includes(foundClient.mutuelle)) {
          setMutuelle(foundClient.mutuelle);
          setCustomMutuelle("");
        } else {
          setMutuelle("Autre");
          setCustomMutuelle(foundClient.mutuelle);
        }
      }
    }
  }, [clientPhone, allClients, isPrepaMode, activeEditId]);

  const clientDebt = useMemo(() => {
    if (!clientName || !allSales) return 0;
    const filteredSales = allSales.filter(s => {
      const matchMode = isPrepaMode ? s.isDraft === true : !s.isDraft;
      return matchMode && s.clientName?.toLowerCase().trim() === clientName.toLowerCase().trim();
    });
    return roundAmount(filteredSales.reduce((acc, s) => acc + (Number(s.reste) || 0), 0));
  }, [clientName, allSales, isPrepaMode]);

  const cleanVal = (val: string | number): number => {
    if (typeof val === 'number') return roundAmount(val);
    if (!val) return 0;
    const cleaned = val.toString().replace(/\s/g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : roundAmount(parsed);
  };

  const nTotal = cleanVal(total);
  const nDiscountVal = cleanVal(discountValue);
  const nAvance = cleanVal(avance);
  
  const calculatedRemise = useMemo(() => {
    if (discountType === 'percent') {
      return roundAmount((nTotal * nDiscountVal) / 100);
    }
    return roundAmount(nDiscountVal);
  }, [nTotal, nDiscountVal, discountType]);

  const totalNetValue = roundAmount(Math.max(0, nTotal - calculatedRemise));
  const resteAPayerValue = roundAmount(Math.max(0, totalNetValue - nAvance));

  const handleSave = async (shouldPrint: boolean = false) => {
    if (isSessionClosed) {
      toast({ 
        variant: "destructive", 
        title: "Action Impossible", 
        description: "La caisse de cette journée est clôturée. Aucune modification possible." 
      });
      return;
    }

    if (!clientName) {
      toast({ variant: "destructive", title: "Erreur", description: "Le nom du client est requis." });
      return;
    }
    
    setLoading(true);
    const currentIsDraft = role === "PREPA";
    const currentUserName = user?.displayName || "Inconnu";
    const finalMutuelle = mutuelle === "Autre" ? customMutuelle : mutuelle;
    let finalInvoiceId = "";

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
          if (isPaid) { 
            counters.fc += 1; 
            invoiceId = `FC-2026-${counters.fc.toString().padStart(4, '0')}`; 
          } else { 
            counters.rc += 1; 
            invoiceId = `RC-2026-${counters.rc.toString().padStart(4, '0')}`; 
          }
          transaction.set(counterRef, counters, { merge: true });
        }

        const saleData: any = {
          invoiceId,
          clientName, 
          clientPhone: clientPhone.replace(/\s/g, ""),
          mutuelle: finalMutuelle,
          monture,
          verres,
          notes,
          total: nTotal, 
          remise: calculatedRemise,
          discountType,
          discountValue: nDiscountVal,
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
        finalInvoiceId = invoiceId;

        if (nAvance > 0 && !activeEditId) {
          const transRef = doc(collection(db, "transactions"));
          transaction.set(transRef, {
            type: "VENTE", label: `VENTE ${invoiceId}`, clientName, montant: nAvance, relatedId: invoiceId,
            userName: currentUserName, isDraft: currentIsDraft, createdAt: serverTimestamp()
          }, { merge: true });
        }
      });

      toast({ variant: "success", title: "Vente Enregistrée" });
      
      if (shouldPrint && finalInvoiceId) {
        const page = resteAPayerValue <= 0 ? 'facture' : 'recu';
        const params = new URLSearchParams({ 
          client: clientName, 
          phone: clientPhone, 
          mutuelle: finalMutuelle, 
          total: nTotal.toString(), 
          remise: calculatedRemise.toString(), 
          remisePercent: discountType === 'percent' ? nDiscountVal.toString() : "Fixe",
          avance: nAvance.toString(), 
          od_sph: prescription.od.sph, od_cyl: prescription.od.cyl, od_axe: prescription.od.axe, od_add: prescription.od.add,
          og_sph: prescription.og.sph, og_cyl: prescription.og.cyl, og_axe: prescription.og.axe, og_add: prescription.og.add,
          monture, verres, 
          date: format(saleDate, "dd/MM/yyyy HH:mm")
        });
        router.push(`/ventes/${page}/${finalInvoiceId}?${params.toString()}`);
      } else {
        router.push("/ventes");
      }
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
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => handleSave(true)} 
              className="h-12 rounded-xl font-black text-[10px] px-8 border-primary/20 text-primary shadow-sm" 
              disabled={loading || isSessionClosed}
            >
              <Printer className="mr-2 h-4 w-4" /> IMPRIMER
            </Button>
            <Button 
              onClick={() => handleSave(false)} 
              className="h-12 rounded-xl font-black text-[10px] px-8 shadow-xl" 
              disabled={loading || isSessionClosed}
            >
              {loading ? <Loader2 className="animate-spin" /> : <Save className="mr-2 h-4 w-4" />} ENREGISTRER
            </Button>
          </div>
        </div>

        {isSessionClosed && (
          <div className="bg-white border-l-[12px] border-l-orange-500 shadow-2xl p-6 rounded-[32px] flex items-center gap-6 animate-in slide-in-from-top-4 duration-500 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-[0.03] rotate-12 transition-transform group-hover:scale-110 duration-700">
              <Lock className="h-32 w-32 text-orange-500" />
            </div>
            <div className="h-16 w-16 bg-orange-100 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
              <Lock className="h-8 w-8 text-orange-600" />
            </div>
            <div className="flex-1 relative z-10">
              <h3 className="text-[10px] font-black text-orange-600 uppercase tracking-[0.3em] mb-1">Caisse clôturée</h3>
              <p className="text-slate-700 font-bold text-lg leading-tight tracking-tight">
                La caisse du <span className="text-orange-600 font-black">{format(saleDate, "dd MMMM yyyy", { locale: fr })}</span> est déjà clôturée. Toute modification est verrouillée.
              </p>
            </div>
          </div>
        )}

        {clientDebt > 0 && (
          <div className="bg-white border-l-[12px] border-l-destructive shadow-2xl p-6 rounded-[32px] flex items-center gap-6 animate-in zoom-in-95 slide-in-from-top-4 duration-500 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-[0.03] rotate-12 transition-transform group-hover:scale-110 duration-700">
              <AlertCircle className="h-32 w-32 text-destructive" />
            </div>
            <div className="h-16 w-16 bg-destructive/10 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
              <AlertCircle className="h-8 w-8 text-destructive animate-pulse" />
            </div>
            <div className="flex-1 relative z-10">
              <h3 className="text-[10px] font-black text-destructive uppercase tracking-[0.3em] mb-1">Attention : Client débiteur</h3>
              <p className="text-slate-700 font-bold text-lg leading-tight tracking-tight">
                Ce client a un impayé total de <span className="text-destructive font-black text-2xl tabular-nums drop-shadow-sm">{formatCurrency(clientDebt)}</span> sur ses dossiers précédents.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-[32px] bg-white border-none shadow-sm overflow-hidden">
              <CardHeader className="py-4 px-8 bg-slate-50 border-b flex flex-row items-center gap-2">
                <User className="h-4 w-4 text-primary/40" />
                <CardTitle className="text-[10px] uppercase font-black text-primary/60">Dossier Client</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase ml-1">Téléphone</Label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-3.5 h-4 w-4 text-primary/30" />
                      <Input 
                        className="h-12 pl-11 rounded-xl bg-slate-50 border-none shadow-inner font-bold" 
                        placeholder="06..." 
                        value={clientPhone} 
                        onChange={e => setClientPhone(e.target.value)} 
                        readOnly={isSessionClosed}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase ml-1">Nom Complet</Label>
                    <div className="relative">
                      <User className="absolute left-4 top-3.5 h-4 w-4 text-primary/30" />
                      <Input 
                        className="h-12 pl-11 rounded-xl bg-slate-50 border-none shadow-inner font-bold" 
                        placeholder="M. Mohamed..." 
                        value={clientName} 
                        onChange={e => setClientName(e.target.value)} 
                        readOnly={isSessionClosed}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase ml-1">Date de la vente</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="outline" 
                          disabled={!isAdminOrPrepa || isSessionClosed}
                          className="w-full h-12 rounded-xl bg-slate-50 border-none justify-start font-bold shadow-inner text-slate-700 disabled:opacity-80"
                        >
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase ml-1">Mutuelle</Label>
                    <Select value={mutuelle} onValueChange={setMutuelle} disabled={isSessionClosed}>
                      <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {MUTUELLES.map(m => <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {mutuelle === "Autre" && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-left-2">
                      <Label className="text-[10px] font-black uppercase ml-1">Libellé Mutuelle</Label>
                      <Input 
                        className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold" 
                        placeholder="Précisez la mutuelle..." 
                        value={customMutuelle} 
                        onChange={e => setCustomMutuelle(e.target.value)} 
                        readOnly={isSessionClosed}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[32px] bg-white border-none shadow-sm overflow-hidden">
              <CardHeader className="py-4 px-8 bg-slate-50 border-b flex flex-row items-center gap-2">
                <FileText className="h-4 w-4 text-primary/40" />
                <CardTitle className="text-[10px] uppercase font-black text-primary/60">Prescription Optique</CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <PrescriptionForm od={prescription.od} og={prescription.og} onChange={(s, f, v) => !isSessionClosed && setPrescription(prev => ({...prev, [s.toLowerCase()]: {...(prev as any)[s.toLowerCase()], [f]: v}}))} />
              </CardContent>
            </Card>

            <Card className="rounded-[32px] bg-white border-none shadow-sm overflow-hidden">
              <CardHeader className="py-4 px-8 bg-slate-50 border-b flex flex-row items-center gap-2">
                <Glasses className="h-4 w-4 text-primary/40" />
                <CardTitle className="text-[10px] uppercase font-black text-primary/60">Équipement & Notes</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Monture</Label><Input className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold" placeholder="Marque, Modèle..." value={monture} onChange={e => setMonture(e.target.value)} readOnly={isSessionClosed} /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Verres</Label><Input className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold" placeholder="Type, Traitement..." value={verres} onChange={e => setVerres(e.target.value)} readOnly={isSessionClosed} /></div>
                </div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Commentaires / Observations</Label><Textarea className="min-h-[100px] rounded-2xl bg-slate-50 border-none shadow-inner font-medium" placeholder="Informations complémentaires..." value={notes} onChange={e => setNotes(e.target.value)} readOnly={isSessionClosed} /></div>
              </CardContent>
            </Card>
          </div>

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
                    onChange={e => !isSessionClosed && setTotal(e.target.value)} 
                    readOnly={isSessionClosed}
                  />
                </div>
                
                <div className="bg-white/10 p-4 rounded-2xl flex flex-col gap-3 group transition-all">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] font-black uppercase text-white/80">Remise</Label>
                    <div className="flex bg-slate-950/20 p-1 rounded-lg">
                      <button 
                        onClick={() => !isSessionClosed && setDiscountType('fixed')} 
                        disabled={isSessionClosed}
                        className={cn("px-3 py-1 rounded-md text-[10px] font-black transition-all", discountType === 'fixed' ? "bg-white text-primary shadow-sm" : "text-white/40 hover:text-white")}
                      >
                        DH
                      </button>
                      <button 
                        onClick={() => !isSessionClosed && setDiscountType('percent')} 
                        disabled={isSessionClosed}
                        className={cn("px-3 py-1 rounded-md text-[10px] font-black transition-all", discountType === 'percent' ? "bg-white text-primary shadow-sm" : "text-white/40 hover:text-white")}
                      >
                        %
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-white/40 uppercase">Valeur :</span>
                    <div className="relative">
                      <input 
                        type="number" 
                        className="bg-transparent text-right font-black text-white outline-none text-xl w-28 tabular-nums" 
                        placeholder="---" 
                        value={discountValue === "0" || discountValue === "" ? "" : discountValue} 
                        onChange={e => !isSessionClosed && setDiscountValue(e.target.value)} 
                        readOnly={isSessionClosed}
                      />
                      {discountType === 'percent' && <Percent className="absolute -right-5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/40" />}
                    </div>
                  </div>
                  {discountType === 'percent' && calculatedRemise > 0 && (
                    <div className="text-right">
                      <span className="text-[9px] font-black text-accent uppercase">- {formatCurrency(calculatedRemise)}</span>
                    </div>
                  )}
                </div>

                <div className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-inner group transition-all focus-within:ring-2 focus-within:ring-accent">
                  <Label className="text-[10px] font-black text-primary uppercase">Versé ce jour (DH)</Label>
                  <input 
                    type="number" 
                    className="bg-transparent text-right font-black text-slate-950 outline-none text-xl w-28 tabular-nums" 
                    placeholder="---" 
                    value={avance === "0" || avance === "" ? "" : avance} 
                    onChange={e => !isSessionClosed && setAvance(e.target.value)} 
                    readOnly={isSessionClosed}
                  />
                </div>

                <div className="bg-slate-950/40 p-6 rounded-3xl text-center space-y-1 border border-white/5 shadow-2xl">
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-widest">Net à payer</p>
                  <p className="text-3xl font-black text-white tabular-nums tracking-tighter">{formatCurrency(totalNetValue)}</p>
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
