
"use client";

import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Loader2, Download, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import { useFirestore, useUser } from "@/firebase";
import { collection, doc, setDoc, getDoc, Timestamp, query, where, getDocs, addDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { setHours, format, addDays, isSameDay, parse, isValid } from "date-fns";
import { fr } from "date-fns/locale";

type Mapping = Record<string, string>;

const GLOBAL_FIELDS = [
  { key: "date_col", label: "DATE (Colonne)", section: "GÉNÉRAL" },
  { key: "client_1", label: "Nom Client 1", section: "VENTES" },
  { key: "total_brut", label: "Total Brut", section: "VENTES" },
  { key: "avance_paye", label: "Avance Paye", section: "VENTES" },
  { key: "avance_ante", label: "Avance Anterieure", section: "VENTES" },
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
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[];
            if (rows) allHeaders = Array.from(new Set([...allHeaders, ...rows.map(h => h?.toString().trim())]));
          });
          
          setHeaders(allHeaders.filter(h => h));
          const newMapping: Mapping = {};
          GLOBAL_FIELDS.forEach(f => {
            if (allHeaders.includes(f.label)) newMapping[f.key] = f.label;
          });
          setMapping(newMapping);
        } catch (err) {
          toast({ variant: "destructive", title: "Erreur de lecture" });
        }
      };
      reader.readAsBinaryString(selectedFile);
    }
  };

  const downloadTemplate = () => {
    const templateHeaders = GLOBAL_FIELDS.map(f => f.label);
    const ws = XLSX.utils.aoa_to_sheet([templateHeaders]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modèle Import");
    XLSX.writeFile(wb, "Modele_LikeVision_14_Colonnes.xlsx");
  };

  const cleanNum = (val: any): number => {
    if (val === undefined || val === null || val === "") return 0;
    const s = val.toString().replace(/\s/g, '').replace(',', '.');
    const p = parseFloat(s);
    return isNaN(p) ? 0 : p;
  };

  const ensureClient = async (name: string, isDraft: boolean) => {
    if (!name) return;
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
      let allRows: any[] = [];
      workbook.SheetNames.forEach(sheetName => {
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];
        allRows = [...allRows, ...data.map(r => ({ ...r, _sheet: sheetName }))];
      });

      // Période étendue : 01 Janvier au 28 Février 2026
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

        // Filtrage ROBUSTE des lignes pour ce jour précis
        const dayRows = allRows.filter(row => {
          const rowDateVal = row[mapping.date_col];
          if (!rowDateVal) {
            const sheet = row._sheet?.toString();
            return sheet === format(currentDate, "dd") || sheet === format(currentDate, "dd-MM");
          }
          
          let d: Date | null = null;
          if (rowDateVal instanceof Date) {
            d = rowDateVal;
          } else if (typeof rowDateVal === 'number') {
            d = new Date(Math.round((rowDateVal - 25569) * 86400 * 1000));
          } else {
            const s = rowDateVal.toString().trim();
            const formats = ["dd/MM/yyyy", "yyyy-MM-dd", "d/M/yyyy", "dd-MM-yyyy", "dd/MM/yy"];
            for (const f of formats) {
              const parsed = parse(s, f, new Date());
              if (isValid(parsed)) {
                d = parsed;
                break;
              }
            }
            if (!d && s.includes('/')) {
              const parts = s.split('/');
              if (parts.length === 3) {
                const year = parseInt(parts[2]);
                const fullYear = year < 100 ? 2000 + year : year;
                d = new Date(fullYear, parseInt(parts[1]) - 1, parseInt(parts[0]));
              }
            }
          }
          return d && isValid(d) && isSameDay(d, currentDate);
        });

        for (const row of dayRows) {
          const rowTimestamp = Timestamp.fromDate(setHours(currentDate, 12));

          // A. VENTES
          const clientName = (row[mapping.client_1] || "").toString().trim();
          const totalVal = cleanNum(row[mapping.total_brut]);
          if (clientName && totalVal > 0) {
            await ensureClient(clientName, currentIsDraft);
            const currentAvance = cleanNum(row[mapping.avance_paye]);
            const historicalAvance = cleanNum(row[mapping.avance_ante]);
            const totalAvance = currentAvance + historicalAvance;
            const isPaid = totalAvance >= totalVal;
            
            if (isPaid) globalCounters.fc++; else globalCounters.rc++;
            const docType = isPaid ? "FC" : "RC";
            const invoiceId = `${currentIsDraft ? 'PREPA-' : ''}${docType}-2026-${(isPaid ? globalCounters.fc : globalCounters.rc).toString().padStart(4, '0')}`;

            await setDoc(doc(collection(db, "sales")), {
              invoiceId, clientName, total: totalVal, avance: totalAvance, reste: Math.max(0, totalVal - totalAvance),
              statut: isPaid ? "Payé" : "Partiel", isDraft: currentIsDraft, createdAt: rowTimestamp, createdBy: userName,
              payments: [
                { amount: historicalAvance, date: currentDate.toISOString(), userName: "Historique", note: "Avance antérieure" },
                { amount: currentAvance, date: currentDate.toISOString(), userName: "Import", note: "Acompte Jour" }
              ]
            });

            if (currentAvance > 0) {
              await setDoc(doc(collection(db, "transactions")), {
                type: "VENTE", label: invoiceId, clientName, montant: currentAvance, 
                isDraft: currentIsDraft, createdAt: rowTimestamp, userName, relatedId: invoiceId
              });
              daySales += currentAvance;
            }
          }

          // B. ACHATS VERRES
          const vAmt = cleanNum(row[mapping.montant_v]);
          if (vAmt > 0) {
            const label = (row[mapping.achat_verre_det] || "ACHAT VERRES").toString().trim();
            const cName = (row[mapping.nom_client_v] || "").toString().trim();
            if (cName) await ensureClient(cName, currentIsDraft);
            await setDoc(doc(collection(db, "transactions")), {
              type: "ACHAT VERRES", label, clientName: cName,
              montant: -Math.abs(vAmt), isDraft: currentIsDraft, createdAt: rowTimestamp, userName
            });
            dayExpenses += vAmt;
          }

          // C. ACHATS MONTURES
          const mAmt = cleanNum(row[mapping.montant_m]);
          if (mAmt > 0) {
            const label = (row[mapping.achat_mont_det] || "ACHAT MONTURE").toString().trim();
            const cName = (row[mapping.nom_client_m] || "").toString().trim();
            if (cName) await ensureClient(cName, currentIsDraft);
            await setDoc(doc(collection(db, "transactions")), {
              type: "ACHAT MONTURE", label, clientName: cName,
              montant: -Math.abs(mAmt), isDraft: currentIsDraft, createdAt: rowTimestamp, userName
            });
            dayExpenses += mAmt;
          }

          // D. DEPENSES GENERALES
          const dAmt = cleanNum(row[mapping.montant_dep]);
          if (dAmt > 0) {
            await setDoc(doc(collection(db, "transactions")), {
              type: "DEPENSE", label: (row[mapping.libelle_dep] || "CHARGE").toString().trim(),
              montant: -Math.abs(dAmt), isDraft: currentIsDraft, createdAt: rowTimestamp, userName
            });
            dayExpenses += dAmt;
          }

          // E. VERSEMENTS
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
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur lors de l'importation" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loadingRole) return null;

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Automate de Saisie</h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">Janvier & Février 2026 - Création automatique.</p>
          </div>
          <Button variant="outline" onClick={downloadTemplate} className="h-14 px-6 rounded-2xl font-black text-[10px] uppercase border-primary/20 bg-white text-primary shadow-sm">
            <Download className="mr-2 h-5 w-5" /> MODÈLE EXCEL
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="rounded-[32px] bg-white shadow-lg border-none">
            <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-[11px] font-black uppercase text-primary/60">1. Solde Initial au 01/01</CardTitle></CardHeader>
            <CardContent className="p-6">
              <Input type="number" className="h-14 rounded-2xl font-black text-xl text-center bg-slate-50 border-none" placeholder="DH" value={startingBalance} onChange={e => setStartingBalance(e.target.value)} />
            </CardContent>
          </Card>

          <Card className="rounded-[32px] bg-white shadow-lg border-none" onClick={() => fileInputRef.current?.click()}>
            <CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="text-[11px] font-black uppercase text-primary/60">2. Fichier Excel</CardTitle></CardHeader>
            <CardContent className="p-6 flex flex-col items-center justify-center cursor-pointer">
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
              <FileSpreadsheet className="h-10 w-10 text-primary mb-2" />
              <span className="text-xs font-black uppercase">{file ? file.name : "Choisir le fichier"}</span>
            </CardContent>
          </Card>
        </div>

        {workbook && (
          <Card className="rounded-[32px] bg-white shadow-2xl border-none overflow-hidden">
            <CardHeader className="bg-primary text-white p-8">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-black uppercase">Configuration de l'Import</CardTitle>
                {isProcessing && <div className="bg-white/20 px-4 py-2 rounded-full font-black text-xs uppercase">{currentDayLabel} : {progress}%</div>}
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {GLOBAL_FIELDS.map(f => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase ml-1">{f.label}</Label>
                    <Select value={mapping[f.key] || ""} onValueChange={v => setMapping({...mapping, [f.key]: v})}>
                      <SelectTrigger className="h-11 rounded-xl font-bold bg-slate-50 border-none"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                      <SelectContent className="rounded-xl">{headers.map(h => <SelectItem key={h} value={h} className="font-bold text-xs">{h}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button onClick={handleImportGlobal} disabled={isProcessing || !file || !startingBalance} className="w-full h-16 rounded-2xl font-black text-lg shadow-xl bg-primary">
                {isProcessing ? <Loader2 className="h-6 w-6 animate-spin" /> : "LANCER L'IMPORTATION COMPLÈTE"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
