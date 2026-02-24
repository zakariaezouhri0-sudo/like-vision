
"use client";

import { useState, useRef } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Table as TableIcon, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useFirestore } from "@/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs, Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

type Mapping = Record<string, string>;

export default function ImportPage() {
  const { toast } = useToast();
  const db = useFirestore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importType, setImportType] = useState<"sales" | "clients">("sales");

  const SALES_FIELDS = [
    { key: "invoiceId", label: "N° Facture" },
    { key: "clientName", label: "Nom Client" },
    { key: "clientPhone", label: "Téléphone" },
    { key: "total", label: "Total Brut" },
    { key: "avance", label: "Avance Payée" },
    { key: "createdAt", label: "Date" },
    { key: "mutuelle", label: "Mutuelle" }
  ];

  const CLIENTS_FIELDS = [
    { key: "name", label: "Nom Complet" },
    { key: "phone", label: "Téléphone" },
    { key: "mutuelle", label: "Mutuelle" }
  ];

  const currentFields = importType === "sales" ? SALES_FIELDS : CLIENTS_FIELDS;

  const downloadTemplate = () => {
    const templateData = importType === "sales" ? [
      {
        "N° Facture": "OPT-2026-001",
        "Nom Client": "Ahmed Alami",
        "Téléphone": "0661000000",
        "Total Brut": 1500,
        "Avance Payée": 500,
        "Date": "2024-05-20",
        "Mutuelle": "CNOPS"
      }
    ] : [
      {
        "Nom Complet": "Ahmed Alami",
        "Téléphone": "0661000000",
        "Mutuelle": "CNOPS"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modèle");
    XLSX.writeFile(wb, `modele_import_${importType}.xlsx`);
    
    toast({
      variant: "success",
      title: "Modèle téléchargé",
      description: "Remplissez ce fichier et importez-le ci-dessous."
    });
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
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const jsonData = XLSX.utils.sheet_to_json(ws);
          
          if (jsonData.length > 0) {
            setData(jsonData);
            setHeaders(Object.keys(jsonData[0] as object));
            // Auto-mapping
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
          } else {
            toast({ variant: "destructive", title: "Fichier vide", description: "Le fichier ne contient aucune donnée." });
          }
        } catch (err) {
          toast({ variant: "destructive", title: "Erreur de lecture", description: "Impossible de lire le fichier Excel." });
        }
      };
      reader.readAsBinaryString(selectedFile);
    }
  };

  const handleImport = async () => {
    if (data.length === 0) return;
    setIsProcessing(true);
    setProgress(0);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        if (importType === "sales") {
          const clientName = row[mapping.clientName] || "Client Importé";
          const clientPhone = (row[mapping.clientPhone]?.toString() || "").replace(/\s/g, "");
          const total = parseFloat(row[mapping.total]) || 0;
          const avance = parseFloat(row[mapping.avance]) || 0;
          const invoiceId = row[mapping.invoiceId] || `OPT-2026-IMP-${Date.now().toString().slice(-4)}-${i}`;
          
          let createdAtDate = new Date();
          const rawDate = row[mapping.createdAt];
          if (rawDate) {
            const parsedDate = new Date(rawDate);
            if (!isNaN(parsedDate.getTime())) {
              createdAtDate = parsedDate;
            }
          }

          const saleData = {
            invoiceId,
            clientName,
            clientPhone,
            total,
            avance,
            reste: Math.max(0, total - avance),
            statut: avance >= total ? "Payé" : (avance > 0 ? "Partiel" : "En attente"),
            mutuelle: row[mapping.mutuelle] || "Aucun",
            createdAt: Timestamp.fromDate(createdAtDate),
            updatedAt: serverTimestamp(),
            remise: 0,
            notes: "Importé depuis historique"
          };

          await addDoc(collection(db, "sales"), saleData);

          const clientsRef = collection(db, "clients");
          const clientQ = query(clientsRef, where("phone", "==", clientPhone));
          const clientSnap = await getDocs(clientQ);
          if (clientSnap.empty && clientPhone) {
            await addDoc(clientsRef, {
              name: clientName,
              phone: clientPhone,
              mutuelle: saleData.mutuelle,
              createdAt: serverTimestamp(),
              lastVisit: createdAtDate.toLocaleDateString("fr-FR"),
              ordersCount: 1
            });
          }

          if (avance > 0) {
            await addDoc(collection(db, "transactions"), {
              type: "VENTE",
              label: `Versement Import ${invoiceId}`,
              category: "Historique",
              montant: avance,
              relatedId: invoiceId,
              createdAt: Timestamp.fromDate(createdAtDate)
            });
          }
        } else {
          const name = row[mapping.name];
          const phone = (row[mapping.phone]?.toString() || "").replace(/\s/g, "");
          if (name && phone) {
            await addDoc(collection(db, "clients"), {
              name,
              phone,
              mutuelle: row[mapping.mutuelle] || "Aucun",
              createdAt: serverTimestamp(),
              lastVisit: new Date().toLocaleDateString("fr-FR"),
              ordersCount: 0
            });
          }
        }
        successCount++;
      } catch (e) {
        errorCount++;
      }
      setProgress(Math.round(((i + 1) / data.length) * 100));
    }

    setIsProcessing(false);
    toast({
      variant: errorCount > 0 ? "destructive" : "success",
      title: "Importation Terminée",
      description: `${successCount} lignes importées. ${errorCount} erreurs.`
    });
    
    if (errorCount === 0) {
      setData([]);
      setFile(null);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl mx-auto pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-primary uppercase tracking-tighter">Importation Historique</h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60 mt-1">Intégrez vos fichiers Excel facilement.</p>
          </div>
          <Button 
            onClick={downloadTemplate}
            variant="outline" 
            className="h-12 px-6 rounded-xl font-black text-[10px] uppercase border-primary/20 bg-white text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
          >
            <Download className="mr-2 h-4 w-4" /> TÉLÉCHARGER LE MODÈLE EXCEL
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 rounded-[32px] border-none shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-[11px] font-black uppercase text-primary/60 tracking-widest">1. Configuration</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground">Type à importer</Label>
                <Select value={importType} onValueChange={(v: any) => setImportType(v)}>
                  <SelectTrigger className="h-12 rounded-xl font-bold bg-slate-50 border-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="sales" className="font-bold">Historique de Ventes</SelectItem>
                    <SelectItem value="clients" className="font-bold">Fichier Clients Seul</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2 rounded-[32px] border-none shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-[11px] font-black uppercase text-primary/60 tracking-widest">2. Fichier Source</CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div 
                className="flex flex-col items-center justify-center border-4 border-dashed border-slate-100 rounded-[32px] bg-slate-50/30 p-10 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".xlsx, .xls" 
                  onChange={handleFileChange} 
                />
                <div className="h-20 w-20 bg-primary/10 rounded-[24px] flex items-center justify-center mb-4 shadow-inner">
                  <FileSpreadsheet className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                  {file ? file.name : "Cliquez pour choisir votre fichier"}
                </h3>
                <p className="text-[10px] text-muted-foreground font-bold uppercase mt-2">Format : .xlsx ou .xls</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {data.length > 0 && (
          <Card className="rounded-[32px] border-none shadow-2xl bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-500">
            <CardHeader className="bg-primary text-white p-8">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-2xl font-black uppercase flex items-center gap-4 tracking-tighter">
                    <TableIcon className="h-8 w-8" /> Validation de l'import
                  </CardTitle>
                  <p className="text-white/60 font-black text-[10px] uppercase tracking-[0.3em] mt-2">
                    {data.length} lignes détectées.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                {currentFields.map(field => (
                  <div key={field.key} className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-primary tracking-[0.2em] flex justify-between items-center">
                      <span>{field.label}</span>
                      {mapping[field.key] ? (
                        <span className="flex items-center gap-1 text-green-600">Lié <CheckCircle2 className="h-3.5 w-3.5" /></span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-400">Non lié <AlertCircle className="h-3.5 w-3.5" /></span>
                      )}
                    </Label>
                    <Select 
                      value={mapping[field.key] || ""} 
                      onValueChange={(v) => setMapping({...mapping, [field.key]: v})}
                    >
                      <SelectTrigger className="h-14 rounded-2xl font-black text-slate-900 border-none bg-slate-50 shadow-inner px-6">
                        <SelectValue placeholder="Choisir la colonne..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {headers.map(h => <SelectItem key={h} value={h} className="font-black text-xs">{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="mt-12 space-y-8">
                {isProcessing && (
                  <div className="space-y-3">
                    <div className="flex justify-between text-[11px] font-black uppercase text-primary tracking-widest">
                      <span>Importation en cours...</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-4" />
                  </div>
                )}

                <Button 
                  onClick={handleImport} 
                  disabled={isProcessing || Object.keys(mapping).length < 2}
                  className="w-full h-16 rounded-[24px] font-black text-lg shadow-2xl bg-primary hover:bg-primary/90 transition-all"
                >
                  {isProcessing ? "TRAITEMENT..." : "LANCER L'IMPORTATION"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
