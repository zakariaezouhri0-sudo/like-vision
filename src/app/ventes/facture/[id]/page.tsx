
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
  const remise = Number(searchParams.get("remise")) || 0;
  const remisePercent = searchParams.get("remisePercent") || "0";
  const avance = Number(searchParams.get("avance")) || 0;
  
  const totalNet = total - remise;
  const reste = totalNet - avance;

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
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 bg-slate-100 border border-slate-200 rounded flex items-center justify-center text-[8px] text-slate-400 font-bold uppercase shrink-0">
            LOGO
          </div>
          <div className="space-y-0">
            <h2 className="text-sm font-black text-primary leading-none uppercase tracking-tighter">{shop.name}</h2>
            <p className="text-[8px] text-slate-600 max-w-[200px] leading-tight mt-1">{shop.address}</p>
            <p className="text-[8px] text-slate-600">Tél: {shop.phone}</p>
            <p className="text-[8px] font-bold text-slate-800">ICE: {shop.icePatent}</p>
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-lg font-black uppercase tracking-tighter mb-0 border-b-2 border-primary inline-block">Facture</h1>
          <p className="text-[9px] font-bold text-slate-900 mt-0.5">N°: {invoiceNo}</p>
          <p className="text-[8px] text-slate-500">Date: {date}</p>
        </div>
      </div>

      {/* Client Info Grid */}
      <div className="grid grid-cols-3 gap-1 mb-4 border-y border-slate-100 py-2">
        <div className="min-w-0">
          <p className="text-[7px] uppercase text-slate-400 font-black mb-0.5">Client</p>
          <p className="text-[10px] font-bold text-slate-900 truncate">{clientName}</p>
        </div>
        <div className="min-w-0 px-2 border-x border-slate-100 text-center">
          <p className="text-[7px] uppercase text-slate-400 font-black mb-0.5">Téléphone</p>
          <p className="text-[10px] font-bold text-slate-900">{clientPhone}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[7px] uppercase text-slate-400 font-black mb-0.5">Mutuelle</p>
          <p className="text-[10px] font-bold text-slate-900">{mutuelle}</p>
        </div>
      </div>

      {/* Prescription Grid */}
      <div className="mb-4">
        <h3 className="text-[8px] font-black uppercase mb-1 text-slate-800 tracking-tight">Prescription Optique</h3>
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="border border-slate-200 p-1 text-left text-[7px] uppercase text-slate-500">Oeil</th>
              <th className="border border-slate-200 p-1 text-center text-[7px] uppercase text-slate-500">Sphère</th>
              <th className="border border-slate-200 p-1 text-center text-[7px] uppercase text-slate-500">Cylindre</th>
              <th className="border border-slate-200 p-1 text-center text-[7px] uppercase text-slate-500">Axe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-200 p-1 font-bold bg-white text-[9px]">Droit (OD)</td>
              <td className="border border-slate-200 p-1 text-center bg-white">{od.sph}</td>
              <td className="border border-slate-200 p-1 text-center bg-white">{od.cyl}</td>
              <td className="border border-slate-200 p-1 text-center bg-white">{od.axe}</td>
            </tr>
            <tr>
              <td className="border border-slate-200 p-1 font-bold bg-white text-[9px]">Gauche (OG)</td>
              <td className="border border-slate-200 p-1 text-center bg-white">{og.sph}</td>
              <td className="border border-slate-200 p-1 text-center bg-white">{og.cyl}</td>
              <td className="border border-slate-200 p-1 text-center bg-white">{og.axe}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Financials Section */}
      <div className="mt-auto pt-2">
        <div className="flex justify-between items-end mb-4">
          <div className="w-[55%] space-y-0.5">
            <div className="flex justify-between text-[9px] text-slate-500 pr-4">
              <span>Total Brut :</span>
              <span className="font-medium">{formatCurrency(total)}</span>
            </div>
            {remise > 0 && (
              <div className="flex justify-between text-[9px] text-destructive pr-4">
                <span>Remise {remisePercent === "Fixe" ? "" : `(${remisePercent}%)`} :</span>
                <span className="font-bold">-{formatCurrency(remise)}</span>
              </div>
            )}
            <div className="flex justify-between text-[9px] text-slate-800 pr-4 font-bold border-t border-slate-50 pt-0.5">
              <span>Total Net :</span>
              <span>{formatCurrency(totalNet)}</span>
            </div>
            <div className="flex justify-between text-[9px] text-green-700 pr-4 font-bold">
              <span>Avance :</span>
              <span>{formatCurrency(avance)}</span>
            </div>
            <div className="flex justify-between items-center pt-1 border-t-2 border-primary mt-1 pr-4">
              <span className="text-[10px] font-black uppercase text-primary">Reste à payer :</span>
              <span className="text-lg font-black text-primary tracking-tighter underline decoration-2 underline-offset-2">
                {formatCurrency(reste)}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="w-[35mm] h-[20mm] border-2 border-dotted border-slate-200 rounded flex items-center justify-center relative bg-slate-50/20 overflow-hidden mb-1">
              <span className="text-[7px] uppercase text-slate-300 font-black rotate-[-15deg] text-center px-1 opacity-40 leading-tight">
                CACHET & SIGNATURE<br/>DU MAGASIN
              </span>
            </div>
            <p className="text-[7px] font-black text-slate-400 uppercase italic">Validé par la direction</p>
          </div>
        </div>
        
        <div className="flex justify-between px-1 border-t border-slate-50 pt-2">
           <p className="text-[8px] font-black text-slate-500 uppercase italic">Signature Client : ............................</p>
           <p className="text-[7px] text-slate-300 font-bold italic uppercase tracking-widest">VisionGere Optique Pro</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-8">
      {/* Controls Overlay */}
      <div className="no-print w-[297mm] flex justify-between mb-6">
        <Button variant="outline" asChild className="bg-white hover:bg-slate-50 border-primary/20 text-primary">
          <Link href="/ventes/nouvelle">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la vente
          </Link>
        </Button>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1 rounded-full border shadow-sm">
            Format A4 Paysage (2 copies A5 Portrait)
          </span>
          <Button onClick={() => window.print()} className="bg-primary shadow-xl hover:bg-primary/90 px-8">
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

      <div className="no-print mt-6 text-slate-500 text-[10px] font-medium flex items-center gap-2 bg-white/80 px-4 py-2 rounded-lg border">
        <Eye className="h-3 w-3 text-primary" />
        Pour un résultat optimal, réglez les marges sur "Aucune" et l'échelle sur "100%" dans les paramètres d'impression.
      </div>
    </div>
  );
}
