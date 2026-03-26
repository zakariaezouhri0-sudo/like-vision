
"use client";

import { useSearchParams } from "next/navigation";
import { DEFAULT_SHOP_SETTINGS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft, Loader2, Glasses, TrendingDown, Tag, Landmark } from "lucide-react";
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
    document.title = `Charges - ${format(dateRange.from, "dd/MM/yyyy")}`;
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
    if (!rawTransactions) return { verres: [], montures: [], depenses: [], versements: [], total: 0, totals: { verres: 0, montures: 0, depenses: 0, versements: 0 } };
    
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
      total: roundAmount(sum(verres) + sum(montures) + sum(depenses) + sum(versements)),
      totals: {
        verres: roundAmount(sum(verres)),
        montures: roundAmount(sum(montures)),
        depenses: roundAmount(sum(depenses)),
        versements: roundAmount(sum(versements))
      }
    };
  }, [rawTransactions, isPrepaMode, selectedTypes]);

  if (settingsLoading || transLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;
  }

  const RenderSection = ({ title, data, icon: Icon, colorClass }: any) => {
    if (data.length === 0) return null;
    return (
      <div className="space-y-3 mb-10">
        <div className={cn("flex items-center justify-between border-b-2 pb-2", colorClass.replace('bg-', 'border-'))}>
          <h3 className={cn("text-xs font-black uppercase flex items-center gap-2", colorClass.replace('bg-', 'text-'))}>
            <Icon className="h-4 w-4" /> {title}
          </h3>
          <span className={cn("text-[10px] font-black uppercase px-3 py-1 rounded-full", colorClass + "/10 " + colorClass.replace('bg-', 'text-'))}>
            Sous-total: {formatCurrency(data.reduce((a: any, b: any) => a + Math.abs(b.montant), 0), false)}
          </span>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50">
              <th className="p-2 text-left text-[9px] font-black uppercase text-slate-400 w-24">Date</th>
              <th className="p-2 text-left text-[9px] font-black uppercase text-slate-400">Libellé / Désignation</th>
              <th className="p-2 text-center text-[9px] font-black uppercase text-slate-400 w-24">BC N°</th>
              <th className="p-2 text-right text-[9px] font-black uppercase text-slate-400 w-32">Montant (DH)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((t: any) => {
              const bcMatch = (t.clientName || "").match(/BC\s*[:\s-]\s*(\d+)/i);
              return (
                <tr key={t.id}>
                  <td className="p-2 text-[10px] font-bold text-slate-500">{t.createdAt?.toDate ? format(t.createdAt.toDate(), "dd/MM/yyyy") : "---"}</td>
                  <td className="p-2 text-[10px] font-black text-slate-800 uppercase">{t.label}</td>
                  <td className="p-2 text-center text-[9px] font-black text-slate-400">{bcMatch ? bcMatch[1] : "---"}</td>
                  <td className="p-2 text-right text-[11px] font-black text-slate-950 tabular-nums">-{formatCurrency(Math.abs(t.montant), false)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center pt-4 pb-10 print:pt-0 print:bg-white">
      <div className="no-print w-full max-w-[210mm] flex justify-between items-center mb-6 px-4">
        <Button variant="outline" asChild className="bg-white border-slate-200 text-slate-600 h-10 px-4 rounded-xl font-black text-xs hover:bg-slate-50">
          <Link href="/rapports"><ArrowLeft className="mr-2 h-4 w-4" /> RETOUR RAPPORTS</Link>
        </Button>
        <Button onClick={() => window.print()} className="bg-[#0D1B2A] shadow-xl hover:bg-[#0D1B2A]/90 h-10 px-8 rounded-xl font-black text-xs text-white">
          <Printer className="mr-2 h-4 w-4" /> IMPRIMER
        </Button>
      </div>

      <div className="pdf-a4-portrait shadow-2xl bg-white print:shadow-none print:m-0 border border-slate-100 rounded-none p-[15mm] flex flex-col min-h-[297mm]">
        <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 flex items-center justify-center shrink-0 overflow-hidden relative border border-slate-100 rounded-xl bg-white shadow-sm">
              {shop.logoUrl ? (<img src={shop.logoUrl} alt="Logo" className="h-full w-full object-contain p-1.5" />) : (<div className="relative text-[#0D1B2A]"><Glasses className="h-10 w-10" /></div>)}
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none">{shop.name || "---"}</h1>
              <p className="text-[9px] text-slate-500 font-bold leading-tight mt-1">ICE: {shop.icePatent || "---"} • Tél: {shop.phone || "---"}</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] leading-none border-2 border-slate-900 px-4 py-2 rounded-md mb-2">État des Sorties</h2>
            <div className="flex items-center justify-end gap-2 text-[10px] font-black text-[#D4AF37] uppercase">
              <span>Période: {format(dateRange.from, "dd/MM")} au {format(dateRange.to, "dd/MM/yyyy")}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mb-10">
          {selectedTypes.includes("ACHAT VERRES") && <div className="p-3 rounded-2xl bg-blue-50 text-center border border-blue-100"><p className="text-[7px] font-black text-blue-400 uppercase tracking-widest mb-1 leading-none">Achats Verres</p><p className="text-sm font-black text-blue-700 tabular-nums leading-none">{formatCurrency(categorizedData.totals.verres, false)}</p></div>}
          {selectedTypes.includes("ACHAT MONTURE") && <div className="p-3 rounded-2xl bg-orange-50 text-center border border-orange-100"><p className="text-[7px] font-black text-orange-400 uppercase tracking-widest mb-1 leading-none">Achats Montures</p><p className="text-sm font-black text-orange-700 tabular-nums leading-none">{formatCurrency(categorizedData.totals.montures, false)}</p></div>}
          {selectedTypes.includes("DEPENSE") && <div className="p-3 rounded-2xl bg-red-50 text-center border border-red-100"><p className="text-[7px] font-black text-red-400 uppercase tracking-widest mb-1 leading-none">Frais & Charges</p><p className="text-sm font-black text-red-700 tabular-nums leading-none">{formatCurrency(categorizedData.totals.depenses, false)}</p></div>}
          {selectedTypes.includes("VERSEMENT") && <div className="p-3 rounded-2xl bg-slate-100 text-center border border-slate-200"><p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Versements</p><p className="text-sm font-black text-[#0D1B2A] tabular-nums leading-none">{formatCurrency(categorizedData.totals.versements, false)}</p></div>}
        </div>

        <div className="flex-1">
          {selectedTypes.includes("ACHAT VERRES") && <RenderSection title="Détail Achats Verres" data={categorizedData.verres} icon={Tag} colorClass="bg-blue-600" />}
          {selectedTypes.includes("ACHAT MONTURE") && <RenderSection title="Détail Achats Montures" data={categorizedData.montures} icon={Tag} colorClass="bg-orange-600" />}
          {selectedTypes.includes("DEPENSE") && <RenderSection title="Charges Générales & Frais" data={categorizedData.depenses} icon={TrendingDown} colorClass="bg-red-600" />}
          {selectedTypes.includes("VERSEMENT") && <RenderSection title="Versements Bancaires" data={categorizedData.versements} icon={Landmark} colorClass="bg-[#0D1B2A]" />}
        </div>

        <div className="mt-8 pt-6 border-t-4 border-slate-900 flex justify-between items-center">
          <span className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Total Général des Sorties</span>
          <span className="text-3xl font-black text-slate-950 tabular-nums">{formatCurrency(categorizedData.total, true)}</span>
        </div>

        <div className="mt-12 text-center border-t border-slate-50 pt-4">
          <p className="text-[7px] text-slate-300 font-black uppercase tracking-[0.5em] italic">SYSTÈME LIKE VISION • RAPPORT DÉTAILLÉ GÉNÉRÉ LE {format(new Date(), "dd/MM/yyyy")}</p>
        </div>
      </div>
    </div>
  );
}

export default function ChargesReportPage() { return <Suspense fallback={null}><ChargesReportContent /></Suspense>; }
