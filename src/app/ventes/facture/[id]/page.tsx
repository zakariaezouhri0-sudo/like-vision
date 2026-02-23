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
    <div className="pdf-a5-section flex flex-col h-[148.5mm] overflow-hidden p-[6mm] relative bg-white border-b border-transparent">
      {/* Header Section */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-center text-[9px] text-slate-400 font-bold uppercase shrink-0">
            LOGO
          </div>
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-primary leading-tight">{shop.name}</h2>
            <p className="text-[9px] text-slate-600 max-w-[220px] leading-tight">{shop.address}</p>
            <p className="text-[9px] text-slate-600">Tél: {shop.phone}</p>
            <p className="text-[9px] font-bold text-slate-800">ICE: {shop.icePatent}</p>
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-lg font-black uppercase tracking-tighter mb-0.5 border-b-2 border-primary inline-block">Facture</h1>
          <p className="text-[10px] font-bold text-slate-900 mt-0.5">N°: {invoiceNo}</p>
          <p className="text-[9px] text-slate-600">Date: {date}</p>
        </div>
      </div>

      {/* Client Info Grid - Phone is now between Name and Mutuelle */}
      <div className="grid grid-cols-3 gap-2 mb-2 border-t border-slate-100 pt-2">
        <div>
          <p className="text-[8px] uppercase text-slate-500 font-bold mb-0.5">Client</p>
          <p className="text-[11px] font-bold text-slate-900 truncate">{clientName}</p>
        </div>
        <div>
          <p className="text-[8px] uppercase text-slate-500 font-bold mb-0.5">Téléphone</p>
          <p className="text-[11px] font-bold text-slate-900">{clientPhone}</p>
        </div>
        <div>
          <p className="text-[8px] uppercase text-slate-500 font-bold mb-0.5">Mutuelle</p>
          <p className="text-[11px] font-bold text-slate-900">{mutuelle}</p>
        </div>
      </div>

      {/* Prescription Grid - Reduced distance with financials */}
      <div className="mb-2">
        <h3 className="text-[8px] font-bold uppercase mb-1 text-slate-800">Prescription (Correction)</h3>
        <table className="w-full text-[9px] border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-300 p-1 text-left text-[8px] uppercase text-slate-600">Oeil</th>
              <th className="border border-slate-300 p-1 text-center text-[8px] uppercase text-slate-600 w-20">Sphère</th>
              <th className="border border-slate-300 p-1 text-center text-[8px] uppercase text-slate-600 w-20">Cylindre</th>
              <th className="border border-slate-300 p-1 text-center text-[8px] uppercase text-slate-600 w-20">Axe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-300 p-1 font-bold bg-white text-[8px]">Oeil Droit (OD)</td>
              <td className="border border-slate-300 p-1 text-center bg-white">{od.sph}</td>
              <td className="border border-slate-300 p-1 text-center bg-white">{od.cyl}</td>
              <td className="border border-slate-300 p-1 text-center bg-white">{od.axe}</td>
            </tr>
            <tr>
              <td className="border border-slate-300 p-1 font-bold bg-white text-[8px]">Oeil Gauche (OG)</td>
              <td className="border border-slate-300 p-1 text-center bg-white">{og.sph}</td>
              <td className="border border-slate-300 p-1 text-center bg-white">{og.cyl}</td>
              <td className="border border-slate-300 p-1 text-center bg-white">{og.axe}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Financials & Footer Section - Gap reduced */}
      <div className="flex flex-col gap-2 mt-auto">
        <div className="flex justify-between items-end border-t border-slate-100 pt-2">
          <div className="w-1/2 space-y-0.5">
            <div className="flex justify-between text-[10px] text-slate-600 pr-8">
              <span>Total Vente:</span>
              <span className="font-medium tabular-nums">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-[10px] text-green-700 pr-8 font-medium">
              <span>Avance:</span>
              <span className="tabular-nums">{formatCurrency(avance)}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t border-slate-200 mt-1 pr-8">
              <span className="text-[10px] font-black uppercase text-slate-900">Reste à payer:</span>
              <span className="text-[14px] font-black text-primary tabular-nums tracking-tighter">{formatCurrency(reste)}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="w-[35mm] h-[20mm] border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center relative bg-slate-50/30 overflow-hidden mb-1">
              <span className="text-[7px] uppercase text-slate-300 font-bold rotate-[-15deg] text-center px-2 opacity-50">
                CACHET DU MAGASIN
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex justify-between px-2 pb-1">
           <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest italic">Signature Client</p>
           <p className="text-[7px] font-bold text-slate-500 uppercase tracking-widest italic">Signature & Cachet Magasin</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-8">
      {/* Controls Overlay */}
      <div className="no-print w-[210mm] flex justify-between mb-6">
        <Button variant="outline" asChild className="bg-white hover:bg-slate-50">
          <Link href="/ventes/nouvelle">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Link>
        </Button>
        <Button onClick={() => window.print()} className="bg-primary shadow-xl hover:bg-primary/90">
          <Printer className="mr-2 h-4 w-4" />
          Lancer l'impression (A4)
        </Button>
      </div>

      {/* Actual A4 Page */}
      <div className="pdf-a4 shadow-[0_0_50px_rgba(0,0,0,0.1)] overflow-hidden print:shadow-none bg-white print:m-0">
        <InvoiceCopy />
        
        {/* Real Central Dashed Line for cutting */}
        <div className="relative h-0">
          <div className="absolute top-0 left-0 w-full border-t-[1px] border-dashed border-slate-400 z-20" />
        </div>
        
        <InvoiceCopy />
      </div>

      <div className="no-print mt-6 text-slate-500 text-xs flex items-center gap-2">
        <Eye className="h-4 w-4" />
        Format A4 Portrait : 2 exemplaires par page. Les marges ont été optimisées pour éviter les coupures.
      </div>
    </div>
  );
}
