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
import { ShoppingBag, Save, Printer, Percent, Coins, ChevronDown } from "lucide-react";
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
      <div className="space-y-4 max-w-5xl mx-auto">
        {/* Header Compact */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-4 rounded-lg border shadow-sm">
          <div>
            <h1 className="text-xl font-bold text-primary leading-none">Nouvelle Vente</h1>
            <p className="text-xs text-muted-foreground mt-1">Saisie rapide client & ordonnance.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={handlePrint} className="flex-1 sm:flex-none h-9 text-xs">
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Imprimer
            </Button>
            <Button size="sm" onClick={handleSave} className="flex-1 sm:flex-none h-9 text-xs">
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Enregistrer
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Infos Client Compactes */}
            <Card className="shadow-sm">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-accent" />
                  Informations Client
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="clientName" className="text-[11px] uppercase text-muted-foreground font-bold">Nom complet</Label>
                    <Input 
                      id="clientName" 
                      placeholder="M. Mohamed Alami" 
                      className="h-9 text-sm"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="clientPhone" className="text-[11px] uppercase text-muted-foreground font-bold">Téléphone</Label>
                    <Input 
                      id="clientPhone" 
                      placeholder="06 00 00 00 00" 
                      className="h-9 text-sm"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] uppercase text-muted-foreground font-bold">Mutuelle</Label>
                    <Select onValueChange={setMutuelle} defaultValue="Aucun">
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Sélectionnez" />
                      </SelectTrigger>
                      <SelectContent>
                        {MUTUELLES.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {mutuelle === "Autre" && (
                    <div className="space-y-1">
                      <Label htmlFor="autreMutuelle" className="text-[11px] uppercase text-muted-foreground font-bold">Préciser</Label>
                      <Input id="autreMutuelle" className="h-9 text-sm" placeholder="Nom de la mutuelle..." />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Prescription Compacte */}
            <Card className="shadow-sm">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Prescription (OD / OG)</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <PrescriptionForm 
                  od={prescription.od} 
                  og={prescription.og} 
                  onChange={handlePrescriptionChange} 
                />
              </CardContent>
            </Card>

            {/* Détails Techniques - Collapsible sur mobile pour gagner de la place */}
            <Collapsible className="border rounded-lg bg-card shadow-sm">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full flex justify-between px-4 py-3 h-auto hover:bg-transparent">
                  <span className="text-sm font-semibold">Détails Monture & Verres</span>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="p-4 pt-0 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] uppercase text-muted-foreground font-bold">Monture</Label>
                    <Input className="h-9 text-sm" placeholder="Modèle, Couleur..." />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] uppercase text-muted-foreground font-bold">Verres</Label>
                    <Input className="h-9 text-sm" placeholder="Type, Traitement..." />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] uppercase text-muted-foreground font-bold">Notes</Label>
                  <Textarea className="text-sm min-h-[60px]" placeholder="Observations..." />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Facturation - Toujours visible et compacte */}
          <div className="space-y-4">
            <Card className="shadow-md border-primary/20 sticky top-4">
              <CardHeader className="py-3 px-4 bg-primary/5">
                <CardTitle className="text-sm font-bold text-primary">Récapitulatif Financier</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold">TOTAL BRUT</Label>
                    <div className="relative">
                      <Input 
                        className="w-28 h-8 text-right font-bold pr-7" 
                        type="number" 
                        value={total} 
                        onChange={(e) => setTotal(Number(e.target.value))}
                      />
                      <span className="absolute right-2 top-1.5 text-[10px] font-bold opacity-30">DH</span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 pt-2 border-t border-dashed">
                    <div className="flex justify-between items-center">
                      <Label className="text-destructive text-[11px] font-black uppercase">Remise</Label>
                      <Tabs 
                        value={discountType} 
                        onValueChange={(v) => setDiscountType(v as "percent" | "amount")}
                        className="h-7"
                      >
                        <TabsList className="h-7 grid grid-cols-2 w-16 p-0.5">
                          <TabsTrigger value="percent" className="text-[9px] h-6">%</TabsTrigger>
                          <TabsTrigger value="amount" className="text-[9px] h-6">DH</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] text-muted-foreground italic">
                        {discountType === "percent" ? `Soit -${formatCurrency(remiseAmount)}` : "Montant fixe"}
                      </span>
                      <div className="relative">
                        <Input 
                          className="w-28 h-8 text-right text-destructive font-black" 
                          type="number" 
                          min="0"
                          value={discountValue} 
                          onChange={(e) => setDiscountValue(Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-primary/5 p-2 rounded border border-primary/10">
                    <Label className="text-xs font-black">TOTAL NET</Label>
                    <span className="font-black text-sm">{formatCurrency(totalNet)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2">
                    <Label className="text-green-600 text-[11px] font-black uppercase">Avance</Label>
                    <div className="relative">
                      <Input 
                        className="w-28 h-8 text-right text-green-700 font-black" 
                        type="number" 
                        value={avance} 
                        onChange={(e) => setAvance(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="bg-slate-900 text-white p-3 rounded-lg flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-wider opacity-70">Reste à Payer</span>
                    <span className="text-lg font-black">{formatCurrency(resteAPayer)}</span>
                  </div>
                </div>

                <div className="pt-4 mt-2 border-t border-dashed">
                  <h4 className="text-[9px] font-black uppercase text-muted-foreground mb-2">Section Achat (Admin)</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Input className="h-7 text-[10px] text-right" placeholder="Achat Verres" type="number" />
                    <Input className="h-7 text-[10px] text-right" placeholder="Achat Monture" type="number" />
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
