"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Glasses, 
  CalendarDays, 
  TrendingUp, 
  ShoppingCart, 
  AlertCircle, 
  Users, 
  ChevronRight,
  ThumbsUp,
  Loader2,
  Lock,
  PlayCircle,
  Eye,
  Wallet
} from "lucide-react";
import { formatCurrency, cn, roundAmount } from "@/lib/utils";
import { 
  Bar, 
  BarChart, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  Tooltip,
  Cell,
  PieChart,
  Pie,
  CartesianGrid
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from "@/firebase";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, query, orderBy, limit, doc, where } from "firebase/firestore";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";

const COLORS = ['#0D1B2A', '#D4AF37', '#1B263B', '#E5C100', '#415A77', '#778DA9'];

export default function DashboardPage() {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [todayStr, setTodayStr] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [isClientReady, setIsHydrated] = useState(false);
  const [role, setRole] = useState<string>("OPTICIENNE");
  const [isPrepaMode, setIsPrepaMode] = useState(false);

  useEffect(() => {
    const savedRole = localStorage.getItem('user_role')?.toUpperCase() || "OPTICIENNE";
    const savedMode = localStorage.getItem('work_mode');
    
    if (savedRole === "OPTICIENNE") {
      router.replace("/caisse");
      return;
    }

    const now = new Date();
    setTodayStr(now.toLocaleDateString("fr-FR", { 
      weekday: 'short', 
      day: 'numeric',
      month: 'short'
    }));
    setDateStr(format(now, "yyyy-MM-dd"));
    setRole(savedRole);
    // Unification de la logique isPrepaMode
    setIsPrepaMode(savedRole === 'PREPA' || (savedRole === 'ADMIN' && savedMode === 'DRAFT'));
    setIsHydrated(true);
  }, [router]);

  const settingsRef = useMemoFirebase(() => doc(db, "settings", "shop-info"), [db]);
  const { data: settings, isLoading: settingsLoading } = useDoc(settingsRef);

  const sessionDocId = isPrepaMode ? `DRAFT-${dateStr}` : dateStr;
  const sessionRef = useMemoFirebase(() => dateStr ? doc(db, "cash_sessions", sessionDocId) : null, [db, dateStr, sessionDocId]);
  const { data: rawSession, isLoading: sessionLoading } = useDoc(sessionRef);

  const session = useMemo(() => {
    if (!rawSession) return null;
    if (isPrepaMode !== (rawSession.isDraft === true)) return null;
    return rawSession;
  }, [rawSession, isPrepaMode]);

  // Correction : suppression du where(isDraft) qui cause l'erreur d'index
  const salesQuery = useMemoFirebase(() => query(
    collection(db, "sales"), 
    orderBy("createdAt", "desc"), 
    limit(1000)
  ), [db]);
  const { data: rawSales, isLoading: loadingSales } = useCollection(salesQuery);

  const transQuery = useMemoFirebase(() => query(
    collection(db, "transactions"), 
    orderBy("createdAt", "desc"), 
    limit(1000)
  ), [db]);
  const { data: rawTransactions, isLoading: loadingTrans } = useCollection(transQuery);

  const clientsQuery = useMemoFirebase(() => query(
    collection(db, "clients"), 
    limit(1000)
  ), [db]);
  const { data: rawClients, isLoading: loadingClients } = useCollection(clientsQuery);

  // Filtrage en mémoire pour éviter les erreurs d'index
  const allSales = useMemo(() => {
    if (!rawSales) return [];
    return rawSales.filter((s: any) => isPrepaMode ? s.isDraft === true : s.isDraft !== true);
  }, [rawSales, isPrepaMode]);

  const allTransactions = useMemo(() => {
    if (!rawTransactions) return [];
    return rawTransactions.filter((t: any) => isPrepaMode ? t.isDraft === true : t.isDraft !== true);
  }, [rawTransactions, isPrepaMode]);

  const allClients = useMemo(() => {
    if (!rawClients) return [];
    return rawClients.filter((c: any) => isPrepaMode ? c.isDraft === true : c.isDraft !== true);
  }, [rawClients, isPrepaMode]);

  const stats = useMemo(() => {
    const ca = (allTransactions || [])
      .filter(t => t.type === "VENTE")
      .reduce((acc, t) => acc + (Number(t.montant) || 0), 0);

    const volume = (allSales || []).reduce((acc, s) => acc + (Number(s.total) || 0) - (Number(s.remise) || 0), 0);
    const reste = (allSales || []).reduce((acc, s) => acc + (Number(s.reste) || 0), 0);
    
    const filteredClientsCount = (allClients || []).length;

    return {
      ca: roundAmount(ca),
      volume: roundAmount(volume),
      count: (allSales || []).length,
      reste: roundAmount(reste),
      newClients: filteredClientsCount
    };
  }, [allSales, allTransactions, allClients]);

  const weeklyData = useMemo(() => {
    if (!allTransactions) return [];
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    return days.map(day => {
      const dayTrans = allTransactions.filter(t => {
        if (!t.createdAt?.toDate || t.type !== "VENTE") return false;
        return isSameDay(t.createdAt.toDate(), day);
      });
      return {
        name: format(day, "EEE", { locale: fr }),
        total: roundAmount(dayTrans.reduce((acc, t) => acc + (Number(t.montant) || 0), 0))
      };
    });
  }, [allTransactions]);

  const mutuelleData = useMemo(() => {
    if (!allSales) return [];
    const counts: Record<string, number> = {};
    allSales.forEach(s => {
      const m = s.mutuelle || "AUCUN";
      counts[m] = (counts[m] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [allSales]);

  const recentSales = useMemo(() => (allSales || []).sort((a,b) => {
    const da = a.createdAt?.toDate?.().getTime() || 0;
    const db = b.createdAt?.toDate?.().getTime() || 0;
    return db - da;
  }).slice(0, 5), [allSales]);

  if (!isClientReady || loadingSales || loadingClients || sessionLoading || loadingTrans) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Synchronisation en cours...</p>
      </div>
    );
  }

  const isSessionOpen = session?.status === "OPEN";
  const isSessionClosed = session?.status === "CLOSED";

  return (
    <div className="space-y-10 md:space-y-12 pb-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 bg-white p-8 md:p-10 rounded-[60px] border-none shadow-xl shadow-slate-200/50 animate-subtle">
        <div className="flex items-center gap-8 min-w-0">
          <div className="h-20 w-20 bg-transparent flex items-center justify-center shrink-0 overflow-hidden group">
            {settingsLoading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary/20" />
            ) : settings?.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-full w-full object-contain p-2 group-hover:scale-110 transition-transform duration-500" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-primary">
                <div className="relative">
                  <Glasses className="h-14 w-14 text-[#0D1B2A]" />
                  <div className="absolute -top-1 -right-1 h-4 w-4 bg-[#D4AF37] rounded-full border-2 border-white animate-pulse" />
                </div>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-4xl font-black text-[#0D1B2A] truncate tracking-tighter capitalize">
              Bonjour, {user?.displayName || "Utilisateur"}
            </h1>
            {todayStr && (
              <p className="text-xs md:text-sm text-[#D4AF37] font-black flex items-center gap-2 capitalize opacity-80 tracking-[0.2em] mt-2">
                <CalendarDays className="h-4 w-4" />
                {todayStr}
              </p>
            )}
          </div>
        </div>
        
        <div className="shrink-0 w-full md:w-auto">
          <Link href="/caisse">
            <div className={cn(
              "border rounded-full px-8 py-4 flex items-center justify-center md:justify-start gap-4 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer",
              isSessionOpen ? "bg-[#D4AF37]/5 border-[#D4AF37]/20" : 
              isSessionClosed ? "bg-red-50 border-red-100" : 
              "bg-orange-50 border-orange-100"
            )}>
              <div className={cn(
                "h-3 w-3 rounded-full",
                isSessionOpen ? "bg-[#D4AF37] animate-pulse" : 
                isSessionClosed ? "bg-red-400" : 
                "bg-orange-500 animate-bounce"
              )} />
              <span className={cn(
                "text-[10px] font-black uppercase tracking-[0.3em]",
                isSessionOpen ? "text-[#D4AF37]" : 
                isSessionClosed ? "text-red-700" : 
                "text-orange-700"
              )}>
                {isSessionOpen ? "Caisse Ouverte" : 
                 isSessionClosed ? "Caisse Clôturée" : 
                 "Ouvrir la Caisse"}
              </span>
            </div>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <Card className="bg-[#0D1B2A] text-white border-none shadow-2xl p-10 rounded-[60px] relative overflow-hidden group flex flex-col items-center text-center animate-subtle [animation-delay:100ms]">
          <Wallet className="absolute -right-8 -top-8 h-48 w-48 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-500" />
          <p className="text-[11px] uppercase font-black text-[#D4AF37] mb-4 tracking-[0.3em] opacity-80">Encaissé (Récent)</p>
          <div className="flex flex-col items-center">
            <span className="text-3xl md:text-4xl font-black tracking-tighter tabular-nums text-white">{formatCurrency(stats.ca)}</span>
            <span className="text-[9px] font-black uppercase text-[#D4AF37]/40 mt-2 tracking-widest">Volume: {formatCurrency(stats.volume)}</span>
          </div>
        </Card>
        
        <Card className="bg-[#D4AF37] text-[#0D1B2A] border-none shadow-2xl p-10 rounded-[60px] relative overflow-hidden group flex flex-col items-center text-center animate-subtle [animation-delay:200ms]">
          <ShoppingCart className="absolute -right-8 -top-8 h-48 w-48 opacity-20 -rotate-12 group-hover:scale-110 transition-transform duration-500" />
          <p className="text-[11px] uppercase font-black opacity-60 mb-4 tracking-[0.3em]">Ventes (Récent)</p>
          <p className="text-4xl md:text-5xl font-black tracking-tighter">{stats.count}</p>
        </Card>
        
        <Card className="bg-white border-none shadow-xl shadow-slate-200/50 p-10 rounded-[60px] relative overflow-hidden group border-l-[16px] border-l-red-500 flex flex-col items-center text-center animate-subtle [animation-delay:300ms]">
          <AlertCircle className="absolute -right-8 -top-8 h-48 w-48 text-red-500 opacity-5 group-hover:scale-110 transition-transform duration-500" />
          <p className="text-[11px] uppercase font-black text-muted-foreground mb-4 tracking-[0.3em]">Reste à Recouvrer</p>
          <div className="flex items-baseline">
            <span className="text-3xl md:text-4xl font-black text-red-600 tracking-tighter tabular-nums">{formatCurrency(stats.reste)}</span>
          </div>
        </Card>
        
        <Card className="bg-white border-none shadow-xl shadow-slate-200/50 p-10 rounded-[60px] relative overflow-hidden group border-l-[16px] border-l-[#D4AF37] flex flex-col items-center text-center animate-subtle [animation-delay:400ms]">
          <Users className="absolute -right-8 -top-8 h-48 w-48 text-[#D4AF37] opacity-5 group-hover:scale-110 transition-transform duration-500" />
          <p className="text-[11px] uppercase font-black text-muted-foreground mb-4 tracking-[0.3em]">Dossiers Clients</p>
          <p className="text-4xl md:text-5xl font-black text-[#0D1B2A] tracking-tighter">{stats.newClients}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-8">
        <Card className="lg:col-span-4 shadow-xl shadow-slate-200/50 border-none overflow-hidden rounded-[60px] bg-white animate-subtle">
          <CardHeader className="p-10 border-b bg-slate-50/50">
            <CardTitle className="text-xs font-black uppercase tracking-[0.3em] text-[#0D1B2A] flex items-center gap-4">
              <TrendingUp className="h-6 w-6 text-[#D4AF37]" />
              Recettes (Ventes) Hebdo
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[400px] p-10">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <defs>
                  <linearGradient id="barGradient" x1="0" x2="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D4AF37" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#D4AF37" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: '900', fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: '900', fill: '#64748b' }} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}} 
                  contentStyle={{ 
                    borderRadius: '24px', 
                    border: 'none', 
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', 
                    fontWeight: 'bold', 
                    padding: '16px',
                    backgroundColor: '#ffffff'
                  }} 
                />
                <Bar dataKey="total" fill="url(#barGradient)" radius={[12, 12, 0, 0]} barSize={40} animationDuration={1000} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-xl shadow-slate-200/50 border-none overflow-hidden rounded-[60px] bg-white animate-subtle">
          <CardHeader className="p-10 border-b bg-slate-50/50">
            <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-[#0D1B2A]">PARTS DE MUTUELLE</CardTitle>
          </CardHeader>
          <CardContent className="p-10 flex flex-col items-center">
             <div className="w-full h-[250px]">
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={mutuelleData} 
                    innerRadius={70} 
                    outerRadius={100} 
                    paddingAngle={8} 
                    dataKey="value"
                    animationBegin={200}
                    animationDuration={1200}
                  >
                    {mutuelleData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} strokeWidth={0} />)}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '20px', 
                      border: 'none', 
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                      backgroundColor: '#ffffff',
                      fontWeight: 'bold'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
             </div>
             <div className="grid grid-cols-2 gap-x-10 gap-y-5 w-full mt-8 px-6">
               {mutuelleData.map((item, i) => (
                 <div key={item.name} className="flex items-center gap-3">
                   <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                   <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
                     {item.name} <span className="text-[#D4AF37] font-bold ml-1">({item.value})</span>
                   </span>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-xl shadow-slate-200/50 border-none overflow-hidden rounded-[60px] bg-white animate-subtle">
        <CardHeader className="flex flex-row items-center justify-between p-10 border-b bg-slate-50/50">
          <CardTitle className="text-[11px] font-black uppercase tracking-[0.3em] text-[#0D1B2A]">Dernières Factures {isPrepaMode ? "(Brouillon)" : "Réelles"}</CardTitle>
          <Button variant="outline" size="sm" asChild className="h-10 px-6 font-black bg-white rounded-full shadow-md border-[#0D1B2A]/10 hover:bg-[#0D1B2A] hover:text-white transition-all uppercase tracking-widest text-[10px]">
            <Link href="/ventes" className="flex items-center gap-2">TOUT VOIR <ChevronRight className="h-4 w-4 text-[#D4AF37]" /></Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#0D1B2A]">
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-black px-10 py-6 tracking-widest text-[#D4AF37] whitespace-nowrap">ID FACTURE</TableHead>
                  <TableHead className="text-[10px] uppercase font-black px-10 py-6 tracking-widest text-[#D4AF37] whitespace-nowrap">CLIENT</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-10 py-6 tracking-widest text-[#D4AF37] whitespace-nowrap">TOTAL NET</TableHead>
                  <TableHead className="text-center text-[10px] uppercase font-black px-10 py-6 tracking-widest text-[#D4AF37] whitespace-nowrap">STATUT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSales?.length ? (
                  recentSales.map((sale: any) => (
                    <TableRow key={sale.id} className="hover:bg-slate-50 border-b last:border-0 transition-all">
                      <TableCell className="text-xs md:text-sm font-black text-[#0D1B2A] px-10 py-7 whitespace-nowrap tracking-tight">{sale.invoiceId}</TableCell>
                      <TableCell className="text-xs md:text-sm font-black text-slate-800 px-10 py-7 whitespace-nowrap uppercase">{sale.clientName}</TableCell>
                      <TableCell className="text-right px-10 py-7 whitespace-nowrap">
                        <span className="text-sm md:text-lg font-black text-[#0D1B2A] tabular-nums">
                          {formatCurrency(Number(sale.total) - (Number(sale.remise) || 0))}
                        </span>
                      </TableCell>
                      <TableCell className="text-center px-10 py-7">
                        <Badge 
                          className={cn(
                            "text-[9px] px-4 py-1.5 font-black rounded-full uppercase tracking-widest shadow-sm whitespace-nowrap border-none",
                            sale.statut === "Payé" ? "bg-[#D4AF37]/10 text-[#D4AF37]" : 
                            sale.statut === "En attente" ? "bg-red-100 text-red-700" : 
                            "bg-blue-100 text-blue-700"
                          )}
                          variant="outline"
                        >
                          {sale.statut}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-24 text-[10px] font-black uppercase text-muted-foreground opacity-30 tracking-[0.5em]">
                      Aucune vente enregistrée pour le moment.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
