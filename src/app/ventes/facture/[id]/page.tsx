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
    <div className="pdf-a5-portrait bg-white">
      {/* Header Section */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 bg-slate-50 border border-slate-200 rounded flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase shrink-0">
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
          <h1 className="text-xl font-black uppercase tracking-tighter mb-0 border-b-2 border-primary inline-block">Facture</h1>
          <p className="text-[10px] font-bold text-slate-900 mt-1">N°: {invoiceNo}</p>
          <p className="text-[9px] text-slate-600">Date: {date}</p>
        </div>
      </div>

      {/* Client Info Grid */}
      <div className="grid grid-cols-3 gap-2 mb-6 border-y border-slate-100 py-3">
        <div>
          <p className="text-[8px] uppercase text-slate-500 font-bold mb-1">Client</p>
          <p className="text-xs font-bold text-slate-900 truncate">{clientName}</p>
        </div>
        <div>
          <p className="text-[8px] uppercase text-slate-500 font-bold mb-1">Téléphone</p>
          <p className="text-xs font-bold text-slate-900">{clientPhone}</p>
        </div>
        <div>
          <p className="text-[8px] uppercase text-slate-500 font-bold mb-1">Mutuelle</p>
          <p className="text-xs font-bold text-slate-900">{mutuelle}</p>
        </div>
      </div>

      {/* Prescription Grid */}
      <div className="mb-6">
        <h3 className="text-[9px] font-bold uppercase mb-2 text-slate-800">Prescription Optique</h3>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-300 p-2 text-left text-[9px] uppercase text-slate-600">Oeil</th>
              <th className="border border-slate-300 p-2 text-center text-[9px] uppercase text-slate-600">Sphère</th>
              <th className="border border-slate-300 p-2 text-center text-[9px] uppercase text-slate-600">Cylindre</th>
              <th className="border border-slate-300 p-2 text-center text-[9px] uppercase text-slate-600">Axe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-300 p-2 font-bold bg-white">Droit (OD)</td>
              <td className="border border-slate-300 p-2 text-center bg-white">{od.sph}</td>
              <td className="border border-slate-300 p-2 text-center bg-white">{od.cyl}</td>
              <td className="border border-slate-300 p-2 text-center bg-white">{od.axe}</td>
            </tr>
            <tr>
              <td className="border border-slate-300 p-2 font-bold bg-white">Gauche (OG)</td>
              <td className="border border-slate-300 p-2 text-center bg-white">{og.sph}</td>
              <td className="border border-slate-300 p-2 text-center bg-white">{og.cyl}</td>
              <td className="border border-slate-300 p-2 text-center bg-white">{og.axe}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Financials & Footer Section */}
      <div className="mt-auto pt-4 border-t border-slate-100">
        <div className="flex justify-between items-end mb-8">
          <div className="w-1/2 space-y-1">
            <div className="flex justify-between text-xs text-slate-600 pr-6">
              <span>Total Vente:</span>
              <span className="font-medium">{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-xs text-green-700 pr-6 font-medium">
              <span>Avance:</span>
              <span>{formatCurrency(avance)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2 pr-6">
              <span className="text-[10px] font-black uppercase text-slate-900">Reste à payer:</span>
              <span className="text-xl font-black text-primary tracking-tighter">{formatCurrency(reste)}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="w-[40mm] h-[25mm] border border-dashed border-slate-300 rounded flex items-center justify-center relative bg-slate-50/30 overflow-hidden mb-1">
              <span className="text-[8px] uppercase text-slate-300 font-bold rotate-[-15deg] text-center px-2 opacity-50">
                CACHET DU MAGASIN
              </span>
            </div>
            <p className="text-[8px] font-bold text-slate-400 uppercase italic">Signature & Cachet</p>
          </div>
        </div>
        
        <div className="flex justify-between px-2">
           <p className="text-[9px] font-bold text-slate-400 uppercase italic">Signature Client</p>
           <p className="text-[9px] text-slate-400 italic">VisionGere Optique Pro v1.0</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-8">
      {/* Controls Overlay */}
      <div className="no-print w-[297mm] flex justify-between mb-6">
        <Button variant="outline" asChild className="bg-white hover:bg-slate-50">
          <Link href="/ventes/nouvelle">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Link>
        </Button>
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-slate-600">Format A4 Paysage (2 copies A5 Portrait)</span>
          <Button onClick={() => window.print()} className="bg-primary shadow-xl hover:bg-primary/90">
            <Printer className="mr-2 h-4 w-4" />
            Lancer l'impression
          </Button>
        </div>
      </div>

      {/* Actual A4 Page */}
      <div className="pdf-a4-landscape shadow-[0_0_50px_rgba(0,0,0,0.1)] overflow-hidden print:shadow-none bg-white print:m-0">
        <InvoiceCopy />
        
        {/* Vertical Dashed Line for cutting */}
        <div className="cutting-line-vertical" />
        
        <InvoiceCopy />
      </div>

      <div className="no-print mt-6 text-slate-500 text-xs flex items-center gap-2">
        <Eye className="h-4 w-4" />
        Les factures sont désormais côte à côte. La page s'imprimera en mode Paysage automatiquement.
      </div>
    </div>
  );
}