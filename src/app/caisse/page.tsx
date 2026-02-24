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
  const [isOpeningDialogOpen, setIsOpeningDialogOpen] = useState(false);
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

  const handleOpenSession = () => {
    // Fermeture immédiate du dialogue
    setIsOpeningDialogOpen(false);
    setIsSessionOpen(true);
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
            <h1 className="text-2xl font-bold text-primary">Gestion de la Caisse</h1>
            <p className="text-sm text-muted-foreground">Suivi des flux financiers en temps réel.</p>
          </div>
          
          {!isSessionOpen ? (
            <Dialog open={isOpeningDialogOpen} onOpenChange={setIsOpeningDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary w-full md:w-auto h-10 font-bold">
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
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Solde Initial (DH)</Label>
                    <Input type="number" className="h-11 text-lg font-black" value={soldeInitial} onChange={(e) => setSoldeInitial(Number(e.target.value))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleOpenSession} className="w-full h-11 text-base font-bold">Confirmer l'Ouverture</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-destructive text-destructive h-10 w-full md:w-auto font-bold hover:bg-destructive/5">
                  <LogOut className="mr-2 h-4 w-4" />
                  Clôturer la Journée
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-base md:text-lg">Clôture & Comptage des Espèces</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-2 border-b pb-1.5">
                      <Coins className="h-3.5 w-3.5" />
                      Détail des Billets/Pièces
                    </h3>
                    <div className="space-y-1.5">
                      {DENOMINATIONS.map(val => (
                        <div key={val} className="grid grid-cols-[60px_15px_1fr_90px] items-center gap-1.5">
                          <div className="text-right font-black text-xs">{val} DH</div>
                          <div className="text-muted-foreground text-[10px] text-center">x</div>
                          <Input 
                            type="number" 
                            className="h-8 text-center text-xs font-bold" 
                            value={denoms[val]}
                            onChange={(e) => handleUpdateDenom(val, e.target.value)}
                          />
                          <div className="text-right text-xs font-black whitespace-nowrap text-primary/80">
                            {formatCurrency(val * (denoms[val] || 0))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-3 border-t bg-primary/5 p-4 rounded-xl border border-primary/10">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-[10px] uppercase tracking-wider">Total Compté :</span>
                        <span className="text-xl font-black text-primary">{formatCurrency(soldeReel)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 border-t md:border-t-0 md:border-l pt-6 md:pt-0 md:pl-8">
                    <h3 className="text-[10px] font-black uppercase text-muted-foreground border-b pb-1.5">Résumé Comptable</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Initial:</span>
                        <span className="font-bold">{formatCurrency(soldeInitial)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-green-600">
                        <span className="text-muted-foreground">Ventes:</span>
                        <span className="font-black">+{formatCurrency(totalVentes)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-destructive">
                        <span className="text-muted-foreground">Dépenses:</span>
                        <span className="font-black">-{formatCurrency(totalDepenses)}</span>
                      </div>
                      <div className="pt-2 border-t-2 border-primary/20 font-black text-primary flex justify-between items-center">
                        <span className="text-[10px] uppercase">Théorique:</span>
                        <span className="text-lg">{formatCurrency(soldeTheorique)}</span>
                      </div>
                    </div>

                    <div className={cn(
                      "mt-6 p-4 rounded-xl border-2 text-center shadow-inner",
                      soldeReel - soldeTheorique === 0 ? "border-green-200 bg-green-50" : "border-destructive/20 bg-destructive/5"
                    )}>
                      <p className="text-[9px] uppercase font-black text-muted-foreground mb-1 tracking-widest">Écart de Caisse</p>
                      <p className={cn("text-2xl font-black", soldeReel - soldeTheorique >= 0 ? "text-green-600" : "text-destructive")}>
                        {soldeReel - soldeTheorique >= 0 ? "+" : ""}{formatCurrency(soldeReel - soldeTheorique)}
                      </p>
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex flex-col sm:flex-row gap-2 border-t pt-6">
                  <Button className="w-full h-11 text-base font-bold shadow-lg" onClick={handleCloturerEtImprimer}>
                    <Printer className="mr-2 h-5 w-5" />
                    Valider & Imprimer le Rapport
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-primary text-primary-foreground p-5 rounded-2xl shadow-lg border-none">
            <p className="text-[10px] uppercase font-black opacity-70 mb-1 tracking-widest">Solde Théorique</p>
            <p className="text-2xl font-black">{formatCurrency(soldeTheorique)}</p>
          </Card>
          <Card className="border-l-4 border-l-green-500 p-5 rounded-2xl shadow-sm bg-card">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1 tracking-widest">Entrées (Ventes)</p>
            <p className="text-2xl font-black text-green-600">{formatCurrency(totalVentes + totalApports)}</p>
          </Card>
          <Card className="border-l-4 border-l-destructive p-5 rounded-2xl shadow-sm bg-card">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-1 tracking-widest">Sorties (Dépenses)</p>
            <p className="text-2xl font-black text-destructive">-{formatCurrency(totalDepenses)}</p>
          </Card>
        </div>

        <Card className="border-none shadow-sm overflow-hidden rounded-2xl">
          <CardHeader className="p-4 border-b bg-muted/20">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Derniers Flux de Caisse</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-[11px] uppercase font-bold px-4 py-3">Heure</TableHead>
                    <TableHead className="text-[11px] uppercase font-bold px-4 py-3">Désignation</TableHead>
                    <TableHead className="text-right text-[11px] uppercase font-bold px-4 py-3">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id} className="border-b last:border-0 hover:bg-muted/10">
                      <TableCell className="text-xs text-muted-foreground px-4 py-4">{t.date}</TableCell>
                      <TableCell className="text-xs font-bold px-4 py-4 truncate max-w-[150px]">{t.label}</TableCell>
                      <TableCell className={cn("text-right text-xs font-black px-4 py-4", t.montant > 0 ? "text-green-600" : "text-destructive")}>
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