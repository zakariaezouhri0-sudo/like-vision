"use client";

import { useSearchParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Loader2, Glasses, TrendingDown, Tag, Landmark, Calendar, Clock } from "lucide-react";
import Link from "next/link";
import { formatCurrency, cn, roundAmount } from "@/lib/utils";
import { Suspense, useMemo, useState, useEffect } from "react";
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, orderBy, where, Timestamp } from "firebase/firestore";
import { format, startOfDay, endOfDay, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

function ChargesReportContent() {
  const searchParams = useSearchParams();
  const db = useFirestore();
  const [role, setRole] = useState<string>("OPTICIENNE");
  const [printTime, setPrintTime] = useState("");

  const dateRange = useMemo(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    return {
      from: from ? parseISO(from) : new Date(2026, 0, 1),
      to: to ? parseISO(to) : new Date()
    };
  }, [searchParams]);

  const selectedTypes = useMemo(() => {
    const typesStr = searchParams.get("types");
    return typesStr ? typesStr.split(",") : ["ACHAT VERRES", "ACHAT MONTURE", "DEPENSE", "VERSEMENT"];
  }, [searchParams]);

  useEffect(() => {
    const now = new Date();
    setPrintTime(format(now, "HH:mm"));
    const dateStr = format(dateRange.from, "dd-MM-yyyy");
    document.title = `Sorties - ${dateStr}`;
    setRole(localStorage.getItem('user_role') || "OPTICIENNE");
    return () => { document.title = "Like Vision"; };
  }, [dateRange]);

  const isPrepaMode = role === "PREPA";

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: remoteSettings, isLoading: settingsLoading } = useDoc(settingsRef);

  const transQuery = useMemoFirebase(() => {
    return query(
      collection(db, "transactions"), 
      where("createdAt", ">=", Timestamp.fromDate(startOfDay(dateRange.from))),
      where("createdAt", "<=", Timestamp.fromDate(endOfDay(dateRange.to))),
      orderBy("createdAt", "asc")
    );
  }, [db, dateRange]);
  
  const { data: rawTransactions, isLoading: transLoading } = useCollection(transQuery);

  const shop = {
    name: remoteSettings?.name || DEFAULT_SHOP_SETTINGS.name,
    address: remoteSettings?.address || DEFAULT_SHOP_SETTINGS.address,
    phone: remoteSettings?.phone || DEFAULT_SHOP_SETTINGS.phone,
    icePatent: remoteSettings?.icePatent || DEFAULT_SHOP_SETTINGS.icePatent,
    logoUrl: remoteSettings?.logoUrl || DEFAULT_SHOP_SETTINGS.logoUrl,
  };

  const categorizedData = useMemo(() => {
    if (!rawTransactions) return { verres: [], montures: [], depenses: [], versements: [], total: 0 };
    
    const filtered = rawTransactions.filter((t: any) => {
      const modeMatch = isPrepaMode ? t.isDraft === true : t.isDraft !== true;
      const typeMatch = selectedTypes.includes(t.type);
      return modeMatch && typeMatch;
    });
    
    const verres = filtered.filter(t => t.type === "ACHAT VERRES");
    const montures = filtered.filter(t => t.type === "ACHAT MONTURE");
    const depenses = filtered.filter(t => t.type === "DEPENSE");
    const versements = filtered.filter(t => t.type === "VERSEMENT");

    const sum = (list: any[]) => list.reduce((acc, curr) => acc + Math.abs(curr.montant || 0), 0);

    return { 
      verres, 
      montures, 
      depenses,
      versements,
      total: roundAmount(sum(verres) + sum(montures) + sum(depenses) + sum(versements))
    };
  }, [rawTransactions, isPrepaMode, selectedTypes]);

  if (settingsLoading || transLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;
  }

  const RenderSection = ({ title, data, icon: Icon }: any) => {
    if (data.length === 0) return null;
    return (
      <div className="space-y-3 break-inside-avoid">
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
          <h3 className="text-sm font-black uppercase flex items-center gap-3 text-slate-900 tracking-wider">
            <Icon className="h-5 w-5 text-slate-400" /> {title}
          </h3>
          <span className="text-xs font-black uppercase text-slate-900 bg-slate-100 px-4 py-1.5 rounded-full">
            Sous-total : {formatCurrency(data.reduce((a: any, b: any) => a + Math.abs(b.montant), 0), false)} DH
          </span>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-2.5 text-left text-[11px] font-black uppercase tracking-widest text-slate-400 w-28">Date</th>
              <th className="p-2.5 text-left text-[11px] font-black uppercase tracking-widest text-slate-400">Libellé / Désignation</th>
              <th className="p-2.5 text-left text-[11px] font-black uppercase tracking-widest text-slate-400 w-64">Affectation / BC</th>
              <th className="p-2.5 text-right text-[11px] font-black uppercase tracking-widest text-slate-400 w-40">Montant (DH)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((t: any) => (
              <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="p-2.5 text-[12px] font-bold text-slate-500 tabular-nums">{t.createdAt?.toDate ? format(t.createdAt.toDate(), "dd/MM/yyyy") : "---"}</td>
                <td className="p-2.5 text-[13px] font-black text-slate-800 uppercase tracking-tight">{t.label}</td>
                <td className="p-2.5 text-[12px] font-bold text-slate-600 uppercase">{t.clientName || "---"}</td>
                <td className="p-2.5 text-right text-[14px] font-black text-red-600 tabular-nums">-{formatCurrency(Math.abs(t.montant), false)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center p-6 print:p-0">
      <div className="no-print w-full max-w-[297mm] flex justify-between items-center mb-8">
        <Button variant="outline" asChild className="h-12 px-6 rounded-2xl font-black text-xs border-slate-200 shadow-sm bg-white">
          <Link href="/rapports"><ArrowLeft className="mr-3 h-5 w-5" /> RETOUR AUX RAPPORTS</Link>
        </Button>
        <Button onClick={() => window.print()} className="bg-[#0D1B2A] text-white h-12 px-10 rounded-2xl font-black text-xs shadow-xl hover:bg-slate-800 transition-all">
          <Printer className="mr-3 h-5 w-5 text-[#D4AF37]" /> IMPRIMER LE DOCUMENT (PDF)
        </Button>
      </div>

      <div className="pdf-a4-landscape w-[297mm] bg-white print:m-0 flex flex-col p-[12mm] min-h-[210mm] border border-slate-100 shadow-2xl print:shadow-none">
        {/* Header Section */}
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
          <div className="flex items-center gap-8">
            <div className="h-20 w-20 flex items-center justify-center shrink-0 overflow-hidden relative border border-slate-100 rounded-2xl bg-white shadow-sm">
              {shop.logoUrl ? (<img src={shop.logoUrl} alt="Logo" className="h-full w-full object-contain p-2" />) : (<div className="relative text-slate-900"><Glasses className="h-12 w-12" /></div>)}
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">{shop.name || "---"}</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-2">Gestion Optique Professionnelle</p>
              <div className="flex items-center gap-4 mt-3">
                <span className="text-[11px] font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-md">ICE: {shop.icePatent || "---"}</span>
                <span className="text-[11px] font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-md">Tél: {shop.phone || "---"}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="bg-slate-900 text-white px-6 py-3 rounded-xl inline-block mb-4 shadow-lg">
              <h2 className="text-sm font-black uppercase tracking-[0.3em] leading-none">État Détaillé des Sorties</h2>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-3 text-sm font-black text-slate-900 uppercase">
                <Calendar className="h-4 w-4 text-[#D4AF37]" />
                <span>Période : Du {format(dateRange.from, "dd/MM/yyyy")} au {format(dateRange.to, "dd/MM/yyyy")}</span>
              </div>
              <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 italic">
                <Clock className="h-3 w-3" />
                <span>Généré le {format(new Date(), "dd/MM/yyyy")} à {printTime}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details Table Section */}
        <div className="flex-1 space-y-10">
          {selectedTypes.includes("ACHAT VERRES") && categorizedData.verres.length > 0 && (
            <RenderSection title="Achats de Verres" data={categorizedData.verres} icon={Tag} />
          )}
          {selectedTypes.includes("ACHAT MONTURE") && categorizedData.montures.length > 0 && (
            <RenderSection title="Achats de Montures" data={categorizedData.montures} icon={Tag} />
          )}
          {selectedTypes.includes("DEPENSE") && categorizedData.depenses.length > 0 && (
            <RenderSection title="Charges Générales & Frais" data={categorizedData.depenses} icon={TrendingDown} />
          )}
          {selectedTypes.includes("VERSEMENT") && categorizedData.versements.length > 0 && (
            <RenderSection title="Versements Bancaires" data={categorizedData.versements} icon={Landmark} />
          )}
        </div>

        {/* Footer Signatures */}
        <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 gap-24">
          <div className="space-y-12">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Signature Responsable</p>
            <div className="border-b-2 border-slate-200 w-full h-8 opacity-50"></div>
          </div>
          <div className="text-right flex flex-col items-end space-y-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em]">Cachet Officiel Magasin</p>
            <div className="w-[60mm] h-[28mm] border-2 border-dashed border-slate-200 rounded-3xl flex items-center justify-center bg-slate-50 relative overflow-hidden">
              <span className="text-[10px] font-black text-slate-200 rotate-[-15deg] uppercase tracking-[0.5em] select-none text-center leading-tight">
                Authentification<br/>Like Vision
              </span>
            </div>
          </div>
        </div>

        <div className="mt-auto text-center pt-6 border-t border-slate-50">
          <p className="text-[8px] text-slate-300 font-black uppercase tracking-[0.6em] italic">
            SYSTÈME LIKE VISION • DOCUMENT DE COMPTABILITÉ INTERNE • PAGE 1 SUR 1
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ChargesReportPage() { return <Suspense fallback={null}><ChargesReportContent /></Suspense>; }
