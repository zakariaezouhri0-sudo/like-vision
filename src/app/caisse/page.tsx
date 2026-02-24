"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Wallet, LogOut, ArrowUpRight, ArrowDownRight, Printer, Coins } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { cn, formatCurrency } from "@/lib/utils";

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1];

export default function CaissePage() {
  const router = useRouter();
  const [isSessionOpen, setIsSessionOpen] = useState(true);
  const [soldeInitial, setSoldeInitial] = useState(500);
  
  const [denoms, setDenoms] = useState<Record<number, number>>({
    200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0
  });

  const soldeReel = useMemo(() => {
    return Object.entries(denoms).reduce((acc, [val, qty]) => acc + (Number(val) * qty), 0);
  }, [denoms]);

  const [transactions] = useState([
    { id: 1, type: "VENTE", label: "Vente OPT-2024-001", montant: 1200, date: "10:30" },
    { id: 2, type: "DEPENSE", label: "Achat Fournitures", montant: -150, date: "11:15" },
    { id: 3, type: "APPORT", label: "Fonds de roulement", montant: 200, date: "14:00" },
    { id: 4, type: "VENTE", label: "Vente OPT-2024-002", montant: 850, date: "15:45" },
  ]);

  const totalVentes = transactions.filter(t => t.type === "VENTE").reduce((acc, t) => acc + t.montant, 0);
  const totalDepenses = transactions.filter(t => t.type === "DEPENSE").reduce((acc, t) => acc + Math.abs(t.montant), 0);
  const totalApports = transactions.filter(t => t.type === "APPORT").reduce((acc, t) => acc + t.montant, 0);
  const soldeTheorique = soldeInitial + totalVentes + totalApports - totalDepenses;

  const handleUpdateDenom = (val: number, qty: string) => {
    setDenoms(prev => ({ ...prev, [val]: Number(qty) || 0 }));
  };

  const handleCloturerEtImprimer = () => {
    const params = new URLSearchParams({
      date: new Date().toLocaleDateString("fr-FR"),
      initial: soldeInitial.toString(),
      ventes: totalVentes.toString(),
      depenses: totalDepenses.toString(),
      apports: totalApports.toString(),
      reel: soldeReel.toString(),
    });
    
    Object.entries(denoms).forEach(([val, qty]) => {
      params.append(`d${val}`, qty.toString());
    });

    router.push(`/rapports/print/cloture?${params.toString()}`);
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-primary">Gestion de la Caisse</h1>
            <p className="text-[10px] md:text-sm text-muted-foreground">Suivi des flux financiers.</p>
          </div>
          
          {!isSessionOpen ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary w-full md:w-auto h-9">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Ouvrir la Caisse
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Ouverture de Session</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Solde Initial (DH)</Label>
                    <Input type="number" value={soldeInitial} onChange={(e) => setSoldeInitial(Number(e.target.value))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => setIsSessionOpen(true)} className="w-full">Confirmer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-destructive text-destructive h-9 w-full md:w-auto">
                  <LogOut className="mr-2 h-4 w-4" />
                  Clôturer
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-sm md:text-lg">Clôture & Comptage</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 py-2">
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 border-b pb-1">
                      <Coins className="h-3 w-3" />
                      Détail Espèces
                    </h3>
                    <div className="space-y-1.5">
                      {DENOMINATIONS.map(val => (
                        <div key={val} className="grid grid-cols-[50px_15px_1fr_80px] items-center gap-1">
                          <div className="text-right font-bold text-[10px]">{val} DH</div>
                          <div className="text-muted-foreground text-[10px] text-center">x</div>
                          <Input 
                            type="number" 
                            className="h-7 text-center text-xs" 
                            value={denoms[val]}
                            onChange={(e) => handleUpdateDenom(val, e.target.value)}
                          />
                          <div className="text-right text-[10px] font-medium whitespace-nowrap">
                            {formatCurrency(val * (denoms[val] || 0))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-2 border-t bg-primary/5 p-3 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[10px]">TOTAL COMPTÉ :</span>
                        <span className="text-lg font-black text-primary">{formatCurrency(soldeReel)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-6">
                    <h3 className="text-[10px] font-black uppercase text-muted-foreground border-b pb-1">Résumé Comptable</h3>
                    <div className="space-y-2 text-[10px]">
                      <div className="flex justify-between">
                        <span>Initial:</span>
                        <span className="font-medium">{formatCurrency(soldeInitial)}</span>
                      </div>
                      <div className="flex justify-between text-green-600">
                        <span>Ventes:</span>
                        <span className="font-bold">+{formatCurrency(totalVentes)}</span>
                      </div>
                      <div className="flex justify-between text-destructive">
                        <span>Dépenses:</span>
                        <span className="font-bold">-{formatCurrency(totalDepenses)}</span>
                      </div>
                      <div className="pt-2 border-t font-black text-primary flex justify-between">
                        <span>THÉORIQUE:</span>
                        <span>{formatCurrency(soldeTheorique)}</span>
                      </div>
                    </div>

                    <div className={cn(
                      "mt-4 p-3 rounded-lg border-2 text-center",
                      soldeReel - soldeTheorique === 0 ? "border-green-200 bg-green-50" : "border-destructive/20 bg-destructive/5"
                    )}>
                      <p className="text-[8px] uppercase font-bold text-muted-foreground mb-1">Écart</p>
                      <p className={cn("text-xl font-black", soldeReel - soldeTheorique >= 0 ? "text-green-600" : "text-destructive")}>
                        {soldeReel - soldeTheorique >= 0 ? "+" : ""}{formatCurrency(soldeReel - soldeTheorique)}
                      </p>
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex flex-col sm:flex-row gap-2 border-t pt-4">
                  <Button className="w-full" onClick={handleCloturerEtImprimer}>
                    <Printer className="mr-2 h-4 w-4" />
                    Valider & Imprimer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-primary text-primary-foreground p-4">
            <p className="text-[10px] uppercase font-bold opacity-70">Solde Théorique</p>
            <p className="text-2xl font-black">{formatCurrency(soldeTheorique)}</p>
          </Card>
          <Card className="border-l-4 border-l-green-500 p-4">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Entrées</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalVentes + totalApports)}</p>
          </Card>
          <Card className="border-l-4 border-l-destructive p-4">
            <p className="text-[10px] uppercase font-bold text-muted-foreground">Sorties</p>
            <p className="text-xl font-bold text-destructive">-{formatCurrency(totalDepenses)}</p>
          </Card>
        </div>

        <Card className="border-none shadow-sm overflow-hidden">
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-sm font-bold uppercase tracking-wider">Derniers Flux</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-xs uppercase font-bold whitespace-nowrap px-4 py-3">Heure</TableHead>
                    <TableHead className="text-xs uppercase font-bold whitespace-nowrap px-4 py-3">Désignation</TableHead>
                    <TableHead className="text-right text-xs uppercase font-bold whitespace-nowrap px-4 py-3">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id} className="border-b last:border-0 hover:bg-muted/10">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap px-4 py-4">{t.date}</TableCell>
                      <TableCell className="text-xs font-medium whitespace-nowrap truncate max-w-[150px] px-4 py-4">{t.label}</TableCell>
                      <TableCell className={cn("text-right text-xs font-bold whitespace-nowrap px-4 py-4", t.montant > 0 ? "text-green-600" : "text-destructive")}>
                        {formatCurrency(t.montant)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
