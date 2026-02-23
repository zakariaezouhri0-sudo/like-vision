"use client";

import { useSearchParams, useParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Eye } from "lucide-react";
import Link from "next/link";

export default function InvoicePrintPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const shop = DEFAULT_SHOP_SETTINGS;

  // Mock data or from URL params
  const clientName = searchParams.get("client") || "M. Ahmed Mansour";
  const date = searchParams.get("date") || new Date().toLocaleDateString("fr-FR");
  const invoiceNo = params.id as string || "OPT-2024-001";
  const mutuelle = searchParams.get("mutuelle") || "CNSS";
  const total = Number(searchParams.get("total")) || 1500;
  const avance = Number(searchParams.get("avance")) || 500;
  const reste = total - avance;

  const od = {
    sph: searchParams.get("od_sph") || "+1.25",
    cyl: searchParams.get("od_cyl") || "-0.50",
    axe: searchParams.get("od_axe") || "90°"
  };
  const og = {
    sph: searchParams.get("og_sph") || "+1.00",
    cyl: searchParams.get("og_cyl") || "-0.75",
    axe: searchParams.get("og_axe") || "85°"
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).replace(",", ",") + " DH";
  };

  const InvoiceCopy = () => (
    <div className="pdf-a5-section flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 bg-slate-100 border rounded flex items-center justify-center text-[10px] text-slate-400">
            LOGO
          </div>
          <div>
            <h2 className="text-xl font-bold text-primary">{shop.name}</h2>
            <p className="text-xs text-slate-600 max-w-[200px]">{shop.address}</p>
            <p className="text-xs text-slate-600">Tél: {shop.phone}</p>
            <p className="text-xs font-semibold mt-1">ICE: {shop.icePatent}</p>
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-lg font-bold uppercase underline">Facture</h1>
          <p className="text-sm font-bold">N°: {invoiceNo}</p>
          <p className="text-xs text-slate-600">Date: {date}</p>
        </div>
      </div>

      {/* Client Info */}
      <div className="grid grid-cols-2 gap-4 mb-6 border-y py-3">
        <div>
          <p className="text-[10px] uppercase text-slate-500 font-bold">Client</p>
          <p className="text-sm font-bold">{clientName}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-500 font-bold">Mutuelle</p>
          <p className="text-sm font-bold">{mutuelle}</p>
        </div>
      </div>

      {/* Prescription Grid */}
      <div className="mb-6">
        <h3 className="text-xs font-bold uppercase mb-2 border-b">Prescription (Correction)</h3>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="border p-1 text-left text-xs">Oeil</th>
              <th className="border p-1 text-center text-xs">Sphère</th>
              <th className="border p-1 text-center text-xs">Cylindre</th>
              <th className="border p-1 text-center text-xs">Axe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-1 font-bold text-xs">Oeil Droit (OD)</td>
              <td className="border p-1 text-center">{od.sph}</td>
              <td className="border p-1 text-center">{od.cyl}</td>
              <td className="border p-1 text-center">{od.axe}</td>
            </tr>
            <tr>
              <td className="border p-1 font-bold text-xs">Oeil Gauche (OG)</td>
              <td className="border p-1 text-center">{og.sph}</td>
              <td className="border p-1 text-center">{og.cyl}</td>
              <td className="border p-1 text-center">{og.axe}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Financials & Stamp */}
      <div className="mt-auto grid grid-cols-2 gap-8 items-end">
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>Total Vente:</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between text-xs text-green-700">
            <span>Avance:</span>
            <span>{formatCurrency(avance)}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t mt-2">
            <span className="text-sm font-bold uppercase">Reste à payer:</span>
            <span className="text-lg font-black text-primary">{formatCurrency(reste)}</span>
          </div>
        </div>
        
        <div className="flex flex-col items-center">
          <div className="w-40 h-24 border-2 border-dashed border-slate-300 rounded flex items-center justify-center relative">
            <span className="text-[10px] uppercase text-slate-300 font-bold rotate-[-15deg]">Cachet du Magasin</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Signature & Cachet</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-8">
      {/* Controls */}
      <div className="no-print w-[210mm] flex justify-between mb-4">
        <Button variant="outline" asChild>
          <Link href="/ventes/nouvelle">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Link>
        </Button>
        <Button onClick={() => window.print()} className="bg-primary">
          <Printer className="mr-2 h-4 w-4" />
          Lancer l'impression (A4)
        </Button>
      </div>

      {/* Page Content */}
      <div className="pdf-a4 shadow-2xl overflow-hidden print:shadow-none">
        <InvoiceCopy />
        <div className="cutting-line no-print" />
        <InvoiceCopy />
      </div>

      <div className="no-print mt-8 text-slate-500 text-sm flex items-center gap-2">
        <Eye className="h-4 w-4" />
        Conseil : Utilisez l'option "Enregistrer au format PDF" dans les paramètres d'impression.
      </div>
    </div>
  );
}