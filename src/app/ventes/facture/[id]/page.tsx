"use client";

import { useSearchParams, useParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS, APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Glasses, ThumbsUp, Phone, User, ShieldCheck } from "lucide-react";
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
    <div className="pdf-a5-portrait bg-white flex flex-col p-[6mm] relative">
      {/* Header Section */}
      <div className="flex justify-between items-start mb-4 pb-3 border-b-2 border-primary/20">
        <div className="flex gap-3">
          <div className="h-12 w-12 bg-primary rounded-lg flex items-center justify-center text-primary-foreground shadow-sm shrink-0">
            <div className="relative">
              <Glasses className="h-7 w-7" />
              <ThumbsUp className="h-3.5 w-3.5 absolute -top-1.5 -right-1.5 bg-primary p-0.5 rounded-full" />
            </div>
          </div>
          <div className="space-y-0.5">
            <h2 className="text-sm font-black text-primary leading-tight uppercase tracking-tighter">{APP_NAME}</h2>
            <p className="text-[8px] text-slate-500 max-w-[150px] leading-tight font-medium">{shop.address}</p>
            <p className="text-[8px] font-bold text-slate-700">Tél: {shop.phone}</p>
            <p className="text-[8px] font-black text-primary">ICE: {shop.icePatent}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="bg-primary text-white px-2 py-0.5 rounded-sm inline-block mb-1">
            <h1 className="text-[10px] font-black uppercase tracking-widest">Facture</h1>
          </div>
          <p className="text-[9px] font-black text-slate-900 mt-0.5">N°: {invoiceNo}</p>
          <p className="text-[8px] text-slate-500 font-bold italic">Date: {date}</p>
        </div>
      </div>

      {/* Client Information */}
      <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-50 p-2 rounded-lg border border-slate-100">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 text-[7px] font-black text-primary uppercase opacity-60">
            <User className="h-2 w-2" /> Client
          </div>
          <p className="text-[10px] font-bold text-slate-900 leading-none truncate">{clientName}</p>
        </div>
        <div className="space-y-0.5 border-x border-slate-200 px-2">
          <div className="flex items-center gap-1 text-[7px] font-black text-primary uppercase opacity-60">
            <Phone className="h-2 w-2" /> Téléphone
          </div>
          <p className="text-[10px] font-bold text-slate-900 leading-none">{clientPhone}</p>
        </div>
        <div className="space-y-0.5 text-right">
          <div className="flex items-center justify-end gap-1 text-[7px] font-black text-primary uppercase opacity-60">
            <ShieldCheck className="h-2 w-2" /> Mutuelle
          </div>
          <p className="text-[10px] font-bold text-primary leading-none">{mutuelle}</p>
        </div>
      </div>

      {/* Prescription */}
      <div className="mb-4">
        <h3 className="text-[8px] font-black uppercase mb-1.5 text-primary tracking-widest flex items-center gap-2">
          <div className="h-0.5 w-3 bg-primary/30 rounded-full" />
          Prescription Optique
        </h3>
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr className="bg-primary text-white">
              <th className="border border-primary p-1 text-left text-[7px] uppercase font-black">Oeil</th>
              <th className="border border-primary p-1 text-center text-[7px] uppercase font-black">Sphère</th>
              <th className="border border-primary p-1 text-center text-[7px] uppercase font-black">Cylindre</th>
              <th className="border border-primary p-1 text-center text-[7px] uppercase font-black">Axe</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white">
              <td className="border border-slate-200 p-1 font-black text-slate-700 bg-slate-50/50">Droit (OD)</td>
              <td className="border border-slate-200 p-1 text-center font-bold">{od.sph}</td>
              <td className="border border-slate-200 p-1 text-center font-bold">{od.cyl}</td>
              <td className="border border-slate-200 p-1 text-center font-bold">{od.axe}</td>
            </tr>
            <tr className="bg-white">
              <td className="border border-slate-200 p-1 font-black text-slate-700 bg-slate-50/50">Gauche (OG)</td>
              <td className="border border-slate-200 p-1 text-center font-bold">{og.sph}</td>
              <td className="border border-slate-200 p-1 text-center font-bold">{og.cyl}</td>
              <td className="border border-slate-200 p-1 text-center font-bold">{og.axe}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Financials & Signatures */}
      <div className="mt-auto">
        <div className="flex justify-between items-end gap-4 border-t-2 border-slate-100 pt-3">
          {/* Detailed Totals */}
          <div className="flex-1 space-y-1 bg-slate-50/50 p-2 rounded-lg">
            <div className="flex justify-between text-[9px] text-slate-500 font-medium">
              <span>Total Brut :</span>
              <span>{formatCurrency(total)}</span>
            </div>
            {remise > 0 && (
              <div className="flex justify-between text-[9px] text-destructive font-black italic">
                <span>Remise {remisePercent === "Fixe" ? "" : `(${remisePercent}%)`} :</span>
                <span>-{formatCurrency(remise)}</span>
              </div>
            )}
            <div className="flex justify-between text-[9px] text-slate-900 font-black border-t border-slate-200 pt-1">
              <span>Total Net :</span>
              <span>{formatCurrency(totalNet)}</span>
            </div>
            <div className="flex justify-between text-[9px] text-green-700 font-black">
              <span>Avance payée :</span>
              <span>{formatCurrency(avance)}</span>
            </div>
            
            <div className="flex justify-between items-center pt-1 border-t-2 border-primary mt-1">
              <span className="text-[9px] font-black uppercase text-primary tracking-tighter">Reste à régler</span>
              <span className="text-lg font-black text-primary tracking-tighter decoration-4">
                {formatCurrency(reste)}
              </span>
            </div>
          </div>
          
          {/* Stamp Area */}
          <div className="flex flex-col items-center w-28">
            <div className="w-full h-16 border-2 border-dashed border-primary/20 rounded-xl flex items-center justify-center relative bg-primary/5 overflow-hidden mb-1">
              <span className="text-[7px] uppercase text-primary/30 font-black rotate-[-15deg] text-center px-1 leading-tight select-none">
                CACHET & SIGNATURE<br/>OFFICIELS DU MAGASIN
              </span>
            </div>
            <p className="text-[7px] font-black text-slate-400 uppercase italic tracking-widest">Validé par Direction</p>
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex justify-between items-center px-1 mt-3 border-t border-slate-100 pt-2">
           <p className="text-[8px] font-black text-slate-400 uppercase italic">Signature Client : ............................</p>
           <div className="flex items-center gap-1 opacity-20">
             <div className="relative">
              <Glasses className="h-2.5 w-2.5" />
              <ThumbsUp className="h-1 w-1 absolute -top-0.5 -right-0.5" />
            </div>
             <p className="text-[7px] font-black uppercase tracking-[0.2em]">{APP_NAME} Optique Pro</p>
           </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-8">
      {/* Controls Overlay */}
      <div className="no-print w-[297mm] flex justify-between mb-6">
        <Button variant="outline" asChild className="bg-white hover:bg-slate-50 border-primary/20 text-primary shadow-sm">
          <Link href="/ventes/nouvelle">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à la vente
          </Link>
        </Button>
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-slate-500 bg-white px-4 py-2 rounded-full border shadow-sm flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Format A4 Paysage (2 copies A5 Portrait)
          </span>
          <Button onClick={() => window.print()} className="bg-primary shadow-xl hover:bg-primary/90 px-10 h-11 text-base font-bold">
            <Printer className="mr-2 h-5 w-5" />
            Lancer l'impression
          </Button>
        </div>
      </div>

      {/* Actual A4 Page */}
      <div className="pdf-a4-landscape shadow-[0_0_60px_rgba(0,0,0,0.15)] overflow-hidden print:shadow-none bg-white print:m-0">
        <InvoiceCopy />
        
        {/* Vertical Dashed Line for cutting */}
        <div className="cutting-line-vertical" />
        
        <InvoiceCopy />
      </div>

      <div className="no-print mt-8 text-slate-500 text-[11px] font-bold flex items-center gap-3 bg-white/90 px-6 py-3 rounded-full border border-primary/10 shadow-lg">
        <div className="relative">
          <Glasses className="h-4 w-4 text-primary" />
          <ThumbsUp className="h-2 w-2 absolute -top-1 -right-1 text-primary" />
        </div>
        Conseil : Désactivez les en-têtes/pieds de page dans les options d'impression de votre navigateur.
      </div>
    </div>
  );
}
