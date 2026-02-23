"use client";

import { useSearchParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, FileText, Calendar, User, Coins } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1];

export default function CashClosurePrintPage() {
  const searchParams = useSearchParams();
  const shop = DEFAULT_SHOP_SETTINGS;

  // Récupération des données passées en paramètres
  const date = searchParams.get("date") || new Date().toLocaleDateString("fr-FR");
  const initial = Number(searchParams.get("initial")) || 0;
  const ventes = Number(searchParams.get("ventes")) || 0;
  const depenses = Number(searchParams.get("depenses")) || 0;
  const apports = Number(searchParams.get("apports")) || 0;
  const reel = Number(searchParams.get("reel")) || 0;
  
  const theorique = initial + ventes + apports - depenses;
  const ecart = reel - theorique;

  // Récupération du détail des espèces
  const cashDetail = DENOMINATIONS.map(val => ({
    val,
    qty: Number(searchParams.get(`d${val}`)) || 0
  })).filter(item => item.qty > 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8">
      {/* Controls Overlay */}
      <div className="no-print w-[210mm] flex justify-between mb-6">
        <Button variant="outline" asChild className="bg-white hover:bg-slate-100">
          <Link href="/caisse">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la Caisse
          </Link>
        </Button>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-600">Format A4 Portrait</span>
          <Button onClick={() => window.print()} className="bg-primary shadow-lg hover:bg-primary/90">
            <Printer className="mr-2 h-4 w-4" />
            Imprimer le Rapport
          </Button>
        </div>
      </div>

      {/* Actual A4 Page */}
      <div className="pdf-a4-portrait shadow-2xl bg-white print:shadow-none print:m-0">
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-primary pb-6 mb-8">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-primary uppercase tracking-tight">{shop.name}</h1>
            <p className="text-sm text-slate-600 max-w-[300px] leading-tight">{shop.address}</p>
            <p className="text-sm text-slate-600">Tél: {shop.phone}</p>
            <p className="text-sm font-bold text-slate-900">ICE: {shop.icePatent}</p>
          </div>
          <div className="text-right flex flex-col items-end">
            <div className="bg-primary text-primary-foreground px-4 py-2 rounded mb-2">
              <h2 className="text-lg font-bold uppercase tracking-widest">Rapport de Clôture</h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="h-4 w-4" />
              <span>Date: {date}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <User className="h-4 w-4" />
              <span>Édité par: Administrateur</span>
            </div>
          </div>
        </div>

        {/* Financial Summary Grid */}
        <div className="grid grid-cols-2 gap-8 mb-10">
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase text-slate-400 border-b pb-1">Résumé des Flux</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Solde Initial :</span>
                <span className="font-medium">{formatCurrency(initial)}</span>
              </div>
              <div className="flex justify-between text-sm text-green-600">
                <span>Total Entrées (Ventes + Apports) :</span>
                <span className="font-medium">+{formatCurrency(ventes + apports)}</span>
              </div>
              <div className="flex justify-between text-sm text-destructive">
                <span>Total Sorties (Dépenses) :</span>
                <span className="font-medium">-{formatCurrency(depenses)}</span>
              </div>
              <div className="pt-2 border-t flex justify-between font-bold text-base">
                <span>Solde Théorique :</span>
                <span className="text-primary">{formatCurrency(theorique)}</span>
              </div>
            </div>

            {/* Écart de Caisse Visuel */}
            <div className={`mt-4 p-4 rounded border-2 text-center ${ecart === 0 ? 'border-green-100 bg-green-50' : 'border-destructive/10 bg-destructive/5'}`}>
              <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Écart de Caisse Final</p>
              <p className={`text-xl font-black ${ecart >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                {ecart >= 0 ? '+' : ''}{formatCurrency(ecart)}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-sm font-black uppercase text-slate-400 border-b pb-1 flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Détail des Espèces
            </h3>
            <div className="space-y-1">
              {cashDetail.length > 0 ? (
                cashDetail.map(item => (
                  <div key={item.val} className="flex justify-between text-xs border-b border-slate-100 py-1 last:border-0">
                    <span>{item.val} DH x {item.qty}</span>
                    <span className="font-medium">{formatCurrency(item.val * item.qty)}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">Aucun détail saisi.</p>
              )}
              <div className="flex justify-between items-center pt-3 border-t mt-3">
                <span className="text-sm font-bold">Total Compté :</span>
                <span className="text-lg font-black text-primary">{formatCurrency(reel)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="mb-12">
          <h3 className="text-sm font-black uppercase text-slate-400 mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Détail des Postes de Caisse
          </h3>
          <Table className="border">
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold text-slate-900">Description</TableHead>
                <TableHead className="text-right font-bold text-slate-900">Montant (DH)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Total des Ventes (Comptant + Avances)</TableCell>
                <TableCell className="text-right font-bold text-green-600">+{formatCurrency(ventes)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Apports de fonds / Versements</TableCell>
                <TableCell className="text-right font-bold">+{formatCurrency(apports)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Dépenses Magasin (Petite caisse)</TableCell>
                <TableCell className="text-right font-bold text-destructive">-{formatCurrency(depenses)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>

        {/* Footer Signatures */}
        <div className="mt-auto pt-10 border-t-2 border-slate-100 grid grid-cols-2 gap-12">
          <div className="space-y-16">
            <p className="text-xs font-bold uppercase text-slate-400">Signature de l'Opérateur</p>
            <div className="border-b border-dashed border-slate-300 w-48"></div>
          </div>
          <div className="space-y-16 text-right flex flex-col items-end">
            <p className="text-xs font-bold uppercase text-slate-400">Cachet & Validation Direction</p>
            <div className="w-[50mm] h-[30mm] border-2 border-dashed border-slate-200 rounded flex items-center justify-center bg-slate-50/50">
              <span className="text-[10px] text-slate-300 font-bold rotate-[-15deg] uppercase">Espace Cachet</span>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-[10px] text-slate-400 italic">VisionGere Optique Pro - Système de Gestion Certifié v1.0</p>
        </div>
      </div>
    </div>
  );
}
