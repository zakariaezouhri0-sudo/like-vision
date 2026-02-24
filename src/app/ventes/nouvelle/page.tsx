"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrescriptionForm } from "@/components/optical/prescription-form";
import { MUTUELLES } from "@/lib/constants";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ShoppingBag, Save, Printer, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { AppShell } from "@/components/layout/app-shell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function NewSalePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [mutuelle, setMutuelle] = useState("Aucun");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [total, setTotal] = useState(0);
  
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [avance, setAvance] = useState(0);
  
  const [prescription, setPrescription] = useState({
    od: { sph: "", cyl: "", axe: "" },
    og: { sph: "", cyl: "", axe: "" }
  });

  const remiseAmount = discountType === "percent" 
    ? (total * discountValue) / 100 
    : discountValue;

  const totalNet = total - remiseAmount;
  const resteAPayer = totalNet - avance;

  const handlePrescriptionChange = (side: "OD" | "OG", field: string, value: string) => {
    setPrescription(prev => ({
      ...prev,
      [side.toLowerCase()]: {
        ...prev[side.toLowerCase() as keyof typeof prev],
        [field]: value
      }
    }));
  };

  const handleSave = () => {
    toast({
      variant: "success",
      title: "Vente Enregistrée",
      description: "La facture a été générée avec succès.",
    });
  };

  const handlePrint = () => {
    const params = new URLSearchParams({
      client: clientName || "Client de passage",
      phone: clientPhone || "---",
      mutuelle,
      total: total.toString(),
      remise: remiseAmount.toString(),
      remisePercent: discountType === "percent" ? discountValue.toString() : "Fixe",
      avance: avance.toString(),
      od_sph: prescription.od.sph,
      od_cyl: prescription.od.cyl,
      od_axe: prescription.od.axe,
      og_sph: prescription.og.sph,
      og_cyl: prescription.og.cyl,
      og_axe: prescription.og.axe,
      date: new Date().toLocaleDateString("fr-FR"),
    });
    router.push(`/ventes/facture/OPT-2024-NEW?${params.toString()}`);
  };

  return (
    <AppShell>
      <div className="space-y-4 max-w-5xl mx-auto pb-24 lg:pb-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-3 rounded-lg border shadow-sm">
          <div>
            <h1 className="text-lg font-bold text-primary">Nouvelle Vente</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase font-medium tracking-wider">Saisie client & ordonnance.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={handlePrint} className="flex-1 sm:flex-none h-9 text-[11px] font-bold">
              <Printer className="mr-1.5 h-4 w-4" />
              IMPRIMER
            </Button>
            <Button size="sm" onClick={handleSave} className="flex-1 sm:flex-none h-9 text-[11px] font-bold">
              <Save className="mr-1.5 h-4 w-4" />
              ENREGISTRER
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card className="shadow-sm border-none overflow-hidden">
              <CardHeader className="py-2.5 px-4 bg-muted/30 border-b">
                <CardTitle className="text-[10px] uppercase font-black text-muted-foreground flex items-center gap-2">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Informations Client
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-muted-foreground font-black">Nom & Prénom</Label>
                    <Input className="h-9 text-sm font-medium" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="M. Mohamed Alami" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-muted-foreground font-black">Téléphone</Label>
                    <Input className="h-9 text-sm font-medium" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="06 00 00 00 00" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase text-muted-foreground font-black">Couverture / Mutuelle</Label>
                  <Select onValueChange={setMutuelle} defaultValue="Aucun">
                    <SelectTrigger className="h-9 text-sm font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MUTUELLES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-none overflow-hidden">
              <CardHeader className="py-2.5 px-4 bg-muted/30 border-b">
                <CardTitle className="text-[10px] uppercase font-black text-muted-foreground">Prescription Optique</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <PrescriptionForm od={prescription.od} og={prescription.og} onChange={handlePrescriptionChange} />
              </CardContent>
            </Card>

            <Collapsible className="border-none rounded-lg bg-card shadow-sm overflow-hidden">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full flex justify-between px-4 py-3 h-auto hover:bg-muted/30 transition-all">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">Options Monture & Verres</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-4 pt-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-muted-foreground font-black">Monture</Label>
                    <Input className="h-9 text-sm" placeholder="Marque, Modèle..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase text-muted-foreground font-black">Verres</Label>
                    <Input className="h-9 text-sm" placeholder="Type, Traitement..." />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase text-muted-foreground font-black">Notes additionnelles</Label>
                  <Textarea className="text-sm min-h-[80px]" placeholder="Observations particulières..." />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <div className="space-y-4">
            <Card className="shadow-md border-primary/20 bg-primary/5 sticky top-20">
              <CardHeader className="py-3 px-4 bg-primary text-primary-foreground">
                <CardTitle className="text-xs font-black uppercase tracking-widest">Calcul Financier</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="flex justify-between items-center bg-white p-2 rounded-lg border">
                  <Label className="text-[10px] font-black uppercase text-muted-foreground">Total Brut</Label>
                  <div className="relative">
                    <Input className="w-28 h-9 text-right font-black pr-8 border-none focus-visible:ring-0" type="number" value={total} onChange={(e) => setTotal(Number(e.target.value))} />
                    <span className="absolute right-2 top-2.5 text-[8px] font-black opacity-30">DH</span>
                  </div>
                </div>
                
                <div className="space-y-2 pt-2 border-t border-dashed border-primary/20">
                  <div className="flex justify-between items-center">
                    <Label className="text-destructive text-[9px] font-black uppercase">Remise Client</Label>
                    <Tabs value={discountType} onValueChange={(v) => setDiscountType(v as "percent" | "amount")} className="h-7">
                      <TabsList className="h-7 grid grid-cols-2 w-16 p-1 bg-destructive/10">
                        <TabsTrigger value="percent" className="text-[10px] h-5">%</TabsTrigger>
                        <TabsTrigger value="amount" className="text-[10px] h-5">DH</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                  <div className="flex justify-end relative bg-white rounded-lg border border-destructive/20 overflow-hidden">
                    <Input className="w-full h-9 text-right text-destructive font-black pr-8 border-none focus-visible:ring-0" type="number" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value))} />
                    <span className="absolute right-2 top-2.5 text-[8px] font-black text-destructive/40">{discountType === 'percent' ? '%' : 'DH'}</span>
                  </div>
                  {discountType === 'percent' && (
                    <p className="text-right text-[9px] font-bold text-destructive/60">
                      = -{formatCurrency(remiseAmount)}
                    </p>
                  )}
                </div>

                <div className="flex justify-between items-center bg-primary/10 p-3 rounded-lg border border-primary/20">
                  <Label className="text-[10px] font-black uppercase text-primary">Total Net à payer</Label>
                  <span className="font-black text-sm text-primary">{formatCurrency(totalNet)}</span>
                </div>
                
                <div className="flex justify-between items-center pt-2 bg-white p-2 rounded-lg border">
                  <Label className="text-green-600 text-[10px] font-black uppercase">Avance Versée</Label>
                  <div className="relative">
                    <Input className="w-28 h-9 text-right text-green-700 font-black pr-8 border-none focus-visible:ring-0" type="number" value={avance} onChange={(e) => setAvance(Number(e.target.value))} />
                    <span className="absolute right-2 top-2.5 text-[8px] font-black text-green-700/40">DH</span>
                  </div>
                </div>
                
                <Separator className="bg-primary/20" />
                
                <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center shadow-lg transform scale-[1.02]">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Reste du</span>
                  <span className="text-xl font-black tracking-tight">{formatCurrency(resteAPayer)}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}