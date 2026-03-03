
"use client";

import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Loader2, Download, Calendar as CalendarIcon, CheckCircle2, AlertTriangle, Layers, Target, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { collection, doc, setDoc, getDoc, Timestamp, query, where, getDocs, addDoc, orderBy, limit } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { setHours, format, addDays, parse, isValid, isSameDay, isBefore, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { roundAmount, cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

type Mapping = Record<string, string>;

const GLOBAL_FIELDS = [
  { key: "date_col", label: "DATE", section: "GÉNÉRAL" },
  { key: "ref_vente", label: "REF (Vente)", section: "VENTES" },
  { key: "client_1", label: "Nom Client 1", section: "VENTES" },
  { key: "total_brut", label: "Total Brut", section: "VENTES" },
  { key: "avance_paye", label: "Avance Paye", section: "VENTES" },
  { key: "avance_ante", label: "Avance Ante", section: "VERSEMENTS" },
  { key: "achat_verre_det", label: "ACHAT VERRE (DEtail)", section: "ACHATS" },
  { key: "nom_client_v", label: "NOM CLIENT (Verre)", section: "ACHATS" },
  { key: "montant_v", label: "MONTANT (Verre)", section: "ACHATS" },
  { key: "achat_mont_det", label: "ACHAT MONTURE (DEtail)", section: "ACHATS" },
  { key: "nom_client_m", label: "NOM CLIENT (Monture)", section: "ACHATS" },
  { key: "montant_m", label: "MONTANT (Monture)", section: "ACHATS" },
  { key: "libelle_dep", label: "LIBELLE (DEpense)", section: "CHARGES" },
  { key: "montant_dep", label: "MONTANT (DEpense)", section: "CHARGES" },
  { key: "versement_mt", label: "VERSEMENT (Montant)", section: "VERSEMENTS" }
];

export default function ImportPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingRole, setLoadingRole] = useState(true);
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role')?.toUpperCase();
    if (savedRole !== 'ADMIN' && savedRole !== 'PREPA') {
      router.push('/dashboard');
    } else {
      setRole(savedRole || "");
      setLoadingRole(false);
    }
  }, [router]);
  
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentDayLabel, setCurrentDayLabel] = useState("");
  const [startingBalance, setStartingBalance] = useState<string>("");
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  
  const [importMode, setImportMode] = useState<'FULL' | 'SINGLE'>('SINGLE');
  const [targetDate, setTargetDate] = useState<Date>(new Date());

  // Récupération automatique du solde précédent
  useEffect(() => {
    const fetchPreviousBalance = async () => {
      setIsLoadingBalance(true);
      try {
        const currentIsDraft = role === 'PREPA';
        const dateStr = format(targetDate, "yyyy-MM-dd");
        
        const q = query(
          collection(db, "cash_sessions"),
          where("isDraft", "==", currentIsDraft),
          where("status", "==", "CLOSED"),
          where("date", "<", dateStr),
          orderBy("date", "desc"),
          limit(1)
        );
        
        const snap = await getDocs(q);
        if (!snap.empty) {
          const lastSession = snap.docs[0].data();
          setStartingBalance((lastSession.closingBalanceReal || 0).toString());
        } else {
          // Fallback si aucune session trouvée
          setStartingBalance("0");
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoadingBalance(false);
      }
    };

    if (role) fetchPreviousBalance();
  }, [targetDate, role, db]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: "binary", cellDates: true });
          setWorkbook(wb);
          let allHeaders: string[] = [];
          wb.SheetNames.forEach(name => {
            const sheet = wb.Sheets[name];
            const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z1');
            for (let C = range.s.c; C <= range.e.c; ++C) {
              const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
              if (cell) allHeaders.push(cell.v?.toString().trim());
            }
          });
          setHeaders(Array.from(new Set(allHeaders.filter(h => h))));
          const newMapping: Mapping = {};
          GLOBAL_FIELDS.forEach(f => {
            const match = allHeaders.find(h => h?.toLowerCase().trim() === f.label.toLowerCase().trim());
            if (match) newMapping[f.key] = match;
          });
          setMapping(newMapping);
        } catch (err) { toast({ variant: "destructive", title: "Erreur de lecture" }); }
      };
      reader.readAsBinaryString(selectedFile);
    }
  };

  const cleanNum = (val: any): number => {
    if (val === undefined || val === null || val === "") return 0;
    const s = val.toString().replace(/\s/g, '').replace(',', '.');
    const p = parseFloat(s);
    return isNaN(p) ? 0 : roundAmount(p);
  };

  const ensureClient = async (name: string, isDraft: boolean) => {
    if (!name || name.toUpperCase() === "CLIENT DIVERS" || name === "---") return;
    const q = query(collection(db, "clients"), where("name", "==", name), where("isDraft", "==", isDraft));
    const snap = await getDocs(q);
    if (snap.empty) {
      await addDoc(collection(db, "clients"), {
        name, phone: "", mutuelle: "Aucun", isDraft, 
        createdAt: Timestamp.now(), ordersCount: 1, 
        lastVisit: format(new Date(), "dd/MM/yyyy")
      });
    }
  };

  const handleImportGlobal = async () => {
    if (!workbook || !file) return;
    setIsProcessing(true);
    const currentIsDraft = role === 'PREPA';
    const userName = user?.displayName || "Import Automatique";
    let runningBalance = cleanNum(startingBalance);

    try {
      let allRows: any[] = [];
      workbook.SheetNames.forEach(sheetName => {
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" }) as any[];
        allRows = [...allRows, ...data.map(r => ({ ...r, _sheet: sheetName }))];
      });

      allRows = allRows.map(row => {
        const val = row[mapping.date_col];
        let d: Date | null = null;
        if (val instanceof Date) d = val;
        else if (typeof val === 'number') d = new Date(Math.round((val - 25569) * 86400 * 1000));
        else if (val) {
          const s = val.toString().trim();
          const formats = ["dd/MM/yyyy", "yyyy-MM-dd", "dd-MM-yyyy", "dd/MM/yy", "dd MMMM yyyy", "dd MMMM"];
          for (const f of formats) {
            const parsed = parse(s, f, new Date(), { locale: fr });
            if (isValid(parsed)) { d = parsed; break; }
          }
        }
        if (d && d.getFullYear() < 2000) d.setFullYear(2026);
        return { ...row, _parsedDate: d };
      });

      if (importMode === 'SINGLE') {
        allRows = allRows.filter(r => r._parsedDate && isSameDay(r._parsedDate, targetDate));
      }

      const salesGroups: Record<string, any> = {};
      allRows.forEach(row => {
        const ref = (row[mapping.ref_vente] || "").toString().trim();
        const clientName = (row[mapping.client_1] || "").toString().trim();
        const totalBrut = cleanNum(row[mapping.total_brut]);
        const avancePaye = cleanNum(row[mapping.avance_paye]);
        const avanceAnte = cleanNum(row[mapping.avance_ante]);
        
        if (ref && clientName) {
          if (!salesGroups[ref]) {
            salesGroups[ref] = { ref, clientName, totalBrut, totalPaidFromAvances: 0, payments: [], anteAmt: 0, earliestDate: null };
          }
          if (totalBrut > 0) salesGroups[ref].totalBrut = totalBrut;
          if (avanceAnte > 0) salesGroups[ref].anteAmt = roundAmount(salesGroups[ref].anteAmt + avanceAnte);
          if (avancePaye > 0 && row._parsedDate) {
            salesGroups[ref].totalPaidFromAvances = roundAmount(salesGroups[ref].totalPaidFromAvances + avancePaye);
            salesGroups[ref].payments.push({ amount: roundAmount(avancePaye), date: row._parsedDate, userName: "Import", note: "Versement" });
            if (!salesGroups[ref].earliestDate || row._parsedDate < salesGroups[ref].earliestDate) salesGroups[ref].earliestDate = row._parsedDate;
          }
        }
      });

      const finalSalesMap: Record<string, string> = {}; 
      for (const ref in salesGroups) {
        const s = salesGroups[ref];
        const totalPaidEffective = roundAmount(s.totalPaidFromAvances + s.anteAmt);
        const isFullyPaid = totalPaidEffective >= s.totalBrut;
        await ensureClient(s.clientName, currentIsDraft);
        const docType = isFullyPaid ? "FC" : "RC";
        const invoiceId = `${docType}-2026-${s.ref}`;
        finalSalesMap[ref] = invoiceId;

        const allPayments = [...s.payments];
        if (s.anteAmt > 0) {
          allPayments.unshift({ amount: roundAmount(s.anteAmt), date: new Date(2025, 11, 31).toISOString(), userName: "Historique", note: "Avance antérieure" });
        }

        await setDoc(doc(collection(db, "sales")), {
          invoiceId, clientName: s.clientName, total: roundAmount(s.totalBrut), avance: roundAmount(totalPaidEffective), reste: roundAmount(Math.max(0, s.totalBrut - totalPaidEffective)),
          statut: isFullyPaid ? "Payé" : (totalPaidEffective > 0 ? "Partiel" : "En attente"), isDraft: currentIsDraft, 
          createdAt: Timestamp.fromDate(setHours(s.earliestDate || targetDate, 12)), createdBy: userName,
          payments: allPayments.map((p: any) => ({ ...p, amount: roundAmount(p.amount), date: typeof p.date === 'string' ? p.date : p.date.toISOString() }))
        });
      }

      const totalDays = importMode === 'SINGLE' ? 1 : 60; 
      const startDate = importMode === 'SINGLE' ? targetDate : new Date(2026, 0, 1);

      for (let i = 0; i < totalDays; i++) {
        const currentDate = addDays(startDate, i);
        const dateStr = format(currentDate, "yyyy-MM-dd");
        const isToday = isSameDay(currentDate, new Date());
        
        setCurrentDayLabel(format(currentDate, "dd MMMM", { locale: fr }));
        setProgress(Math.round(((i + 1) / totalDays) * 100));

        const sessionId = currentIsDraft ? `DRAFT-${dateStr}` : dateStr;
        const sessionRef = doc(db, "cash_sessions", sessionId);

        let daySales = 0;
        let dayExpenses = 0;
        let dayVersements = 0;
        const initialBalanceForDay = roundAmount(runningBalance);

        const dayRows = allRows.filter(row => row._parsedDate && format(row._parsedDate, "yyyy-MM-dd") === dateStr);

        for (const row of dayRows) {
          const rowTimestamp = Timestamp.fromDate(setHours(currentDate, 12));
          const ref = (row[mapping.ref_vente] || "").toString().trim();
          const currentAvance = cleanNum(row[mapping.avance_paye]);
          
          if (ref && currentAvance > 0) {
            const invoiceId = finalSalesMap[ref];
            await setDoc(doc(collection(db, "transactions")), {
              type: "VENTE", label: `VENTE ${invoiceId}`, clientName: (row[mapping.client_1] || "").toString().trim(), 
              montant: roundAmount(currentAvance), isDraft: currentIsDraft, createdAt: rowTimestamp, userName, relatedId: invoiceId
            });
            daySales = roundAmount(daySales + currentAvance);
          }

          const vAmt = cleanNum(row[mapping.montant_v]);
          if (vAmt > 0) {
            await setDoc(doc(collection(db, "transactions")), {
              type: "ACHAT VERRES", label: (row[mapping.achat_verre_det] || "ACHAT VERRES").toString().trim(), clientName: (row[mapping.nom_client_v] || "").toString().trim(),
              montant: -Math.abs(roundAmount(vAmt)), isDraft: currentIsDraft, createdAt: rowTimestamp, userName
            });
            dayExpenses = roundAmount(dayExpenses + vAmt);
          }

          const mAmt = cleanNum(row[mapping.montant_m]);
          if (mAmt > 0) {
            await setDoc(doc(collection(db, "transactions")), {
              type: "ACHAT MONTURE", label: (row[mapping.achat_mont_det] || "ACHAT MONTURE").toString().trim(), clientName: (row[mapping.nom_client_m] || "").toString().trim(),
              montant: -Math.abs(roundAmount(mAmt)), isDraft: currentIsDraft, createdAt: rowTimestamp, userName
            });
            dayExpenses = roundAmount(dayExpenses + mAmt);
          }

          const dAmt = cleanNum(row[mapping.montant_dep]);
          if (dAmt > 0) {
            await setDoc(doc(collection(db, "transactions")), {
              type: "DEPENSE", label: (row[mapping.libelle_dep] || "CHARGE").toString().trim(),
              montant: -Math.abs(roundAmount(dAmt)), isDraft: currentIsDraft, createdAt: rowTimestamp, userName
            });
            dayExpenses = roundAmount(dayExpenses + dAmt);
          }

          const verAmt = cleanNum(row[mapping.versement_mt]);
          if (verAmt > 0) {
            await setDoc(doc(collection(db, "transactions")), {
              type: "VERSEMENT", label: "BANQUE", montant: -Math.abs(roundAmount(verAmt)),
              isDraft: currentIsDraft, createdAt: rowTimestamp, userName
            });
            dayVersements = roundAmount(dayVersements + verAmt);
          }
        }

        runningBalance = roundAmount(initialBalanceForDay + daySales - dayExpenses - dayVersements);
        
        // Logique de clôture intelligente
        const sessionData: any = {
          date: dateStr, isDraft: currentIsDraft,
          openedAt: Timestamp.fromDate(setHours(currentDate, 9)),
          openedBy: userName,
          openingBalance: roundAmount(initialBalanceForDay),
          totalSales: roundAmount(daySales), 
          totalExpenses: roundAmount(dayExpenses), 
          totalVersements: roundAmount(dayVersements)
        };

        if (isToday) {
          sessionData.status = "OPEN";
        } else {
          sessionData.status = "CLOSED";
          sessionData.closedAt = Timestamp.fromDate(setHours(currentDate, 20));
          sessionData.closedBy = userName;
          sessionData.closingBalanceReal = roundAmount(runningBalance);
          sessionData.closingBalanceTheoretical = roundAmount(runningBalance);
          sessionData.discrepancy = 0;
        }

        await setDoc(sessionRef, sessionData);
      }

      toast({ variant: "success", title: isSameDay(targetDate, new Date()) ? "Saisie du jour effectuée (Caisse Ouverte)" : "Correction terminée (Caisse Fermée)" });
      router.push(isSameDay(targetDate, new Date()) ? "/caisse" : "/caisse/sessions");
    } catch (e) { toast({ variant: "destructive", title: "Erreur lors de l'importation" }); } finally { setIsProcessing(false); }
  };

  if (loadingRole) return null;

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Automate de Saisie</h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60 mt-1">Correction et importation massive.</p>
          </div>
          <Button variant="outline" onClick={() => XLSX.writeFile(XLSX.utils.book_new(), "Modele.xlsx")} className="h-14 px-6 rounded-2xl font-black text-[10px] uppercase border-primary/20 bg-white text-primary shadow-sm"><Download className="mr-2 h-5 w-5" /> MODÈLE EXCEL</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-[32px] bg-white shadow-lg border-none overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center gap-2">
              <Layers className="h-4 w-4 text-primary/40" />
              <CardTitle className="text-[11px] font-black uppercase text-primary/60">1. Mode Import</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded-2xl">
                <button 
                  onClick={() => setImportMode('FULL')} 
                  className={cn("h-12 rounded-xl text-[10px] font-black uppercase transition-all", importMode === 'FULL' ? "bg-primary text-white shadow-lg" : "text-slate-400 hover:bg-slate-100")}
                >TOUT LE FICHIER</button>
                <button 
                  onClick={() => setImportMode('SINGLE')} 
                  className={cn("h-12 rounded-xl text-[10px] font-black uppercase transition-all", importMode === 'SINGLE' ? "bg-orange-500 text-white shadow-lg" : "text-slate-400 hover:bg-slate-100")}
                >JOURNÉE SEULE</button>
              </div>
              
              {importMode === 'SINGLE' && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Date ciblée</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full h-12 rounded-xl bg-slate-50 border-none font-bold text-xs justify-start px-4">
                        <CalendarIcon className="mr-2 h-4 w-4 text-orange-500" />
                        {format(targetDate, "dd MMMM yyyy", { locale: fr }).toUpperCase()}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl">
                      <Calendar mode="single" selected={targetDate} onSelect={(d) => d && setTargetDate(d)} locale={fr} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[32px] bg-white shadow-lg border-none overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center gap-2">
              <Target className="h-4 w-4 text-primary/40" />
              <CardTitle className="text-[11px] font-black uppercase text-primary/60">
                Solde Initial Auto
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 relative">
              <Input 
                type="number" 
                className="h-14 rounded-2xl font-black text-xl text-center bg-slate-50 border-none tabular-nums" 
                placeholder="DH" 
                value={startingBalance} 
                onChange={e => setStartingBalance(e.target.value)} 
              />
              {isLoadingBalance && <div className="absolute inset-0 bg-white/50 flex items-center justify-center rounded-[32px]"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
              <p className="text-[8px] font-black text-center text-muted-foreground uppercase mt-3 tracking-widest">Récupéré de la veille</p>
            </CardContent>
          </Card>

          <Card 
            className={cn("rounded-[32px] bg-white shadow-lg border-none overflow-hidden cursor-pointer transition-all hover:scale-[1.02]", file ? "border-2 border-green-500" : "")} 
            onClick={() => fileInputRef.current?.click()}
          >
            <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary/40" />
              <CardTitle className="text-[11px] font-black uppercase text-primary/60">3. Fichier Excel</CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex flex-col items-center justify-center min-h-[80px]">
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
              {file ? (
                <div className="flex flex-col items-center text-center gap-1">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mb-1" />
                  <span className="text-[10px] font-black uppercase text-slate-800 truncate max-w-[150px]">{file.name}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-slate-300 gap-1">
                  <FileSpreadsheet className="h-8 w-8" />
                  <span className="text-[10px] font-black uppercase">Sélectionner</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {importMode === 'SINGLE' && (
          <div className={cn(
            "border p-4 rounded-2xl flex items-center gap-4 animate-in fade-in zoom-in-95",
            isSameDay(targetDate, new Date()) ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-orange-50 border-orange-100 text-orange-700"
          )}>
            {isSameDay(targetDate, new Date()) ? <RefreshCw className="h-6 w-6 shrink-0" /> : <AlertTriangle className="h-6 w-6 shrink-0" />}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">
                {isSameDay(targetDate, new Date()) ? "Mode Saisie du Jour" : "Mode Correction"}
              </p>
              <p className="text-xs font-bold">
                {isSameDay(targetDate, new Date()) 
                  ? "La caisse restera OUVERTE pour vous permettre de finir la journée et clôturer manuellement." 
                  : `La caisse du ${format(targetDate, "dd MMMM", { locale: fr })} sera écrasée et FERMÉE automatiquement.`}
              </p>
            </div>
          </div>
        )}

        {workbook && (
          <Card className="rounded-[32px] bg-white shadow-2xl border-none overflow-hidden">
            <CardHeader className="bg-primary text-white p-8">
              <div className="flex justify-between items-center">
                <div className="space-y-1">
                  <CardTitle className="text-xl font-black uppercase">Configuration des Champs</CardTitle>
                  <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Reliez les colonnes de votre Excel au système.</p>
                </div>
                {isProcessing && <div className="bg-white/20 px-4 py-2 rounded-full font-black text-xs uppercase animate-pulse">{currentDayLabel} : {progress}%</div>}
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {GLOBAL_FIELDS.map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase ml-1 text-slate-400">{f.label}</Label>
                    <Select value={mapping[f.key] || ""} onValueChange={v => setMapping({...mapping, [f.key]: v})}>
                      <SelectTrigger className="h-11 rounded-xl font-bold bg-slate-50 border-none shadow-inner">
                        <SelectValue placeholder="Choisir..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {headers.map(h => <SelectItem key={h} value={h} className="font-bold text-xs">{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button 
                onClick={handleImportGlobal} 
                disabled={isProcessing || !file || startingBalance === ""} 
                className={cn("w-full h-16 rounded-2xl font-black text-lg shadow-xl", isSameDay(targetDate, new Date()) ? "bg-blue-600 hover:bg-blue-700" : "bg-orange-500 hover:bg-orange-600")}
              >
                {isProcessing ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>TRAITEMENT EN COURS...</span>
                  </div>
                ) : (
                  isSameDay(targetDate, new Date()) ? "LANCER LA SAISIE DU JOUR" : `CORRIGER LA JOURNÉE DU ${format(targetDate, "dd/MM")}`
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
