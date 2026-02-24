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
            <Button onClick={() => setIsOpeningDialogOpen(true)} className="bg-primary w-full md:w-auto h-12 font-black shadow-xl rounded-xl">
              <PlusCircle className="mr-2 h-5 w-5" />
              OUVRIR LA CAISSE
            </Button>
          ) : (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-destructive text-destructive h-12 w-full md:w-auto font-black shadow-sm hover:bg-destructive/5 rounded-xl">
                  <LogOut className="mr-2 h-5 w-5" />
                  CLÔTURER LA JOURNÉE
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black text-primary uppercase text-center md:text-left">Clôture & Comptage</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
                  <div className="space-y-5">
                    <h3 className="text-xs font-black uppercase text-muted-foreground flex items-center gap-2 border-b pb-2">
                      <Coins className="h-4 w-4" />
                      Détail des Espèces
                    </h3>
                    <div className="space-y-2">
                      {DENOMINATIONS.map(val => (
                        <div key={val} className="grid grid-cols-[80px_15px_1fr_100px] items-center gap-2">
                          <div className="text-right font-black text-sm text-slate-700">{val} DH</div>
                          <div className="text-muted-foreground text-xs text-center font-bold">x</div>
                          <Input 
                            type="number" 
                            className="h-10 text-center text-sm font-black rounded-lg" 
                            value={denoms[val]}
                            onChange={(e) => handleUpdateDenom(val, e.target.value)}
                          />
                          <div className="text-right text-sm font-black text-primary/80">
                            {formatCurrency(val * (denoms[val] || 0))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4 border-t bg-primary/5 p-5 rounded-2xl border border-primary/10 shadow-inner">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-xs uppercase tracking-widest text-primary/60">Total Compté :</span>
                        <span className="text-2xl font-black text-primary">{formatCurrency(soldeReel)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 border-t md:border-t-0 md:border-l pt-8 md:pt-0 md:pl-10">
                    <h3 className="text-xs font-black uppercase text-muted-foreground border-b pb-2">Résumé Comptable</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm font-medium">
                        <span className="text-muted-foreground">Solde Initial:</span>
                        <span className="font-bold">{formatCurrency(soldeInitial)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-black text-green-600">
                        <span className="text-muted-foreground font-medium">Ventes Totales:</span>
                        <span>+{formatCurrency(totalVentes)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-black text-destructive">
                        <span className="text-muted-foreground font-medium">Dépenses:</span>
                        <span>-{formatCurrency(totalDepenses)}</span>
                      </div>
                      <div className="pt-4 border-t-2 border-primary/20 font-black text-primary flex justify-between items-center">
                        <span className="text-xs uppercase">Théorique:</span>
                        <span className="text-xl">{formatCurrency(soldeTheorique)}</span>
                      </div>
                    </div>

                    <div className={cn(
                      "mt-8 p-6 rounded-2xl border-2 text-center shadow-lg transform scale-105 transition-all",
                      soldeReel - soldeTheorique === 0 ? "border-green-200 bg-green-50" : "border-destructive/20 bg-destructive/5"
                    )}>
                      <p className="text-[10px] uppercase font-black text-muted-foreground mb-1 tracking-[0.2em]">Écart de Caisse</p>
                      <p className={cn("text-3xl font-black", soldeReel - soldeTheorique >= 0 ? "text-green-600" : "text-destructive")}>
                        {soldeReel - soldeTheorique >= 0 ? "+" : ""}{formatCurrency(soldeReel - soldeTheorique)}
                      </p>
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex flex-col sm:flex-row gap-3 border-t pt-8">
                  <Button className="w-full h-14 text-lg font-black shadow-xl rounded-xl" onClick={handleCloturerEtImprimer}>
                    <Printer className="mr-3 h-6 w-6" />
                    VALIDER & IMPRIMER
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card className="bg-primary text-primary-foreground p-6 rounded-[24px] shadow-xl border-none">
            <p className="text-[10px] uppercase font-black opacity-70 mb-2 tracking-[0.2em]">Solde Théorique</p>
            <p className="text-3xl font-black">{formatCurrency(soldeTheorique)}</p>
          </Card>
          <Card className="border-l-[10px] border-l-green-500 p-6 rounded-[24px] shadow-lg bg-card border-none">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-2 tracking-[0.2em]">Entrées (Ventes)</p>
            <p className="text-3xl font-black text-green-600">{formatCurrency(totalVentes + totalApports)}</p>
          </Card>
          <Card className="border-l-[10px] border-l-destructive p-6 rounded-[24px] shadow-lg bg-card border-none">
            <p className="text-[10px] uppercase font-black text-muted-foreground mb-2 tracking-[0.2em]">Sorties (Dépenses)</p>
            <p className="text-3xl font-black text-destructive">-{formatCurrency(totalDepenses)}</p>
          </Card>
        </div>

        <Card className="border-none shadow-sm overflow-hidden rounded-2xl">
          <CardHeader className="p-5 border-b bg-muted/20">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Derniers Flux de Caisse</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-xs uppercase font-black px-6 py-4">Heure</TableHead>
                    <TableHead className="text-xs uppercase font-black px-6 py-4">Désignation</TableHead>
                    <TableHead className="text-right text-xs uppercase font-black px-6 py-4">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id} className="border-b last:border-0 hover:bg-muted/10 transition-colors">
                      <TableCell className="text-sm font-medium text-muted-foreground px-6 py-5">{t.date}</TableCell>
                      <TableCell className="text-sm font-black text-slate-800 px-6 py-5">{t.label}</TableCell>
                      <TableCell className={cn("text-right text-sm font-black px-6 py-5", t.montant > 0 ? "text-green-600" : "text-destructive")}>
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
