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
    document.title = `Détail des Charges - ${format(dateRange.from, "dd/MM/yyyy")}`;
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
      <div className="space-y-2 mb-8">
        <div className={cn("flex items-center justify-between border-b-2 border-black pb-1")}>
          <h3 className="text-[11px] font-black uppercase flex items-center gap-2 text-black">
            <Icon className="h-3.5 w-3.5" /> {title}
          </h3>
          <span className="text-[10px] font-black uppercase text-black">
            Sous-total : {formatCurrency(data.reduce((a: any, b: any) => a + Math.abs(b.montant), 0), false)} DH
          </span>
        </div>
        <table className="w-full border-collapse border border-black">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-1 border border-black text-left text-[9px] font-black uppercase w-24">Date</th>
              <th className="p-1 border border-black text-left text-[9px] font-black uppercase">Libellé / Désignation</th>
              <th className="p-1 border border-black text-left text-[9px] font-black uppercase w-48">Affectation / Client</th>
              <th className="p-1 border border-black text-right text-[9px] font-black uppercase w-32">Montant (DH)</th>
            </tr>
          </thead>
          <tbody>
            {data.map((t: any) => (
              <tr key={t.id} className="border-b border-black">
                <td className="p-1 border border-black text-[10px] font-bold text-center">{t.createdAt?.toDate ? format(t.createdAt.toDate(), "dd/MM/yyyy") : "---"}</td>
                <td className="p-1 border border-black text-[10px] font-black text-slate-800 uppercase">{t.label}</td>
                <td className="p-1 border border-black text-[10px] font-bold uppercase">{t.clientName || "---"}</td>
                <td className="p-1 border border-black text-right text-[11px] font-black text-black tabular-nums">{formatCurrency(Math.abs(t.montant), false)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-4 print:p-0">
      <div className="no-print w-full max-w-[297mm] flex justify-between items-center mb-6">
        <Button variant="outline" asChild className="h-10 px-4 rounded-xl font-black text-xs border-slate-200">
          <Link href="/rapports"><ArrowLeft className="mr-2 h-4 w-4" /> RETOUR</Link>
        </Button>
        <Button onClick={() => window.print()} className="bg-slate-900 text-white h-10 px-8 rounded-xl font-black text-xs shadow-xl">
          <Printer className="mr-2 h-4 w-4" /> IMPRIMER (PDF)
        </Button>
      </div>

      <div className="pdf-a4-landscape w-[297mm] bg-white print:m-0 flex flex-col p-[10mm] min-h-[210mm] border border-slate-100 shadow-2xl print:shadow-none">
        <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
          <div className="flex items-center gap-6">
            <div className="h-16 w-16 flex items-center justify-center shrink-0 overflow-hidden relative border border-slate-200 rounded-xl bg-white">
              {shop.logoUrl ? (<img src={shop.logoUrl} alt="Logo" className="h-full w-full object-contain p-1.5" />) : (<div className="relative text-black"><Glasses className="h-10 w-10" /></div>)}
            </div>
            <div>
              <h1 className="text-xl font-black text-black uppercase tracking-tighter leading-none">{shop.name || "---"}</h1>
              <p className="text-[9px] text-slate-500 font-bold leading-tight mt-1">ICE: {shop.icePatent || "---"} • Tél: {shop.phone || "---"}</p>
              <p className="text-[8px] text-slate-400 font-medium uppercase mt-0.5">{shop.address || "---"}</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] leading-none border-2 border-black px-4 py-2 rounded-md mb-2">État Détaillé des Sorties</h2>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2 text-[11px] font-black text-black uppercase">
                <Calendar className="h-3.5 w-3.5" />
                <span>Du {format(dateRange.from, "dd/MM/yyyy")} au {format(dateRange.to, "dd/MM/yyyy")}</span>
              </div>
              <div className="flex items-center gap-2 text-[8px] font-bold text-slate-400 italic">
                <Clock className="h-2.5 w-2.5" />
                <span>Généré à {printTime}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-8">
          {selectedTypes.includes("ACHAT VERRES") && (
            <div className="p-3 rounded-xl border border-black bg-slate-50 text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Achats Verres</p>
              <p className="text-base font-black text-black tabular-nums leading-none">{formatCurrency(categorizedData.totals.verres, false)} DH</p>
            </div>
          )}
          {selectedTypes.includes("ACHAT MONTURE") && (
            <div className="p-3 rounded-xl border border-black bg-slate-50 text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Achats Montures</p>
              <p className="text-base font-black text-black tabular-nums leading-none">{formatCurrency(categorizedData.totals.montures, false)} DH</p>
            </div>
          )}
          {selectedTypes.includes("DEPENSE") && (
            <div className="p-3 rounded-xl border border-black bg-slate-50 text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Frais & Charges</p>
              <p className="text-base font-black text-black tabular-nums leading-none">{formatCurrency(categorizedData.totals.depenses, false)} DH</p>
            </div>
          )}
          {selectedTypes.includes("VERSEMENT") && (
            <div className="p-3 rounded-xl border border-black bg-slate-50 text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">Versements</p>
              <p className="text-base font-black text-black tabular-nums leading-none">{formatCurrency(categorizedData.totals.versements, false)} DH</p>
            </div>
          )}
        </div>

        <div className="flex-1">
          {selectedTypes.includes("ACHAT VERRES") && <RenderSection title="Détail Achats Verres" data={categorizedData.verres} icon={Tag} colorClass="bg-blue-600" />}
          {selectedTypes.includes("ACHAT MONTURE") && <RenderSection title="Détail Achats Montures" data={categorizedData.montures} icon={Tag} colorClass="bg-orange-600" />}
          {selectedTypes.includes("DEPENSE") && <RenderSection title="Charges Générales & Frais" data={categorizedData.depenses} icon={TrendingDown} colorClass="bg-red-600" />}
          {selectedTypes.includes("VERSEMENT") && <RenderSection title="Versements Bancaires" data={categorizedData.versements} icon={Landmark} colorClass="bg-slate-900" />}
        </div>

        <div className="mt-8 pt-4 border-t-4 border-black flex justify-between items-center">
          <span className="text-sm font-black uppercase tracking-[0.3em] text-slate-400">Total Général des Sorties (Espèces)</span>
          <span className="text-3xl font-black text-black tabular-nums">{formatCurrency(categorizedData.total, true)}</span>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-20">
          <div className="space-y-10">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Visa Responsable</p>
            <div className="border-b border-slate-200 w-full h-10"></div>
          </div>
          <div className="text-right flex flex-col items-end">
            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Authentification Magasin</p>
            <div className="w-[50mm] h-[25mm] border border-dashed border-slate-300 rounded-lg mt-4 flex items-center justify-center">
              <span className="text-[8px] font-black text-slate-200 rotate-[-15deg] uppercase tracking-[0.4em]">Cachet</span>
            </div>
          </div>
        </div>

        <div className="mt-auto text-center pt-6">
          <p className="text-[7px] text-slate-300 font-black uppercase tracking-[0.5em] italic">SYSTÈME LIKE VISION • DOCUMENT OFFICIEL • GÉNÉRÉ LE {format(new Date(), "dd/MM/yyyy")}</p>
        </div>
      </div>
    </div>
  );
}

export default function ChargesReportPage() { return <Suspense fallback={null}><ChargesReportContent /></Suspense>; }
