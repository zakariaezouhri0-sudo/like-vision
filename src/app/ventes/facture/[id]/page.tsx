"use client";

import { useSearchParams, useParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Eye } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

export default function InvoicePrintPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const shop = DEFAULT_SHOP_SETTINGS;

  const clientName = searchParams.get("client") || "Client de passage";
  const clientPhone = searchParams.get("phone") || "---";
  const date = searchParams.get("date") || new Date().toLocaleDateString("fr-FR");
  const invoiceNo = params.id as string || "OPT-2024-XXX";
  const mutuelle = searchParams.get("mutuelle") || "Aucune";
  const total = Number(searchParams.get("total")) || 0;
  const avance = Number(searchParams.get("avance")) || 0;
  const reste = total - avance;

  const od = {
    sph: searchParams.get("od_sph") || "---",
    cyl: searchParams.get("od_cyl") || "---",
    axe: searchParams.get("od_axe") || "---"
  };
  const og = {
    sph: searchParams.get("og_sph") || "---",
    cyl: searchParams.get("og_cyl") || "---",
    axe: searchParams.get("og_axe") || "---"
  };

  const InvoiceCopy = () => (
    <div className="pdf-a5-section flex flex-col h-[148.5mm] overflow-hidden p-[8mm] relative bg-white">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 bg-slate-100 border rounded-lg flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase">
            LOGO
          </div>
          <div>
            <h2 className="text-base font-bold text-primary leading-tight">{shop.name}</h2>
            <p className="text-[9px] text-slate-600 max-w-[200px] leading-tight">{shop.address}</p>
            <p className="text-[9px] text-slate-600">Tél: {shop.phone}</p>
            <p className="text-[9px] font-bold mt-0.5 text-primary">ICE: {shop.icePatent}</p>
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-sm font-black uppercase underline tracking-tighter mb-0.5">Facture / Bon de Commande</h1>
          <p className="text-[11px] font-bold bg-slate-100 px-2 py-0.5 rounded inline-block">N°: {invoiceNo}</p>
          <p className="text-[9px] text-slate-600 mt-0.5">Date: {date}</p>
        </div>
      </div>

      {/* Client Info */}
      <div className="grid grid-cols-3 gap-2 mb-3 border-y border-slate-200 py-1.5">
        <div>
          <p className="text-[8px] uppercase text-slate-500 font-bold mb-0.5">Client</p>
          <p className="text-[10px] font-bold truncate">{clientName}</p>
        </div>
        <div>
          <p className="text-[8px] uppercase text-slate-500 font-bold mb-0.5">Téléphone</p>
          <p className="text-[10px] font-bold">{clientPhone}</p>
        </div>
        <div>
          <p className="text-[8px] uppercase text-slate-500 font-bold mb-0.5">Mutuelle</p>
          <p className="text-[10px] font-bold">{mutuelle}</p>
        </div>
      </div>

      {/* Prescription Grid */}
      <div className="mb-3">
        <h3 className="text-[8px] font-bold uppercase mb-1 text-slate-500">Détails de la Prescription</h3>
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-300 p-1 text-left text-[8px] uppercase">Oeil</th>
              <th className="border border-slate-300 p-1 text-center text-[8px] uppercase">Sphère</th>
              <th className="border border-slate-300 p-1 text-center text-[8px] uppercase">Cylindre</th>
              <th className="border border-slate-300 p-1 text-center text-[8px] uppercase">Axe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-300 p-1 font-bold text-[9px]">Oeil Droit (OD)</td>
              <td className="border border-slate-300 p-1 text-center">{od.sph}</td>
              <td className="border border-slate-300 p-1 text-center">{od.cyl}</td>
              <td className="border border-slate-300 p-1 text-center">{od.axe}</td>
            </tr>
            <tr>
              <td className="border border-slate-300 p-1 font-bold text-[9px]">Oeil Gauche (OG)</td>
              <td className="border border-slate-300 p-1 text-center">{og.sph}</td>
              <td className="border border-slate-300 p-1 text-center">{og.cyl}</td>
              <td className="border border-slate-300 p-1 text-center">{og.axe}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Financials & Footer */}
      <div className="flex justify-between items-end mt-auto pt-2">
        {/* Left Side: Financials */}
        <div className="w-1/2 space-y-0.5">
          <div className="flex justify-between text-[9px] text-slate-600">
            <span>Total TTC:</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between text-[9px] text-green-700">
            <span>Acompte:</span>
            <span>{formatCurrency(avance)}</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-slate-200 mt-0.5">
            <span className="text-[10px] font-black uppercase">Reste à payer:</span>
            <span className="text-sm font-black text-primary">{formatCurrency(reste)}</span>
          </div>
          <div className="mt-4">
            <p className="text-[8px] font-bold underline mb-3">Signature Client :</p>
          </div>
        </div>
        
        {/* Right Side: Stamp */}
        <div className="w-1/3 flex flex-col items-center">
          <div className="w-full h-16 border-2 border-primary/20 rounded-md flex items-center justify-center relative bg-slate-50/50">
            <span className="text-[8px] uppercase text-slate-300 font-bold rotate-[-12deg] text-center px-4">Cachet du Magasin</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-200 flex flex-col items-center py-8">
      {/* Controls */}
      <div className="no-print w-[210mm] flex justify-between mb-4">
        <Button variant="outline" asChild className="bg-white">
          <Link href="/ventes/nouvelle">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Link>
        </Button>
        <Button onClick={() => window.print()} className="bg-primary shadow-lg">
          <Printer className="mr-2 h-4 w-4" />
          Imprimer (A4 Portrait)
        </Button>
      </div>

      {/* Page Content (A4 Portrait) */}
      <div className="pdf-a4 shadow-2xl overflow-hidden print:shadow-none bg-white">
        <InvoiceCopy />
        <div className="relative h-0">
          <div className="absolute top-0 left-0 w-full border-t border-dashed border-slate-400 z-10" />
        </div>
        <InvoiceCopy />
      </div>

      <div className="no-print mt-8 text-slate-600 text-sm flex items-center gap-2 font-medium">
        <Eye className="h-4 w-4" />
        Note : 2 exemplaires sur une page A4.
      </div>
    </div>
  );
}
