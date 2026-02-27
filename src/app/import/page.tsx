
"use client";

import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Loader2, Upload, Download, Info, CheckCircle2, Table as TableIcon } from "lucide-react";
import * as XLSX from "xlsx";
import { useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp, Timestamp, getDocs, query, where, orderBy } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

type Mapping = Record<string, string>;

export default function ImportPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    const role = localStorage.getItem('user_role');
    if (role !== 'ADMIN' && role !== 'PREPA') {
      router.push('/dashboard');
    } else {
      setLoadingRole(false);
    }
  }, [router]);
  
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importType, setImportType] = useState<"sales" | "clients" | "transactions">("sales");

  const SALES_FIELDS = [
    { key: "invoiceId", label: "N° Facture (Optionnel)" },
    { key: "clientName", label: "Nom Client" },
    { key: "clientPhone", label: "Téléphone" },
    { key: "total", label: "Total Brut" },
    { key: "avance", label: "Avance Payée (Entre en CA)" },
    { key: "historicalAdvance", label: "Avance Antérieure (Hors CA)" },
    { key: "createdAt", label: "Date" },
    { key: "mutuelle", label: "Mutuelle" },
    { key: "purchasePriceFrame", label: "Coût Monture (Achat)" },
    { key: "purchasePriceLenses", label: "Coût Verres (Achat)" }
  ];

  const CLIENTS_FIELDS = [
    { key: "name", label: "Nom Complet" },
    { key: "phone", label: "Téléphone" },
    { key: "mutuelle", label: "Mutuelle" }
  ];

  const TRANSACTIONS_FIELDS = [
    { key: "type", label: "Type (VENTE/DEPENSE/VERSEMENT)" },
    { key: "label", label: "Libellé / Description" },
    { key: "montant", label: "Montant" },
    { key: "createdAt", label: "Date" },
    { key: "category", label: "Catégorie (Optionnel)" }
  ];

  const currentFields = importType === "sales" ? SALES_FIELDS : (importType === "clients" ? CLIENTS_FIELDS : TRANSACTIONS_FIELDS);

  const downloadTemplate = () => {
    const sampleRow = currentFields.reduce((acc, f) => ({ ...acc, [f.label]: "" }), {});
    
    if (importType === "sales") {
      Object.assign(sampleRow, {
        "N° Facture (Optionnel)": "Laissez vide pour auto-génération",
        "Nom Client": "Ex: Mohamed Alami",
        "Téléphone": "0600112233",
        "Total Brut": "1500",
        "Avance Payée (Entre en CA)": "500",
        "Avance Antérieure (Hors CA)": "1000",
        "Date": "01/01/2024",
        "Mutuelle": "CNOPS",
        "Coût Monture (Achat)": "200",
        "Coût Verres (Achat)": "300"
      });
    } else if (importType === "transactions") {
      Object.assign(sampleRow, {
        "Type (VENTE/DEPENSE/VERSEMENT)": "DEPENSE",
        "Libellé / Description": "Ex: Loyer Janvier",
        "Montant": "3000",
        "Date": "05/01/2024",
        "Catégorie": "Charges"
      });
    }

    const ws = XLSX.utils.json_to_sheet([sampleRow]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modèle");
    XLSX.writeFile(wb, `modele_import_${importType}.xlsx`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: "binary", cellDates: true });
          const jsonData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
          if (jsonData.length > 0) {
            setData(jsonData);
            setHeaders(Object.keys(jsonData[0] as object));
            const newMapping: Mapping = {};
            Object.keys(jsonData[0] as object).forEach(header => {
              const lowerHeader = header.toLowerCase();
              currentFields.forEach(field => {
                if (lowerHeader.includes(field.label.toLowerCase()) || lowerHeader.includes(field.key.toLowerCase())) {
                  newMapping[field.key] = header;
                }
              });
            });
            setMapping(newMapping);
          }
        } catch (err) {
          toast({ variant: "destructive", title: "Erreur de lecture" });
        }
      };
      reader.readAsBinaryString(selectedFile);
    }
  };

  const handleImport = async () => {
    if (data.length === 0) return;
    setIsProcessing(true);
    setProgress(0);
    const role = localStorage.getItem('user_role');
    const isDraft = role === 'PREPA';

    // Récupération des compteurs actuels pour FH et RH
    let fhCounter = 0;
    let rhCounter = 0;

    try {
      const qFH = query(collection(db, "sales"), where("invoiceId", ">=", "FH-2026-"), where("invoiceId", "<=", "FH-2026-\uf8ff"));
      const snapFH = await getDocs(qFH);
      fhCounter = snapFH.size;

      const qRH = query(collection(db, "sales"), where("invoiceId", ">=", "RH-2026-"), where("invoiceId", "<=", "RH-2026-\uf8ff"));
      const snapRH = await getDocs(qRH);
      rhCounter = snapRH.size;
    } catch (e) {
      console.error("Erreur compteurs", e);
    }

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        if (importType === "sales") {
          const clientName = row[mapping.clientName] || "Client Importé";
          const clientPhone = (row[mapping.clientPhone]?.toString() || "").replace(/\s/g, "");
          const total = parseFloat(row[mapping.total]) || 0;
          const currentAvance = parseFloat(row[mapping.avance]) || 0;
          const historicalAvance = parseFloat(row[mapping.historicalAdvance]) || 0;
          const totalAvanceCumulee = currentAvance + historicalAvance;
          const purchaseFrame = parseFloat(row[mapping.purchasePriceFrame]) || 0;
          const purchaseLenses = parseFloat(row[mapping.purchasePriceLenses]) || 0;
          
          const isPaid = totalAvanceCumulee >= total;
          let invoiceId = row[mapping.invoiceId]?.toString();

          // Génération automatique si vide ou si format FH/RH demandé
          if (!invoiceId || invoiceId.includes("Laissez vide")) {
            if (isPaid) {
              fhCounter++;
              invoiceId = `FH-2026-${fhCounter.toString().padStart(4, '0')}`;
            } else {
              rhCounter++;
              invoiceId = `RH-2026-${rhCounter.toString().padStart(4, '0')}`;
            }
          }
          
          let createdAtDate = new Date();
          if (row[mapping.createdAt]) {
            const parsed = new Date(row[mapping.createdAt]);
            if (!isNaN(parsed.getTime())) createdAtDate = parsed;
          }

          const payments = [];
          if (historicalAvance > 0) {
            payments.push({ amount: historicalAvance, date: createdAtDate.toISOString(), userName: "Historique", note: "Avance antérieure" });
          }
          if (currentAvance > 0) {
            payments.push({ amount: currentAvance, date: createdAtDate.toISOString(), userName: "Import", note: "Versement importé" });
          }

          const saleData = {
            invoiceId, clientName, clientPhone, total, 
            avance: totalAvanceCumulee,
            reste: Math.max(0, total - totalAvanceCumulee),
            statut: isPaid ? "Payé" : (totalAvanceCumulee > 0 ? "Partiel" : "En attente"),
            mutuelle: row[mapping.mutuelle] || "Aucun",
            purchasePriceFrame: purchaseFrame,
            purchasePriceLenses: purchaseLenses,
            createdAt: Timestamp.fromDate(createdAtDate),
            updatedAt: serverTimestamp(),
            remise: 0, notes: "Importé depuis historique", isDraft,
            payments: payments
          };

          await addDoc(collection(db, "sales"), saleData);

          if (currentAvance > 0) {
            await addDoc(collection(db, "transactions"), {
              type: "VENTE", label: `Import Vente - ${invoiceId}`, clientName, category: "Optique", montant: currentAvance,
              relatedId: invoiceId, userName: "Système (Import)", isDraft, createdAt: Timestamp.fromDate(createdAtDate)
            });
          }
        } 
        else if (importType === "transactions") {
          const type = (row[mapping.type]?.toString().toUpperCase() || "DEPENSE");
          const montant = parseFloat(row[mapping.montant]) || 0;
          const label = row[mapping.label] || type;
          const category = row[mapping.category] || "Général";
          
          let createdAtDate = new Date();
          if (row[mapping.createdAt]) {
            const parsed = new Date(row[mapping.createdAt]);
            if (!isNaN(parsed.getTime())) createdAtDate = parsed;
          }

          const finalAmount = (type === "DEPENSE" || type === "ACHAT VERRES" || type === "VERSEMENT") ? -Math.abs(montant) : Math.abs(montant);

          await addDoc(collection(db, "transactions"), {
            type, label, category, montant: finalAmount, isDraft, createdAt: Timestamp.fromDate(createdAtDate), userName: "Import Manuel"
          });
        }
        else if (importType === "clients") {
          const name = row[mapping.name];
          const phone = (row[mapping.phone]?.toString() || "").replace(/\s/g, "");
          if (name && phone) {
            await addDoc(collection(db, "clients"), {
              name, phone, mutuelle: row[mapping.mutuelle] || "Aucun",
              createdAt: serverTimestamp(), lastVisit: new Date().toLocaleDateString("fr-FR"), ordersCount: 0
            });
          }
        }
      } catch (e) {
        console.error("Erreur ligne " + i, e);
      }
      setProgress(Math.round(((i + 1) / data.length) * 100));
    }

    setIsProcessing(false);
    toast({ variant: "success", title: "Importation Réussie", description: `${data.length} lignes traitées.` });
    setData([]);
    setFile(null);
    setMapping({});
  };

  if (loadingRole) return null;

  return (
    <AppShell>
      <div className="space-y-6 max-w-6xl mx-auto pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Importation de Données</h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60 mt-1">Saisie massive depuis Excel.</p>
          </div>
          <Button onClick={downloadTemplate} variant="outline" className="h-12 px-6 rounded-xl font-black text-[10px] uppercase border-primary/20 bg-white text-primary shadow-sm hover:bg-primary hover:text-white transition-all">
            <Download className="mr-2 h-4 w-4" /> TÉLÉCHARGER LE MODÈLE
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <Card className="rounded-[32px] border-none shadow-lg bg-white overflow-hidden">
              <CardHeader className="bg-slate-50 border-b p-6">
                <CardTitle className="text-[11px] font-black uppercase text-primary/60 tracking-widest flex items-center gap-2">
                  <TableIcon className="h-4 w-4" /> 1. Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Type d'import</Label>
                  <Select value={importType} onValueChange={(v: any) => { setImportType(v); setMapping({}); setData([]); setFile(null); }}>
                    <SelectTrigger className="h-12 rounded-xl font-bold bg-slate-50 border-none"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="sales" className="font-bold">Historique de Ventes</SelectItem>
                      <SelectItem value="transactions" className="font-bold">Caisse (Dépenses/Flux)</SelectItem>
                      <SelectItem value="clients" className="font-bold">Fichier Clients</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                  <div className="flex items-start gap-3">
                    <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-blue-900 uppercase">Colonnes requises :</p>
                      <ul className="text-[8px] font-bold text-blue-700/70 space-y-1">
                        {currentFields.map(f => <li key={f.key}>• {f.label}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-[32px] border-none shadow-lg bg-white overflow-hidden h-full flex flex-col">
              <CardHeader className="bg-slate-50 border-b p-6">
                <CardTitle className="text-[11px] font-black uppercase text-primary/60 tracking-widest flex items-center gap-2">
                  <Upload className="h-4 w-4" /> 2. Fichier Excel
                </CardTitle>
              </CardHeader>
              <CardContent className="p-8 flex-1 flex flex-col justify-center">
                <div className="flex flex-col items-center justify-center border-4 border-dashed border-slate-100 rounded-[32px] bg-slate-50/30 p-10 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                  <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
                  <div className="h-20 w-20 bg-primary/10 rounded-[24px] flex items-center justify-center mb-4 shadow-inner">
                    <FileSpreadsheet className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{file ? file.name : "Cliquez pour choisir votre fichier"}</h3>
                  <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Format .xlsx recommandé</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {data.length > 0 && (
          <Card className="rounded-[32px] border-none shadow-2xl bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500">
            <CardHeader className="bg-primary text-white p-8">
              <div className="flex justify-between items-center">
                <CardTitle className="text-2xl font-black uppercase flex items-center gap-4 tracking-tighter">
                  {isProcessing ? `Importation... ${progress}%` : "Mapping des Colonnes"}
                </CardTitle>
                <div className="bg-white/20 px-4 py-2 rounded-full font-black text-xs uppercase">
                  {data.length} lignes détectées
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                {currentFields.map(field => (
                  <div key={field.key} className="space-y-3">
                    <div className="flex justify-between">
                      <Label className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">{field.label}</Label>
                      {mapping[field.key] && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                    </div>
                    <Select value={mapping[field.key] || ""} onValueChange={(v) => setMapping({...mapping, [field.key]: v})}>
                      <SelectTrigger className="h-14 rounded-2xl font-black text-slate-900 border-none bg-slate-50 shadow-inner px-6">
                        <SelectValue placeholder="Choisir la colonne Excel..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {headers.map(h => <SelectItem key={h} value={h} className="font-black text-xs">{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button onClick={handleImport} disabled={isProcessing || Object.keys(mapping).length < 2} className="w-full h-16 rounded-[24px] font-black text-lg shadow-2xl bg-primary mt-12 hover:scale-[1.01] transition-transform">
                {isProcessing ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>TRAITEMENT EN COURS ({progress}%)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Upload className="h-6 w-6" />
                    <span>LANCER L'IMPORTATION DE {data.length} LIGNES</span>
                  </div>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
