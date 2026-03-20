
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
import { ShoppingBag, Save, Loader2, User, Phone, ShieldCheck, FileText, Glasses, Printer, Percent, Lock, ClipboardList, Stethoscope, HandCoins, Users, AlertTriangle, Calendar as CalendarIcon, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, cn, roundAmount, formatPhoneNumber, parseAmount, sendWhatsApp } from "@/lib/utils";
import { AppShell } from "@/components/layout/app-shell";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import { collection, doc, serverTimestamp, runTransaction, Timestamp, query, where, limit, getDocs } from "firebase/firestore";
import { format, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import { MUTUELLES } from "@/lib/constants";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

function NewSaleForm() {
  const { toast } = useToast();
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const db = useFirestore();
  
  const [role, setRole] = useState<string | null>(null);
  const [isPrepaMode, setIsPrepaMode] = useState(false);
  const [isClientReady, setIsHydrated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeEditId] = useState<string | null>(searchParams.get("editId"));

  const [isNameFocused, setIsNameFocused] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  useEffect(() => {
    const savedRole = typeof window !== 'undefined' ? localStorage.getItem('user_role')?.toUpperCase() : null;
    const savedMode = typeof window !== 'undefined' ? localStorage.getItem('work_mode') : null;
    
    if (savedRole) {
      setRole(savedRole);
      setIsPrepaMode(savedRole === 'PREPA' || (savedRole === 'ADMIN' && savedMode === 'DRAFT'));
      setIsHydrated(true);
    } else {
      router.push('/login');
    }
  }, [router]);

  const isAdminOrPrepa = role === "ADMIN" || role === "PREPA";

  const [saleDate, setSaleDate] = useState<Date>(() => {
    const d = searchParams.get("date_raw");
    if (d) {
      const parsed = new Date(d);
      if (isValid(parsed)) return parsed;
    }
    return new Date();
  });
  
  const [clientName, setClientName] = useState(searchParams.get("client") || "");
  const [clientPhone, setClientPhone] = useState(searchParams.get("phone") || "");
  const [bonNumber, setBonNumber] = useState(searchParams.get("bonNumber") || "");
  const [bonError, setBonError] = useState(false);
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

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: settings } = useDoc(settingsRef);

  const existingSaleRef = useMemoFirebase(() => activeEditId ? doc(db, "sales", activeEditId) : null, [db, activeEditId]);
  const { data: existingSale, isLoading: saleDataLoading } = useDoc(existingSaleRef);

  useEffect(() => {
    if (existingSale) {
      setClientName(existingSale.clientName || "");
      setClientPhone(existingSale.clientPhone || "");
      setBonNumber(existingSale.bonNumber || "");
      setFromDoctor(!!existingSale.fromDoctor);
      setEditableInvoiceId(existingSale.invoiceId || "");
      setMonture(existingSale.monture || "");
      setVerres(existingSale.verres || "");
      setNotes(existingSale.notes || "");
      setTotal(formatCurrency(existingSale.total || 0));
      setDiscountType(existingSale.discountType || 'fixed');
      setDiscountValue(existingSale.discountType === 'percent' ? (existingSale.discountValue || 0).toString() : formatCurrency(existingSale.discountValue || 0));
      setAvance(formatCurrency(existingSale.avance || 0));
      
      if (existingSale.prescription) {
        setPrescription({
          od: {
            sph: existingSale.prescription.od?.sph || "",
            cyl: existingSale.prescription.od?.cyl || "",
            axe: existingSale.prescription.od?.axe || "",
            add: existingSale.prescription.od?.add || ""
          },
          og: {
            sph: existingSale.prescription.og?.sph || "",
            cyl: existingSale.prescription.og?.cyl || "",
            axe: existingSale.prescription.og?.axe || "",
            add: existingSale.prescription.og?.add || ""
          }
        });
      }

      if (existingSale.mutuelle) {
        if (MUTUELLES.filter(m => m !== 'Autre').includes(existingSale.mutuelle)) {
          setMutuelle(existingSale.mutuelle);
          setCustomMutuelle("");
        } else {
          setMutuelle("Autre");
          setCustomMutuelle(existingSale.mutuelle);
        }
      }

      if (existingSale.createdAt?.toDate) {
        setSaleDate(existingSale.createdAt.toDate());
      }
    }
  }, [existingSale]);

  const sessionDocId = useMemo(() => {
    if (!isClientReady || !isValid(saleDate)) return null;
    const ds = format(saleDate, "yyyy-MM-dd");
    return isPrepaMode ? `DRAFT-${ds}` : ds;
  }, [isClientReady, saleDate, isPrepaMode]);

  const sessionRef = useMemoFirebase(() => sessionDocId ? doc(db, "cash_sessions", sessionDocId) : null, [db, sessionDocId]);
  const { data: sessionData, isLoading: sessionLoading } = useDoc(sessionRef);
  const isSessionClosed = !sessionLoading && sessionData?.status === "CLOSED";
  const isReadOnly = isSessionClosed && !isAdminOrPrepa;

  const clientsQuery = useMemoFirebase(() => {
    const cleanedPhone = (clientPhone || "").replace(/\s/g, "");
    const nameSearch = (clientName || "").trim().toUpperCase();
    const currentIsDraft = isPrepaMode;

    if (cleanedPhone.length >= 8) {
      return query(
        collection(db, "clients"), 
        where("isDraft", "==", currentIsDraft),
        where("phone", "==", cleanedPhone),
        limit(10)
      );
    }

    if (nameSearch.length >= 3) {
      return query(
        collection(db, "clients"),
        where("isDraft", "==", currentIsDraft),
        where("name", ">=", nameSearch),
        where("name", "<=", nameSearch + "\uf8ff"),
        limit(10)
      );
    }

    return null;
  }, [db, clientPhone, clientName, isPrepaMode]);

  const { data: matchedClients } = useCollection(clientsQuery);

  const handleSelectMember = (client: any) => {
    if (!client) return;
    setClientName(client.name || "");
    setClientPhone(client.phone || clientPhone);
    setSelectedClientId(client.id || null);
    
    setIsFamilyMode(!!client.parentPhone);

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
    if (activeEditId || !isClientReady || !matchedClients) return;

    const cleanedPhone = (clientPhone || "").replace(/\s/g, "");
    if (cleanedPhone.length >= 8 && matchedClients.length > 0 && !isFamilyMode) {
      if (matchedClients.length === 1 && !clientName) {
        const found = matchedClients[0];
        setClientName(found.name || "");
        setSelectedClientId(found.id);
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
    }
  }, [matchedClients, activeEditId, isClientReady, clientName, clientPhone, isFamilyMode]);

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
      setMutuelle("Aucun"); 
      setCustomMutuelle(""); 
      setIsFamilyMode(false);
      setSelectedClientId(null);
      return; 
    }
    if (raw.length > 10) return;
    if (raw.length >= 1 && raw[0] !== '0') return;
    if (raw.length >= 2 && !['6', '7', '8'].includes(raw[1])) return;
    setClientPhone(raw);
  };

  const handleToggleFamilyMode = (checked: boolean) => {
    setIsFamilyMode(checked);
    if (checked) {
      setSelectedClientId(null);
      setClientName(""); 
      toast({ 
        title: "Mode Parrainage Activé", 
        description: "Saisissez le nom du nouveau membre pour ce numéro." 
      });
    }
  };

  const handleSave = async (shouldPrint: boolean = false) => {
    if (sessionLoading || saleDataLoading) return;
    
    if (isSessionClosed && !isAdminOrPrepa) {
      toast({ 
        variant: "destructive", 
        title: "ACTION BLOQUÉE", 
        description: "La caisse de cette journée est déjà clôturée." 
      });
      return;
    }

    if (!clientName) { toast({ variant: "destructive", title: "Erreur", description: "Nom client obligatoire." }); return; }
    if (!bonNumber && !activeEditId) { toast({ variant: "destructive", title: "Erreur", description: "N° BON obligatoire." }); return; }
    
    setLoading(true);
    const currentIsDraft = isPrepaMode;
    
    try {
      // VÉRIFICATION DOUBLON BON (Requête simplifiée sans index composite)
      const bonCheckQuery = query(
        collection(db, "sales"),
        where("bonNumber", "==", bonNumber.trim())
      );
      const bonCheckSnap = await getDocs(bonCheckQuery);
      
      // Filtrage isDraft en mémoire pour éviter le besoin d'index composite
      // IMPORTANT : On ignore le document en cours de modification
      const isDuplicate = bonCheckSnap.docs.some(d => {
        if (activeEditId && d.id === activeEditId) return false;
        const data = d.data();
        return data.isDraft === currentIsDraft;
      });

      if (isDuplicate) {
        setBonError(true);
        toast({ 
          variant: "destructive", 
          title: "Erreur", 
          description: "Ce Numéro de Bon existe déjà !" 
        });
        setLoading(false);
        return;
      }
      setBonError(false);

      const currentUserName = user?.displayName || "Inconnu";
      const finalMutuelle = mutuelle === "Autre" ? (customMutuelle || "Autre") : (mutuelle || "Aucun");
      const cleanedPhone = (clientPhone || "").replace(/\s/g, "");
      const cleanedParentPhone = isFamilyMode ? cleanedPhone : "";
      let finalInvoiceIdForURL = "";

      // RECHERCHE CLIENT EXISTANT (Simplifiée)
      let finalClientId = selectedClientId;
      if (!finalClientId && !activeEditId) {
        const qC = query(
          collection(db, "clients"),
          where("name", "==", clientName.trim().toUpperCase())
        );
        const snapC = await getDocs(qC);
        const foundClient = snapC.docs.find(d => {
          const data = d.data();
          return data.isDraft === currentIsDraft && (data.phone === cleanedPhone || !cleanedPhone);
        });
        if (foundClient) finalClientId = foundClient.id;
      }

      await runTransaction(db, async (transaction) => {
        if (sessionRef && !isAdminOrPrepa) {
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

        const cleanPrescription = {
          od: {
            sph: prescription.od.sph || "",
            cyl: prescription.od.cyl || "",
            axe: prescription.od.axe || "",
            add: prescription.od.add || ""
          },
          og: {
            sph: prescription.og.sph || "",
            cyl: prescription.og.cyl || "",
            axe: prescription.og.axe || "",
            add: prescription.og.add || ""
          }
        };

        const saleData: any = {
          invoiceId: invoiceId || "---",
          bonNumber: bonNumber || "---",
          fromDoctor: !!fromDoctor,
          clientName: clientName.trim().toUpperCase() || "---",
          clientPhone: cleanedPhone || "",
          mutuelle: finalMutuelle,
          monture: monture || "",
          verres: verres || "",
          notes: notes || "",
          total: nTotal,
          remise: calculatedRemise,
          discountType: discountType,
          discountValue: nDiscountVal,
          avance: nAvance,
          reste: resteAPayerValue,
          statut: statut,
          prescription: cleanPrescription,
          isDraft: currentIsDraft,
          updatedAt: serverTimestamp(),
          createdAt: Timestamp.fromDate(saleDate)
        };

        if (!activeEditId) {
          saleData.createdBy = currentUserName;
          saleData.payments = nAvance > 0 ? [{ amount: nAvance, date: new Date().toISOString(), userName: currentUserName }] : [];
        }

        transaction.set(saleRef, saleData, { merge: true });
        finalInvoiceIdForURL = invoiceId;

        const clientRef = finalClientId ? doc(db, "clients", finalClientId) : doc(collection(db, "clients"));
        const clientData: any = { 
          name: clientName.trim().toUpperCase(), 
          phone: cleanedPhone, 
          parentPhone: cleanedParentPhone,
          mutuelle: finalMutuelle, 
          lastVisit: format(new Date(), "dd/MM/yyyy"), 
          isDraft: currentIsDraft, 
          updatedAt: serverTimestamp() 
        };
        if (!finalClientId) clientData.createdAt = serverTimestamp();
        
        transaction.set(clientRef, clientData, { merge: true });

        if (nAvance > 0 && !activeEditId) {
          transaction.set(doc(collection(db, "transactions")), { 
            type: "VENTE", 
            label: `VENTE ${invoiceId}`, 
            clientName: clientName.trim().toUpperCase(), 
            montant: nAvance, 
            relatedId: invoiceId, 
            saleId: saleRef.id, 
            userName: user?.displayName || "---", 
            isDraft: currentIsDraft, 
            createdAt: serverTimestamp() 
          });
        }
      });

      toast({ variant: "success", title: activeEditId ? "Modification Enregistrée" : "Vente Enregistrée" });

      if (cleanedPhone && !activeEditId) {
        setTimeout(async () => {
          const template = settings?.whatsappDarija;
          const finalMessage = (template || "").replace(/\[Nom\]/gi, clientName.trim().toUpperCase());
          await sendWhatsApp(cleanedPhone, finalMessage);
          toast({ variant: "success", title: "✅ Message copié !", description: "Collez le message (Ctrl+V) dans WhatsApp." });
        }, 500);
      }

      if (shouldPrint && finalInvoiceIdForURL) {
        const page = resteAPayerValue <= 0 ? 'facture' : 'recu';
        router.push(`/ventes/${page}/${finalInvoiceIdForURL}?client=${clientName}&phone=${cleanedPhone}&mutuelle=${finalMutuelle}&total=${nTotal}&remise=${calculatedRemise}&remisePercent=${discountType === 'percent' ? nDiscountVal : "Fixe"}&avance=${nAvance}&od_sph=${prescription.od.sph || "---"}&od_cyl=${prescription.od.cyl || "---"}&od_axe=${prescription.od.axe || "---"}&od_add=${prescription.od.add || "---"}&og_sph=${prescription.og.sph || "---"}&og_cyl=${prescription.og.cyl || "---"}&og_axe=${prescription.og.axe || "---"}&og_add=${prescription.og.add || "---"}&monture=${monture || "---"}&verres=${verres || "---"}&date=${format(saleDate, "dd-MM-yyyy")}`);
      } else { 
        router.push("/ventes"); 
      }
    } catch (err: any) { 
      console.error("Erreur handleSave:", err);
      if (err.message === "SESSION_CLOSED") {
        toast({ variant: "destructive", title: "Action Rejetée", description: "La caisse a été clôturée entre temps." });
      } else {
        toast({ variant: "destructive", title: "Erreur Technique", description: "Impossible d'enregistrer." });
      }
    } finally { 
      setLoading(false); 
    }
  };

  if (!isClientReady || (activeEditId && saleDataLoading)) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  const showMatchedClients = matchedClients && matchedClients.length > 0 && !isReadOnly && (
    isNameFocused || ((clientPhone || "").replace(/\s/g, "").length >= 8 && !selectedClientId)
  );

  return (
    <AppShell>
      <div className="space-y-4 max-w-6xl mx-auto pb-24">
        <div className="flex justify-between items-center bg-white p-6 rounded-[32px] border shadow-sm">
          <div className="flex items-center gap-4">
            <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", isPrepaMode ? "bg-orange-100 text-orange-600" : "bg-primary/10 text-primary")}><ShoppingBag className="h-6 w-6" /></div>
            <div>
              <h1 className="text-2xl font-black text-primary uppercase tracking-tighter">
                {activeEditId ? "Modifier Vente" : (isPrepaMode ? "Saisie Historique" : "Nouvelle Vente")}
              </h1>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => handleSave(true)} className="h-12 rounded-xl font-black text-[10px] px-8 border-primary/20 text-primary shadow-sm" disabled={loading || sessionLoading || isReadOnly}><Printer className="mr-2 h-4 w-4" /> IMPRIMER</Button>
            <Button onClick={() => handleSave(false)} className="h-12 rounded-xl font-black text-[10px] px-8 shadow-xl" disabled={loading || sessionLoading || isReadOnly}>{loading ? <Loader2 className="animate-spin" /> : <Save className="mr-2 h-4 w-4" /> } ENREGISTRER</Button>
          </div>
        </div>

        {isSessionClosed && (
          <div className={cn(
            "border-l-[12px] shadow-2xl p-8 rounded-[40px] flex items-center gap-8 relative overflow-hidden transition-all animate-in zoom-in-95",
            isAdminOrPrepa ? "bg-white border-l-orange-500" : "bg-red-50 border-l-destructive border-destructive/20"
          )}>
            <div className={cn("h-20 w-20 rounded-3xl flex items-center justify-center shrink-0 shadow-inner", isAdminOrPrepa ? "bg-orange-100" : "bg-red-100")}>
              {isAdminOrPrepa ? <AlertTriangle className="h-10 w-10 text-orange-600" /> : <XCircle className="h-10 w-10 text-destructive animate-pulse" />}
            </div>
            <div className="flex-1">
              <h3 className={cn("text-xs font-black uppercase tracking-[0.4em] mb-2", isAdminOrPrepa ? "text-orange-600" : "text-destructive")}>
                {isAdminOrPrepa ? "Attention : Session Clôturée" : "OPÉRATION IMPOSSIBLE - CAISSE CLÔTURÉE"}
              </h3>
              <p className="text-slate-900 font-black text-xl leading-tight tracking-tight uppercase">
                La caisse du <span className={isAdminOrPrepa ? "text-orange-600" : "text-destructive"}>{format(saleDate, "dd MMMM yyyy", { locale: fr })}</span> est clôturée. 
                {isAdminOrPrepa ? " Modification autorisée (Mode Admin)." : " Toute saisie ou validation est bloquée."}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className={cn("rounded-[32px] bg-white border-none shadow-sm overflow-hidden transition-all", isReadOnly && "grayscale brightness-90 opacity-80 pointer-events-none")}>
              <CardHeader className="py-6 px-8 bg-slate-50 border-b flex flex-row items-center gap-4">
                <User className="h-7 w-7 text-[#6a8036]" />
                <CardTitle className="text-xl uppercase font-black text-[#6a8036]">Dossier Client</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase ml-1">Téléphone</Label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-3.5 h-4 w-4 text-primary/30" />
                      <Input className={cn("h-12 pl-11 rounded-xl bg-slate-50 border-none shadow-inner font-bold", isReadOnly && "cursor-not-allowed")} placeholder="06 00 00 00 00" value={formatPhoneNumber(clientPhone)} onChange={e => handlePhoneChange(e.target.value)} readOnly={isReadOnly} />
                    </div>
                    <div className="flex items-center space-x-2 mt-2 px-1">
                      <Checkbox id="familyMode" checked={isFamilyMode} onCheckedChange={handleToggleFamilyMode} disabled={isReadOnly} />
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
                        className={cn("h-12 pl-11 rounded-xl bg-slate-50 border-none shadow-inner font-bold uppercase", isReadOnly && "cursor-not-allowed")} 
                        placeholder="M. Mohamed Alami..." 
                        value={clientName} 
                        onChange={e => {
                          setClientName(e.target.value);
                          if (selectedClientId) setSelectedClientId(null);
                        }} 
                        onFocus={() => !isReadOnly && setIsNameFocused(true)}
                        onClick={() => !isReadOnly && setIsNameFocused(true)}
                        onBlur={() => setTimeout(() => setIsNameFocused(false), 200)}
                        readOnly={isReadOnly} 
                      />
                      
                      {showMatchedClients && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-primary/10 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-top-2">
                          <p className="px-4 py-2 bg-slate-50 text-[8px] font-black text-primary/40 uppercase tracking-widest border-b">
                            {(clientPhone || "").replace(/\s/g, "").length >= 8 ? "Membres de la famille trouvés" : "Résultats de recherche"}
                          </p>
                          {matchedClients.map(c => (
                            <button key={c?.id} onClick={() => handleSelectMember(c)} className={cn("w-full text-left px-4 py-3 hover:bg-primary/5 transition-colors flex items-center justify-between group border-b last:border-0", c?.id === selectedClientId && "bg-primary/5")}>
                              <div className="flex flex-col">
                                <span className="text-xs font-black uppercase group-hover:text-primary">{c?.name || "---"}</span>
                                <div className="flex items-center gap-2">
                                  {c?.phone && <span className="text-[7px] font-bold text-slate-400 tabular-nums">{formatPhoneNumber(c.phone)}</span>}
                                  {c?.mutuelle && <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">• {c.mutuelle}</span>}
                                </div>
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
                      <Input 
                        className={cn(
                          "h-12 pl-11 rounded-xl bg-slate-50 border-none shadow-inner font-black text-primary", 
                          isReadOnly && "cursor-not-allowed",
                          bonError && "border-2 border-red-500 bg-red-50 ring-2 ring-red-500/20"
                        )} 
                        placeholder="Ex: 2472" 
                        value={bonNumber} 
                        onChange={e => {
                          setBonNumber(e.target.value);
                          if (bonError) setBonError(false);
                        }} 
                        readOnly={isReadOnly} 
                      />
                    </div>
                    <div className="flex items-center space-x-2 mt-2 px-1">
                      <Checkbox id="fromDoctor" checked={fromDoctor} onCheckedChange={(v) => setFromDoctor(!!v)} disabled={isReadOnly} />
                      <label htmlFor="fromDoctor" className="text-[10px] font-black uppercase cursor-pointer flex items-center gap-1.5 text-slate-500">
                        <Stethoscope className="h-3 w-3" /> MÉDECIN
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase ml-1">Mutuelle</Label>
                    <Select value={mutuelle} onValueChange={setMutuelle} disabled={isReadOnly}>
                      <SelectTrigger className={cn("h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold", isReadOnly && "opacity-50")}><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl">{MUTUELLES.map(m => <SelectItem key={m} value={m} className="font-bold">{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {mutuelle === "Autre" ? (
                    <div className="space-y-2 animate-in fade-in slide-in-from-left-2">
                      <Label className="text-[10px] font-black uppercase ml-1">Libellé Mutuelle</Label>
                      <Input className={cn("h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold", isReadOnly && "cursor-not-allowed")} placeholder="Précisez la mutuelle..." value={customMutuelle} onChange={e => setCustomMutuelle(e.target.value)} readOnly={isReadOnly} />
                    </div>
                  ) : <div />}
                </div>

                {isAdminOrPrepa && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-dashed pointer-events-auto">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase ml-1 text-primary">Date de la Vente (ADMIN)</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full h-12 rounded-xl bg-slate-50 border-none font-bold text-xs justify-start px-4" disabled={loading || sessionLoading}>
                            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                            {format(saleDate, "dd MMMM yyyy", { locale: fr }).toUpperCase()}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl">
                          <Calendar mode="single" selected={saleDate} onSelect={(d) => d && setSaleDate(d)} locale={fr} initialFocus />
                        </PopoverContent>
                      </Popover>
                    </div>
                    {activeEditId && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase ml-1 text-destructive">Correction N° Document (ADMIN)</Label>
                        <div className="relative">
                          <FileText className="absolute left-4 top-3.5 h-4 w-4 text-destructive/30" />
                          <Input className="h-12 pl-11 rounded-xl bg-red-50 border-2 border-red-100 font-black text-destructive" value={editableInvoiceId} onChange={e => setEditableInvoiceId(e.target.value.toUpperCase())} readOnly={loading || sessionLoading} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className={cn("rounded-[32px] bg-white border-none shadow-sm overflow-hidden transition-all", isReadOnly && "grayscale brightness-90 opacity-80 pointer-events-none")}>
              <CardHeader className="py-6 px-8 bg-slate-50 border-b flex flex-row items-center gap-4">
                <FileText className="h-7 w-7 text-[#6a8036]" />
                <CardTitle className="text-xl uppercase font-black text-[#6a8036]">Prescription Optique</CardTitle>
              </CardHeader>
              <CardContent className="p-8">
                <div>
                  <PrescriptionForm od={prescription.od} og={prescription.og} onChange={(s, f, v) => setPrescription(prev => ({...prev, [s.toLowerCase()]: {...(prev as any)[s.toLowerCase()], [f]: v}}))} />
                </div>
              </CardContent>
            </Card>

            <Card className={cn("rounded-[32px] bg-white border-none shadow-sm overflow-hidden transition-all", isReadOnly && "grayscale brightness-90 opacity-80 pointer-events-none")}>
              <CardHeader className="py-6 px-8 bg-slate-50 border-b flex flex-row items-center gap-4">
                <Glasses className="h-7 w-7 text-[#6a8036]" />
                <CardTitle className="text-xl uppercase font-black text-[#6a8036]">Équipement & Notes</CardTitle>
              </CardHeader>
              <CardContent className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Monture</Label><Input className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold" placeholder="Marque..." value={monture} onChange={e => setMonture(e.target.value)} readOnly={isReadOnly} /></div>
                  <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Verres</Label><Input className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-bold" placeholder="Type..." value={verres} onChange={e => setVerres(e.target.value)} readOnly={isReadOnly} /></div>
                </div>
                <div className="space-y-2"><Label className="text-[10px] font-black uppercase ml-1">Commentaires</Label><Textarea className="min-h-[100px] rounded-2xl bg-slate-50 border-none shadow-inner font-medium" placeholder="..." value={notes} onChange={e => setNotes(e.target.value)} readOnly={isReadOnly} /></div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className={cn("bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))] border border-[hsl(var(--sidebar-border))] rounded-[40px] shadow-2xl overflow-hidden sticky top-24 transition-all", isReadOnly && "grayscale brightness-75 pointer-events-none opacity-80")}>
              <CardHeader className="py-6 px-8 text-[hsl(var(--sidebar-fg))]/60 border-b border-[hsl(var(--sidebar-border))] flex flex-row items-center gap-2"><ShieldCheck className="h-4 w-4" /><CardTitle className="text-[10px] font-black uppercase tracking-widest">Calcul de la Facture</CardTitle></CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="bg-white p-4 rounded-[40px] flex justify-between items-center shadow-sm">
                  <Label className="text-[10px] font-black text-primary uppercase ml-4">Prix Brut (DH)</Label>
                  <input type="text" className="bg-transparent text-right font-black text-slate-500 outline-none text-2xl w-32 tabular-nums mr-4" placeholder="0,00" value={total} onChange={e => setTotal(e.target.value)} onBlur={() => total && setTotal(formatCurrency(parseAmount(total)))} readOnly={isReadOnly} />
                </div>
                
                <div className="bg-[hsl(var(--sidebar-fg))]/5 p-6 rounded-[40px] flex flex-col gap-4">
                  <div className="flex justify-between items-center px-2">
                    <Label className="text-[10px] font-black uppercase text-[hsl(var(--sidebar-fg))]/80">Remise</Label>
                    <div className="flex bg-[hsl(var(--sidebar-fg))]/10 p-1 rounded-full">
                      <button onClick={() => setDiscountType('fixed')} disabled={isReadOnly} className={cn("px-4 py-1.5 rounded-full text-[10px] font-black transition-all", discountType === 'fixed' ? "bg-white text-primary shadow-sm" : "text-[hsl(var(--sidebar-fg))]/40 hover:text-[hsl(var(--sidebar-fg))]")}>DH</button>
                      <button onClick={() => setDiscountType('percent')} disabled={isReadOnly} className={cn("px-4 py-1.5 rounded-full text-[10px] font-black transition-all", discountType === 'percent' ? "bg-white text-primary shadow-sm" : "text-[hsl(var(--sidebar-fg))]/40 hover:text-[hsl(var(--sidebar-fg))]")}>%</button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center px-2">
                    <span className="text-[9px] font-black text-[hsl(var(--sidebar-fg))]/40 uppercase mb-1">Valeur :</span>
                    <div className="relative">
                      <input type="text" className="bg-transparent text-right font-black text-[hsl(var(--sidebar-fg))] outline-none text-2xl w-32 tabular-nums" placeholder="0,00" value={discountValue} onChange={e => setDiscountValue(e.target.value)} onBlur={() => discountValue && setDiscountValue(discountType === 'percent' ? discountValue : formatCurrency(parseAmount(discountValue)))} readOnly={isReadOnly} />
                      {discountType === 'percent' && <Percent className="absolute -right-5 top-1/2 -translate-y-1/2 h-3 w-3 text-[hsl(var(--sidebar-fg))]/40" />}
                    </div>
                  </div>
                  {discountType === 'percent' && calculatedRemise > 0 && (
                    <div className="text-right px-2"><span className="text-[9px] font-black text-accent uppercase">- {formatCurrency(calculatedRemise)}</span></div>
                  )}
                </div>

                <div className="bg-white p-4 rounded-[40px] flex justify-between items-center shadow-sm">
                  <Label className="text-[10px] font-black text-primary uppercase ml-4">Versé ce jour (DH)</Label>
                  <input type="text" className="bg-transparent text-right font-black text-slate-500 outline-none text-2xl w-32 tabular-nums mr-4" placeholder="0,00" value={avance} onChange={e => setAvance(e.target.value)} onBlur={() => avance && setAvance(formatCurrency(parseAmount(avance)))} readOnly={isReadOnly} />
                </div>

                <div className="pt-4">
                  <div className={cn("p-6 rounded-[40px] text-center space-y-1 border shadow-2xl transition-all", resteAPayerValue <= 0 ? "bg-emerald-500/20 border-emerald-500/20" : "bg-orange-500/20 border-orange-500/20")}>
                    <p className="text-[9px] font-black text-[hsl(var(--sidebar-fg))]/60 uppercase tracking-widest flex items-center justify-center gap-2"><HandCoins className="h-3 w-3" /> Reste à régler</p>
                    <p className={cn("text-4xl font-black tabular-nums tracking-tighter", resteAPayerValue <= 0 ? "text-emerald-500" : "text-orange-500")}>{formatCurrency(resteAPayerValue)}</p>
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
