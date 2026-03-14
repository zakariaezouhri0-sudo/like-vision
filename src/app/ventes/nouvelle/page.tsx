
"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { PrescriptionForm } from "@/components/optical/prescription-form";
import { ShoppingBag, Save, Loader2, User, Phone, ShieldCheck, FileText, Glasses, Printer, Percent, Lock, ClipboardList, Stethoscope, HandCoins, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn, roundAmount, formatPhoneNumber, parseAmount } from "@/lib/utils";
import { AppShell } from "@/components/layout/app-shell";
import { useFirestore, useUser, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc, serverTimestamp, runTransaction, Timestamp, query, where, getDoc } from "firebase/firestore";
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
  const [isClientReady, setIsHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeEditId] = useState<string | null>(searchParams.get("editId"));

  const [isNameFocused, setIsNameFocused] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role');
    if (savedRole) {
      setRole(savedRole.toUpperCase());
      setIsClientReady(true);
    } else {
      router.push('/login');
    }
  }, [router]);

  const isPrepaMode = role === "PREPA";
  const isAdminOrPrepa = role === "ADMIN" || role === "PREPA";

  const [saleDate] = useState<Date>(() => {
    const d = searchParams.get("date_raw");
    return d ? new Date(d) : new Date();
  });
  
  const [clientName, setClientName] = useState(searchParams.get("client") || "");
  const [clientPhone, setClientPhone] = useState(searchParams.get("phone") || "");
  const [bonNumber, setBonNumber] = useState(searchParams.get("bonNumber") || "");
  const [fromDoctor, setFromDoctor] = useState(searchParams.get("fromDoctor") === "true");
  const [editableInvoiceId, setEditableInvoiceId] = useState(searchParams.get("invoiceId") || "");

  const [isFamilyMode, setIsFamilyMode] = useState(false);

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
  const [total, setTotal] = useState<string>(searchParams.get("total") ? formatCurrency(searchParams.get("total")!) : "");
  
  const [discountType, setDiscountType] = useState<'fixed' | 'percent'>(
    (searchParams.get("discountType") as 'fixed' | 'percent') || 'fixed'
  );
  const [discountValue, setDiscountValue] = useState<string>(searchParams.get("discountValue") ? formatCurrency(searchParams.get("discountValue")!) : "");
  const [avance, setAvance] = useState<string>(searchParams.get("avance") ? formatCurrency(searchParams.get("avance")!) : "");

  const [prescription, setPrescription] = useState({
    od: { sph: searchParams.get("od_sph") || "", cyl: searchParams.get("od_cyl") || "", axe: searchParams.get("od_axe") || "", add: searchParams.get("od_add") || "" },
    og: { sph: searchParams.get("og_sph") || "", cyl: searchParams.get("og_cyl") || "", axe: searchParams.get("og_axe") || "", add: searchParams.get("og_add") || "" }
  });

  const sessionDocId = useMemo(() => {
    if (!isClientReady) return null;
    const ds = format(saleDate, "yyyy-MM-dd");
    return isPrepaMode ? `DRAFT-${ds}` : ds;
  }, [isClientReady, saleDate, isPrepaMode]);

  const sessionRef = useMemoFirebase(() => sessionDocId ? doc(db, "cash_sessions", sessionDocId) : null, [db, sessionDocId]);
  const { data: sessionData, isLoading: sessionLoading } = useDoc(sessionRef);
  const isSessionClosed = !sessionLoading && sessionData?.status === "CLOSED";

  const clientsQuery = useMemoFirebase(() => collection(db, "clients"), [db]);
  const { data: allClients } = useCollection(clientsQuery);

  const matchedFamily = useMemo(() => {
    if (!allClients || !isClientReady || activeEditId) return [];
    const cleaned = clientPhone.replace(/\s/g, "");
    if (cleaned.length < 8) return [];

    return allClients.filter(c => {
      const matchMode = isPrepaMode ? c.isDraft === true : !c.isDraft;
      const cPhone = (c.phone || "").replace(/\s/g, "");
      const pPhone = (c.parentPhone || "").replace(/\s/g, "");
      return matchMode && (cPhone === cleaned || pPhone === cleaned);
    });
  }, [allClients, clientPhone, isPrepaMode, isClientReady, activeEditId]);

  const handleSelectMember = (client: any) => {
    setClientName(client.name);
    setClientPhone(client.phone || clientPhone);
    if (client.parentPhone || matchedFamily.length > 0) {
      setIsFamilyMode(true);
    }
    if (client.mutuelle) {
      if (MUTUELLES.filter(m => m !== 'Autre').includes(client.mutuelle)) {
        setMutuelle(client.mutuelle);
        setCustomMutuelle("");
      } else {
        setMutuelle("Autre");
        setCustomMutuelle(client.mutuelle);
      }
    }
    setIsNameFocused(false);
  };

  useEffect(() => {
    if (activeEditId || !allClients || !isClientReady) return;

    const findAndPopulate = () => {
      if (clientPhone.replace(/\s/g, "").length >= 8 && matchedFamily.length > 0) {
        setIsFamilyMode(true);
      }

      if (clientPhone && clientPhone.replace(/\s/g, "").length >= 8 && matchedFamily.length === 1 && !clientName) {
        const found = matchedFamily[0];
        setClientName(found.name);
        if (found.mutuelle) {
          if (MUTUELLES.filter(m => m !== 'Autre').includes(found.mutuelle)) {
            setMutuelle(found.mutuelle);
            setCustomMutuelle("");
          } else {
            setMutuelle("Autre");
            setCustomMutuelle(found.mutuelle);
          }
        }
      }
    };
    const timeout = setTimeout(findAndPopulate, 500);
    return () => clearTimeout(timeout);
  }, [clientPhone, allClients, isPrepaMode, activeEditId, isClientReady, matchedFamily.length]);

  const nTotal = useMemo(() => parseAmount(total), [total]);
  const nDiscountVal = useMemo(() => parseAmount(discountValue), [discountValue]);
  const nAvance = useMemo(() => parseAmount(avance), [avance]);
  const calculatedRemise = useMemo(() => discountType === 'percent' ? roundAmount((nTotal * nDiscountVal) / 100) : roundAmount(nDiscountVal), [nTotal, nDiscountVal, discountType]);
  const totalNetValue = useMemo(() => roundAmount(Math.max(0, nTotal - calculatedRemise)), [nTotal, calculatedRemise]);
  const resteAPayerValue = useMemo(() => roundAmount(Math.max(0, totalNetValue - nAvance)), [totalNetValue, nAvance]);

  const handlePhoneChange = (val: string) => {
    const raw = val.replace(/\D/g, '');
    if (raw === "") { 
      setClientPhone(""); 
      setClientName(""); 
      setMutuelle("Aucun"); 
      setCustomMutuelle(""); 
      setIsFamilyMode(false);
      return; 
    }
    if (raw.length > 10) return;
    if (raw.length >= 1 && raw[0] !== '0') return;
    if (raw.length >= 2 && !['6', '7', '8'].includes(raw[1])) return;
    setClientPhone(raw);
  };

  const handleSave = async (shouldPrint: boolean = false) => {
    if (sessionLoading) return;
    if (isSessionClosed) {
      toast({ variant: "destructive", title: "ERREUR CRITIQUE", description: "La caisse de cette journée est clôturée." });
      return;
    }
    if (!clientName) { toast({ variant: "destructive", title: "Erreur", description: "Nom client obligatoire." }); return; }
    if (!bonNumber && !activeEditId) { toast({ variant: "destructive", title: "Erreur", description: "N° BON obligatoire." }); return; }
    
    setLoading(true);
    const currentIsDraft = role === "PREPA";
    const currentUserName = user?.displayName || "Inconnu";
    const finalMutuelle = mutuelle === "Autre" ? customMutuelle : mutuelle;
    const cleanedPhone = clientPhone.replace(/\s/g, "");
    const cleanedParentPhone = isFamilyMode ? cleanedPhone : "";
    let finalInvoiceId = "";

    try {
      await runTransaction(db, async (transaction) => {
        if (sessionRef) {
          const sessionSnap = await transaction.get(sessionRef);
          if (sessionSnap.exists() && sessionSnap.data().status === "CLOSED") {
            throw new Error("SESSION_CLOSED");
          }
        }

        const saleRef = activeEditId ? doc(db, "sales", activeEditId) : doc(collection(db, "sales"));
        const isPaid = resteAPayerValue <= 0;
        const statut = isPaid ? "Payé" : (nAvance > 0 ? "Partiel" : "En attente");
        let invoiceId = editableInvoiceId || "";

        if (!activeEditId) {
          const prefix = isPaid ? "FC" : "RC";
          invoiceId = `${prefix}-2026-${bonNumber}`;
        } else if (isPaid && invoiceId.startsWith("RC-")) {
          invoiceId = invoiceId.replace("RC-", "FC-");
        }

        const saleData: any = {
          invoiceId, bonNumber, fromDoctor, clientName, clientPhone: cleanedPhone, mutuelle: finalMutuelle || "Aucun",
          monture, verres, notes, total: nTotal, remise: calculatedRemise, discountType, discountValue: nDiscountVal,
          avance: nAvance, reste: resteAPayerValue, statut, prescription, isDraft: currentIsDraft, updatedAt: serverTimestamp()
        };

        if (!activeEditId) {
          saleData.createdAt = Timestamp.fromDate(saleDate);
          saleData.createdBy = currentUserName;
          saleData.payments = nAvance > 0 ? [{ amount: nAvance, date: new Date().toISOString(), userName: currentUserName }] : [];
        }

        transaction.set(saleRef, saleData, { merge: true });
        finalInvoiceId = invoiceId;

        const existingClient = allClients?.find(c => (isPrepaMode ? c.isDraft === true : !c.isDraft) && (c.name?.toLowerCase().trim() === clientName.toLowerCase().trim()));
        if (existingClient) {
          transaction.update(doc(db, "clients", existingClient.id), { 
            phone: cleanedPhone, 
            parentPhone: cleanedParentPhone,
            mutuelle: finalMutuelle || "Aucun", 
            lastVisit: format(new Date(), "dd/MM/yyyy"), 
            ordersCount: (existingClient.ordersCount || 0) + 1, 
            updatedAt: serverTimestamp() 
          });
        } else {
          transaction.set(doc(collection(db, "clients")), { 
            name: clientName, 
            phone: cleanedPhone, 
            parentPhone: cleanedParentPhone,
            mutuelle: finalMutuelle || "Aucun", 
            lastVisit: format(new Date(), "dd/MM/yyyy"), 
            ordersCount: 1, 
            isDraft: currentIsDraft, 
            createdAt: serverTimestamp() 
          });
        }

        if (nAvance > 0 && !activeEditId) {
          transaction.set(doc(collection(db, "transactions")), { type: "VENTE", label: `VENTE ${invoiceId}`, clientName, montant: nAvance, relatedId: invoiceId, saleId: saleRef.id, userName: currentUserName, isDraft: currentIsDraft, createdAt: serverTimestamp() }, { merge: true });
        }
      });

      toast({ variant: "success", title: "Vente Enregistrée" });
      if (shouldPrint && finalInvoiceId) {
        const page = resteAPayerValue <= 0 ? 'facture' : 'recu';
        router.push(`/ventes/${page}/${finalInvoiceId}?client=${clientName}&phone=${cleanedPhone}&mutuelle=${finalMutuelle || "---"}&total=${nTotal}&remise=${calculatedRemise}&remisePercent=${discountType === 'percent' ? nDiscountVal : "Fixe"}&avance=${nAvance}&od_sph=${prescription.od.sph || "---"}&od_cyl=${prescription.od.cyl || "---"}&od_axe=${prescription.od.axe || "---"}&od_add=${prescription.od.add || "---"}&og_sph=${prescription.og.sph || "---"}&og_cyl=${prescription.og.cyl || "---"}&og_axe=${prescription.og.axe || "---"}&og_add=${prescription.og.add || "---"}&monture=${monture || "---"}&verres=${verres || "---"}&date=${format(saleDate, "dd-MM-yyyy")}`);
      } else { router.push("/ventes"); }
    } catch (err: any) { 
      if (err.message === "SESSION_CLOSED") {
        toast({ variant: "destructive", title: "Action Rejetée", description: "La caisse a été clôturée." });
      } else {
        toast({ variant: "destructive", title: "Erreur" });
      }
    } finally { setLoading(false); }
  };

  if (!isClientReady) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  return (
    <AppShell>
      <div className="space-y-4 max-w-6xl mx-auto pb-24">
        <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border shadow-sm">
          <div className="flex items-center gap-4">
            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", isPrepaMode ? "bg-orange-100 text-orange-600" : "bg-primary/10 text-primary")}><ShoppingBag className="h-6 w-6" /></div>
            <div><h1 className="text-2xl font-black text-primary uppercase tracking-tighter">{isPrepaMode ? "Saisie Historique" : "Nouvelle Vente"}</h1></div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => handleSave(true)} className="h-12 rounded-xl font-black text-[10px] px-8 border-primary/20 text-primary shadow-sm" disabled={loading || sessionLoading || isSessionClosed}><Printer className="mr-2 h-4 w-4" /> IMPRIMER</Button>
            <Button onClick={() => handleSave(false)} className="h-12 rounded-xl font-black text-[10px] px-8 shadow-xl" disabled={loading || sessionLoading || isSessionClosed}>{loading ? <Loader2 className="animate-spin" /> : <Save className="mr-2 h-4 w-4" />} ENREGISTRER</Button>
          </div>
        </div>

        {isSessionClosed && (
          <div className="bg-white border-l-[12px] border-l-destructive shadow-2xl p-6 rounded-[32px] flex items-center gap-6 relative overflow-hidden">
            <div className="h-16 w-16 bg-red-100 rounded-2xl flex items-center justify-center shrink-0 shadow-inner"><Lock className="h-8 w-8 text-destructive animate-pulse" /></div>
            <div className="flex-1"><h3 className="text-[10px] font-black text-destructive uppercase tracking-[0.3em] mb-1">Accès Verrouillé</h3><p className="text-slate-700 font-bold text-lg leading-tight tracking-tight">La caisse du <span className="text-destructive font-black">{format(saleDate, "dd MMMM yyyy", { locale: fr }).toUpperCase()}</span> est clôturée.</p></div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-[32px] bg-white border-none shadow-sm overflow-hidden">
              <CardHeader className="py-4 px-8 bg-slate-50 border-b flex flex-row items-center gap-2"><User className="h-4 w-4 text-primary/40" /><CardTitle className="text-[10px] uppercase font-black text-primary/60">Dossier Client</CardTitle></CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase ml-1">Téléphone</Label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-3.5 h-4 w-4 text-primary/30" />
                      <Input className={cn("h-12 pl-11 rounded-xl bg-slate-50 border-none shadow-inner font-bold", isSessionClosed && "opacity-50")} placeholder="06 00 00 00 00" value={formatPhoneNumber(clientPhone)} onChange={e => handlePhoneChange(e.target.value)} readOnly={isSessionClosed} />
                    </div>
                    <div className="flex items-center space-x-2 mt-2 px-1">
                      <Checkbox id="familyMode" checked={isFamilyMode} onCheckedChange={(v) => setIsFamilyMode(!!v)} disabled={isSessionClosed} />
                      <label htmlFor="familyMode" className="text-[10px] font-black uppercase cursor-pointer flex items-center gap-1.5 text-orange-600">
                        <Users className="h-3 w-3" /> PARRAINAGE / FAMILLE
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase ml-1">Nom Complet</Label>
                    <div className="relative">
                      <User className="absolute left-4 top-3.5 h-4 w-4 text-primary/30" />
                      <Input 
                        className={cn("h-12 pl-11 rounded-xl bg-slate-50 border-none shadow-inner font-bold", isSessionClosed && "opacity-50")} 
                        placeholder="M. Mohamed Alami..." 
                        value={clientName} 
                        onChange={e => setClientName(e.target.value)} 
                        onFocus={() => setIsNameFocused(true)}
                        onClick={() => setIsNameFocused(true)}
                        onBlur={() => setTimeout(() => setIsNameFocused(false), 200)}
                        readOnly={isSessionClosed || (!isFamilyMode && matchedFamily.length > 0 && clientName !== "")} 
                      />
                      
                      {matchedFamily.length > 0 && !isSessionClosed && isNameFocused && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-primary/10 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2">
                          <p className="px-4 py-2 bg-slate-50 text-[8px] font-black text-primary/40 uppercase tracking-widest border-b">
                            {matchedFamily.length === 1 && matchedFamily[0].name === clientName ? "Dossier Identifié" : `Membres de la famille (${matchedFamily.length})`}
                          </p>
                          {matchedFamily.map(c => (
                            <button key={c.id} onClick={() => handleSelectMember(c)} className={cn("w-full text-left px-4 py-3 hover:bg-primary/5 transition-colors flex items-center justify-between group border-b last:border-0", c.name === clientName && "bg-primary/5")}>
                              <div className="flex flex-col">
                                <span className="text-xs font-black uppercase group-hover:text-primary">{c.name}</span>
                                {c.mutuelle && <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">{c.mutuelle}</span>}
                              </div>
                              <span className="text-[8px] font-bold text-slate-400">Choisir</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase ml-1">N° BON</Label>
                    <div className="relative">
                      <ClipboardList className="absolute left-4 top-3.5 h-4 w-4 text-primary/30" />
                      <Input className={cn("h-12 pl-11 rounded-xl bg-slate-50 border-none shadow-inner font-black text-primary", isSessionClosed && "opacity-50")} placeholder="Ex: 2472" value={bonNumber} onChange={e => setBonNumber(e.target.value)} readOnly={isSessionClosed} />
                    </div>
                    <div className="flex items-center space-x-2 mt-2 px-1">
                      <Checkbox id="fromDoctor" checked={fromDoctor} onCheckedChange={(v) => setFromDoctor(!!v)} disabled={isSessionClosed} />
                      <label htmlFor="fromDoctor" className="text-[10px] font-black uppercase cursor-pointer flex items-center gap-1.5 text-slate-500">
                        <Stethoscope className="h-3 w-3" /> MÉDECIN
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase ml-1">Mutuelle</Label>
                    <Select value={mutuelle} onValueChange={setMutuelle} disabled={isSessionClosed}>
                      <SelectTrigger className={cn("h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold", isSessionClosed && "opacity-50")}><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">{MUTUELLES.map(m => <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {mutuelle === "Autre" && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-left-2">
                      <Label className="text-[10px] font-black uppercase ml-1">Libellé Mutuelle</Label>
                      <Input className={cn("h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold", isSessionClosed && "opacity-50")} placeholder="Précisez la mutuelle..." value={customMutuelle} onChange={e => setCustomMutuelle(e.target.value)} readOnly={isSessionClosed} />
                    </div>
                  )}
                  {isAdminOrPrepa && activeEditId && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                      <Label className="text-[10px] font-black uppercase ml-1 text-destructive">Correction N° Document (ADMIN)</Label>
                      <div className="relative">
                        <FileText className="absolute left-4 top-3.5 h-4 w-4 text-destructive/30" />
                        <Input className="h-12 pl-11 rounded-xl bg-red-50 border-2 border-red-100 font-black text-destructive" value={editableInvoiceId} onChange={e => setEditableInvoiceId(e.target.value.toUpperCase())} readOnly={isSessionClosed} />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card className={cn("rounded-[32px] bg-white border-none shadow-sm overflow-hidden", isSessionClosed && "opacity-80")}>
              <CardHeader className="py-4 px-8 bg-slate-50 border-b flex flex-row items-center gap-2"><FileText className="h-4 w-4 text-primary/40" /><CardTitle className="text-[10px] uppercase font-black text-primary/60">Prescription Optique</CardTitle></CardHeader>
              <CardContent className="p-8">
                <div className={cn(isSessionClosed && "pointer-events-none")}>
                  <PrescriptionForm od={prescription.od} og={prescription.og} onChange={(s, f, v) => setPrescription(prev => ({...prev, [s.toLowerCase()]: {...(prev as any)[s.toLowerCase()], [f]: v}}))} />
                </div>
              </CardContent>
            </Card>

            <Card className={cn("rounded-[32px] bg-white border-none shadow-sm overflow-hidden", isSessionClosed && "opacity-80")}>
              <CardHeader className="py-4 px-8 bg-slate-50 border-b flex flex-row items-center gap-2"><Glasses className="h-4 w-4 text-primary/40" /><CardTitle className="text-[10px] uppercase font-black text-primary/60">Équipement & Notes</CardTitle></CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Monture</Label><Input className={cn("h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold", isSessionClosed && "opacity-50")} placeholder="Marque..." value={monture} onChange={e => setMonture(e.target.value)} readOnly={isSessionClosed} /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Verres</Label><Input className={cn("h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold", isSessionClosed && "opacity-50")} placeholder="Type..." value={verres} onChange={e => setVerres(e.target.value)} readOnly={isSessionClosed} /></div>
                </div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Commentaires</Label><Textarea className={cn("min-h-[100px] rounded-2xl bg-slate-50 border-none shadow-inner font-medium", isSessionClosed && "opacity-50")} placeholder="..." value={notes} onChange={e => setNotes(e.target.value)} readOnly={isSessionClosed} /></div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className={cn("bg-primary text-white rounded-[40px] shadow-2xl overflow-hidden sticky top-24 transition-all", isSessionClosed && "grayscale brightness-75")}>
              <CardHeader className="py-6 px-8 text-white/60 border-b border-white/5 flex flex-row items-center gap-2"><ShieldCheck className="h-4 w-4" /><CardTitle className="text-[10px] font-black uppercase tracking-widest">Calcul de la Facture</CardTitle></CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-inner group transition-all focus-within:ring-2 focus-within:ring-accent">
                  <Label className="text-[10px] font-black text-primary uppercase">Prix Brut (DH)</Label>
                  <input type="text" className="bg-transparent text-right font-black text-slate-950 outline-none text-xl w-28 tabular-nums" placeholder="0,00" value={total} onChange={e => setTotal(e.target.value)} onBlur={() => total && setTotal(formatCurrency(parseAmount(total)))} readOnly={isSessionClosed} />
                </div>
                
                <div className="bg-white/10 p-4 rounded-2xl flex flex-col gap-3 group transition-all">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] font-black uppercase text-white/80">Remise</Label>
                    <div className="flex bg-slate-950/20 p-1 rounded-lg">
                      <button onClick={() => setDiscountType('fixed')} disabled={isSessionClosed} className={cn("px-3 py-1 rounded-md text-[10px] font-black transition-all", discountType === 'fixed' ? "bg-white text-primary shadow-sm" : "text-white/40 hover:text-white")}>DH</button>
                      <button onClick={() => setDiscountType('percent')} disabled={isSessionClosed} className={cn("px-3 py-1 rounded-md text-[10px] font-black transition-all", discountType === 'percent' ? "bg-white text-primary shadow-sm" : "text-white/40 hover:text-white")}>%</button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-white/40 uppercase">Valeur :</span>
                    <div className="relative">
                      <input type="text" className="bg-transparent text-right font-black text-white outline-none text-xl w-28 tabular-nums" placeholder="0,00" value={discountValue} onChange={e => setDiscountValue(e.target.value)} onBlur={() => discountValue && setDiscountValue(discountType === 'percent' ? discountValue : formatCurrency(parseAmount(discountValue)))} readOnly={isSessionClosed} />
                      {discountType === 'percent' && <Percent className="absolute -right-5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/40" />}
                    </div>
                  </div>
                  {discountType === 'percent' && calculatedRemise > 0 && (
                    <div className="text-right"><span className="text-[9px] font-black text-accent uppercase">- {formatCurrency(calculatedRemise)}</span></div>
                  )}
                </div>

                <div className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-inner group transition-all focus-within:ring-2 focus-within:ring-accent">
                  <Label className="text-[10px] font-black text-primary uppercase">Versé ce jour (DH)</Label>
                  <input type="text" className="bg-transparent text-right font-black text-slate-950 outline-none text-xl w-28 tabular-nums" placeholder="0,00" value={avance} onChange={e => setAvance(e.target.value)} onBlur={() => avance && setAvance(formatCurrency(parseAmount(avance)))} readOnly={isSessionClosed} />
                </div>

                <div className="space-y-3">
                  <div className={cn("p-5 rounded-3xl text-center space-y-1 border shadow-2xl transition-all", resteAPayerValue <= 0 ? "bg-emerald-500/20 border-emerald-500/20" : "bg-orange-500/20 border-orange-500/20")}>
                    <p className="text-[9px] font-black text-white/60 uppercase tracking-widest flex items-center justify-center gap-2"><HandCoins className="h-3 w-3" /> Reste à régler</p>
                    <p className="text-3xl font-black text-white tabular-nums tracking-tighter">{formatCurrency(resteAPayerValue)}</p>
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

export default function NewSalePage() { return <Suspense fallback={null}><NewSaleForm /></Suspense>; }
