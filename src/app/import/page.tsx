
"use client";

import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Loader2, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useFirestore, useUser } from "@/firebase";
import { collection, doc, setDoc, getDoc, Timestamp, query, where, getDocs, addDoc, writeBatch } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { setHours, format, addDays, parse, isValid, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";

type Mapping = Record<string, string>;

const GLOBAL_FIELDS = [
  { key: "date_col", label: "DATE (Colonne)", section: "GÉNÉRAL" },
  { key: "client_1", label: "Nom Client 1", section: "VENTES" },
  { key: "total_brut", label: "Total Brut", section: "VENTES" },
  { key: "avance_paye", label: "Avance Payée (Reçue)", section: "VENTES" },
  { key: "achat_verre_det", label: "ACHAT VERRE (Détail)", section: "ACHATS" },
  { key: "nom_client_v", label: "NOM CLIENT (Verre)", section: "ACHATS" },
  { key: "montant_v", label: "MONTANT (Verre)", section: "ACHATS" },
  { key: "achat_mont_det", label: "ACHAT MONTURE (Détail)", section: "ACHATS" },
  { key: "nom_client_m", label: "NOM CLIENT (Monture)", section: "ACHATS" },
  { key: "montant_m", label: "MONTANT (Monture)", section: "ACHATS" },
  { key: "libelle_dep", label: "LIBELLE (Dépense)", section: "CHARGES" },
  { key: "montant_dep", label: "MONTANT (Dépense)", section: "CHARGES" },
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
    return isNaN(p) ? 0 : p;
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

    const counterRef = doc(db, "settings", currentIsDraft ? "counters_draft" : "counters");
    const counterSnap = await getDoc(counterRef);
    let globalCounters = counterSnap.exists() ? counterSnap.data() as any : { fc: 0, rc: 0 };

    try {
      // 1. COLLECT ALL DATA
      let allRows: any[] = [];
      workbook.SheetNames.forEach(sheetName => {
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" }) as any[];
        allRows = [...allRows, ...data.map(r => ({ ...r, _sheet: sheetName }))];
      });

      // Pre-process dates for all rows
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

      // 2. GROUP SALES CROSS-DAYS
      // Key: clientName + totalBrut
      const salesGroups: Record<string, any> = {};
      
      allRows.forEach(row => {
        const clientName = (row[mapping.client_1] || "").toString().trim();
        const totalVal = cleanNum(row[mapping.total_brut]);
        const avance = cleanNum(row[mapping.avance_paye]);
        
        if (clientName && totalVal > 0) {
          const key = `${clientName.toLowerCase()}_${totalVal}`;
          if (!salesGroups[key]) {
            salesGroups[key] = {
              clientName,
              total: totalVal,
              payments: [],
              earliestDate: null
            };
          }
          
          if (avance > 0 && row._parsedDate) {
            salesGroups[key].payments.push({
              amount: avance,
              date: row._parsedDate,
              userName: "Import",
              note: "Versement"
            });
            if (!salesGroups[key].earliestDate || row._parsedDate < salesGroups[key].earliestDate) {
              salesGroups[key].earliestDate = row._parsedDate;
            }
          }
        }
      });

      // 3. GENERATE INVOICE IDS AND CREATE SALES
      const finalSalesMap: Record<string, string> = {}; // groupKey -> invoiceId
      const sortedSalesKeys = Object.keys(salesGroups).sort((a, b) => {
        const da = salesGroups[a].earliestDate?.getTime() || 0;
        const db = salesGroups[b].earliestDate?.getTime() || 0;
        return da - db;
      });

      for (const key of sortedSalesKeys) {
        const s = salesGroups[key];
        const totalPaid = s.payments.reduce((acc: number, p: any) => acc + p.amount, 0);
        const isPaid = totalPaid >= s.total;
        
        await ensureClient(s.clientName, currentIsDraft);
        
        if (isPaid) globalCounters.fc++; else globalCounters.rc++;
        const invoiceId = `${currentIsDraft ? 'PREPA-' : ''}${isPaid ? 'FC' : 'RC'}-2026-${(isPaid ? globalCounters.fc : globalCounters.rc).toString().padStart(4, '0')}`;
        finalSalesMap[key] = invoiceId;

        await setDoc(doc(collection(db, "sales")), {
          invoiceId, 
          clientName: s.clientName, 
          total: s.total, 
          avance: totalPaid, 
          reste: Math.max(0, s.total - totalPaid),
          statut: isPaid ? "Payé" : (totalPaid > 0 ? "Partiel" : "En attente"), 
          isDraft: currentIsDraft, 
          createdAt: Timestamp.fromDate(setHours(s.earliestDate || new Date(2026, 0, 1), 12)), 
          createdBy: userName,
          payments: s.payments.map((p: any) => ({ ...p, date: p.date.toISOString() }))
        });
      }

      // 4. PROCESS DAILY SESSIONS AND TRANSACTIONS
      const totalDays = 59; 
      const startDate = new Date(2026, 0, 1);

      for (let i = 0; i < totalDays; i++) {
        const currentDate = addDays(startDate, i);
        const dateStr = format(currentDate, "yyyy-MM-dd");
        
        setCurrentDayLabel(format(currentDate, "dd MMMM", { locale: fr }));
        setProgress(Math.round(((i + 1) / totalDays) * 100));

        const sessionId = currentIsDraft ? `DRAFT-${dateStr}` : dateStr;
        const sessionRef = doc(db, "cash_sessions", sessionId);

        let daySales = 0;
        let dayExpenses = 0;
        let dayVersements = 0;
        const initialBalanceForDay = runningBalance;

        // Filter rows for this specific day
        const dayRows = allRows.filter(row => {
          if (row._parsedDate && format(row._parsedDate, "yyyy-MM-dd") === dateStr) return true;
          
          // Fallback to sheet name matching if date is missing
          const sheet = row._sheet?.toString() || "";
          const sheetNum = sheet.replace(/\D/g, '');
          const isMonthMatch = (currentDate.getMonth() === 0 && sheet.toLowerCase().includes('janv')) || 
                               (currentDate.getMonth() === 1 && sheet.toLowerCase().includes('fevr'));
          return isMonthMatch && (sheetNum === format(currentDate, "dd") || sheet.includes(format(currentDate, "dd-MM")));
        });

        for (const row of dayRows) {
          const rowTimestamp = Timestamp.fromDate(setHours(currentDate, 12));
          
          // Advances (Sales)
          const clientName = (row[mapping.client_1] || "").toString().trim();
          const totalVal = cleanNum(row[mapping.total_brut]);
          const currentAvance = cleanNum(row[mapping.avance_paye]);
          
          if (clientName && totalVal > 0 && currentAvance > 0) {
            const groupKey = `${clientName.toLowerCase()}_${totalVal}`;
            const invoiceId = finalSalesMap[groupKey];
            
            await setDoc(doc(collection(db, "transactions")), {
              type: "VENTE", 
              label: invoiceId, 
              clientName, 
              montant: currentAvance, 
              isDraft: currentIsDraft, 
              createdAt: rowTimestamp, 
              userName, 
              relatedId: invoiceId
            });
            daySales += currentAvance;
          }

          // Expenses and Versements
          const vAmt = cleanNum(row[mapping.montant_v]);
          if (vAmt > 0) {
            await setDoc(doc(collection(db, "transactions")), {
              type: "ACHAT VERRES", label: (row[mapping.achat_verre_det] || "ACHAT VERRES").toString().trim(), clientName: (row[mapping.nom_client_v] || "").toString().trim(),
              montant: -Math.abs(vAmt), isDraft: currentIsDraft, createdAt: rowTimestamp, userName
            });
            dayExpenses += vAmt;
          }

          const mAmt = cleanNum(row[mapping.montant_m]);
          if (mAmt > 0) {
            await setDoc(doc(collection(db, "transactions")), {
              type: "ACHAT MONTURE", label: (row[mapping.achat_mont_det] || "ACHAT MONTURE").toString().trim(), clientName: (row[mapping.nom_client_m] || "").toString().trim(),
              montant: -Math.abs(mAmt), isDraft: currentIsDraft, createdAt: rowTimestamp, userName
            });
            dayExpenses += mAmt;
          }

          const dAmt = cleanNum(row[mapping.montant_dep]);
          if (dAmt > 0) {
            await setDoc(doc(collection(db, "transactions")), {
              type: "DEPENSE", label: (row[mapping.libelle_dep] || "CHARGE").toString().trim(),
              montant: -Math.abs(dAmt), isDraft: currentIsDraft, createdAt: rowTimestamp, userName
            });
            dayExpenses += dAmt;
          }

          const verAmt = cleanNum(row[mapping.versement_mt]);
          if (verAmt > 0) {
            await setDoc(doc(collection(db, "transactions")), {
              type: "VERSEMENT", label: "VERSEMENT CAISSE", montant: -Math.abs(verAmt),
              isDraft: currentIsDraft, createdAt: rowTimestamp, userName
            });
            dayVersements += verAmt;
          }
        }

        runningBalance = initialBalanceForDay + daySales - dayExpenses - dayVersements;
        await setDoc(sessionRef, {
          date: dateStr, isDraft: currentIsDraft, status: "CLOSED",
          openedAt: Timestamp.fromDate(setHours(currentDate, 9)),
          closedAt: Timestamp.fromDate(setHours(currentDate, 20)),
          openedBy: userName, closedBy: userName,
          openingBalance: initialBalanceForDay,
          closingBalanceReal: runningBalance,
          closingBalanceTheoretical: runningBalance,
          totalSales: daySales, totalExpenses: dayExpenses, totalVersements: dayVersements,
          discrepancy: 0
        });
      }

      await setDoc(counterRef, globalCounters);
      toast({ variant: "success", title: "Importation terminée" });
      router.push("/caisse/sessions");
    } catch (e) { toast({ variant: "destructive", title: "Erreur lors de l'importation" }); } finally { setIsProcessing(false); }
  };

  if (loadingRole) return null;

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Automate de Saisie</h1></div>
          <Button variant="outline" onClick={() => XLSX.writeFile(XLSX.utils.book_new(), "Modele.xlsx")} className="h-14 px-6 rounded-2xl font-black text-[10px] uppercase border-primary/20 bg-white text-primary shadow-sm"><Download className="mr-2 h-5 w-5" /> MODÈLE EXCEL</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="rounded-[32px] bg-white shadow-lg border-none"><CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-[11px] font-black uppercase text-primary/60">1. Solde Initial au 01/01</CardTitle></CardHeader><CardContent className="p-6"><Input type="number" className="h-14 rounded-2xl font-black text-xl text-center bg-slate-50 border-none" placeholder="DH" value={startingBalance} onChange={e => setStartingBalance(e.target.value)} /></CardContent></Card>
          <Card className="rounded-[32px] bg-white shadow-lg border-none" onClick={() => fileInputRef.current?.click()}><CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-[11px] font-black uppercase text-primary/60">2. Fichier Excel</CardTitle></CardHeader><CardContent className="p-6 flex flex-col items-center justify-center cursor-pointer"><input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} /><FileSpreadsheet className="h-10 w-10 text-primary mb-2" /><span className="text-xs font-black uppercase">{file ? file.name : "Choisir le fichier"}</span></CardContent></Card>
        </div>
        {workbook && (
          <Card className="rounded-[32px] bg-white shadow-2xl border-none overflow-hidden"><CardHeader className="bg-primary text-white p-8"><div className="flex justify-between items-center"><CardTitle className="text-xl font-black uppercase">Configuration</CardTitle>{isProcessing && <div className="bg-white/20 px-4 py-2 rounded-full font-black text-xs uppercase">{currentDayLabel} : {progress}%</div>}</div></CardHeader><CardContent className="p-8"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">{GLOBAL_FIELDS.map(f => (<div key={f.key} className="space-y-1.5"><Label className="text-[10px] font-black uppercase ml-1">{f.label}</Label><Select value={mapping[f.key] || ""} onValueChange={v => setMapping({...mapping, [f.key]: v})}><SelectTrigger className="h-11 rounded-xl font-bold bg-slate-50 border-none"><SelectValue placeholder="Choisir..." /></SelectTrigger><SelectContent className="rounded-xl">{headers.map(h => <SelectItem key={h} value={h} className="font-bold text-xs">{h}</SelectItem>)}</SelectContent></Select></div>))}</div><Button onClick={handleImportGlobal} disabled={isProcessing || !file || !startingBalance} className="w-full h-16 rounded-2xl font-black text-lg shadow-xl bg-primary">{isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : "LANCER L'IMPORTATION COMPLÈTE"}</Button></CardContent></Card>
        )}
      </div>
    </AppShell>
  );
}
