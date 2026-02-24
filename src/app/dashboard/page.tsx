"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Glasses, 
  CalendarDays,
  TrendingUp,
  ShoppingCart,
  AlertCircle,
  Heart,
  ChevronRight
} from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
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
import { useUser } from "@/firebase";
import Link from "next/link";

const salesData = [
  { name: "Lun", total: 1200 },
  { name: "Mar", total: 2100 },
  { name: "Mer", total: 1800 },
  { name: "Jeu", total: 2400 },
  { name: "Ven", total: 3200 },
  { name: "Sam", total: 4100 },
  { name: "Dim", total: 900 },
];

const mutuelleData = [
  { name: "Aucun", value: 45 },
  { name: "CNOPS", value: 20 },
  { name: "CNSS", value: 25 },
  { name: "FAR", value: 5 },
  { name: "Autre", value: 5 },
];

const RECENT_SALES = [
  { id: "OPT-2024-045", client: "Karim Tazi", date: "10 min", total: 1850, status: "Payé" },
  { id: "OPT-2024-044", client: "Siham Alaoui", date: "1h", total: 2400, status: "Partiel" },
  { id: "OPT-2024-043", client: "Yassine Jaber", date: "3h", total: 950, status: "Payé" },
  { id: "OPT-2024-042", client: "Meryem Bennani", date: "Auj.", total: 3100, status: "En attente" },
];

const COLORS = ['#31577A', '#34B9DB', '#4ADE80', '#FACC15', '#F87171'];

export default function DashboardPage() {
  const { user } = useUser();
  const [today, setToday] = useState<string>("");

  useEffect(() => {
    setToday(new Date().toLocaleDateString("fr-FR", { 
      weekday: 'short', 
      day: 'numeric',
      month: 'short'
    }));
  }, []);

  const userName = user?.displayName || user?.email?.split('@')[0] || "Administrateur";

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      <div className="flex items-center justify-between gap-4 bg-white p-5 rounded-3xl border shadow-sm border-slate-200">
        <div className="flex items-center gap-4 min-w-0">
          <div className="h-14 w-14 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground shadow-lg shrink-0 transform rotate-2">
            <Glasses className="h-8 w-8" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 truncate tracking-tight capitalize">
              Bonjour, {userName}
            </h1>
            {today && (
              <p className="text-[10px] md:text-xs text-muted-foreground font-black flex items-center gap-1.5 capitalize opacity-70 tracking-widest mt-1">
                <CalendarDays className="h-3.5 w-3.5 text-primary" />
                {today}
              </p>
            )}
          </div>
        </div>
        
        <div className="shrink-0">
          <div className="bg-green-100 border border-green-200 rounded-2xl px-4 py-2 flex items-center gap-2 shadow-sm">
            <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
            <span className="text-[10px] md:text-xs font-black text-green-700 uppercase whitespace-nowrap tracking-wider">Caisse Ouverte</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="bg-primary text-primary-foreground border-none shadow-xl p-6 md:p-8 rounded-[32px] relative overflow-hidden group">
          <TrendingUp className="absolute -right-6 -top-6 h-36 w-36 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-500" />
          <p className="text-[10px] md:text-xs uppercase font-black opacity-60 mb-3 tracking-[0.2em]">Chiffre d'Affaire</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-black tracking-tighter">24 850</span>
            <span className="text-xs md:text-lg font-black opacity-60">DH</span>
          </div>
        </Card>
        
        <Card className="bg-accent text-accent-foreground border-none shadow-xl p-6 md:p-8 rounded-[32px] relative overflow-hidden group">
          <ShoppingCart className="absolute -right-6 -top-6 h-36 w-36 opacity-20 -rotate-12 group-hover:scale-110 transition-transform duration-500" />
          <p className="text-[10px] md:text-xs uppercase font-black opacity-60 mb-3 tracking-[0.2em]">Ventes totales</p>
          <p className="text-3xl md:text-4xl font-black tracking-tighter">18</p>
        </Card>
        
        <Card className="bg-white border border-slate-100 shadow-xl p-6 md:p-8 rounded-[32px] relative overflow-hidden group border-l-[10px] border-l-destructive">
          <AlertCircle className="absolute -right-6 -top-6 h-36 w-36 text-destructive opacity-5 group-hover:scale-110 transition-transform duration-500" />
          <p className="text-[10px] md:text-xs uppercase font-black text-muted-foreground mb-3 tracking-[0.2em]">Reste à Recouvrer</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl md:text-4xl font-black text-destructive tracking-tighter">4 200</span>
            <span className="text-xs md:text-lg font-black text-destructive opacity-60">DH</span>
          </div>
        </Card>
        
        <Card className="bg-white border border-slate-100 shadow-xl p-6 md:p-8 rounded-[32px] relative overflow-hidden group border-l-[10px] border-l-green-500">
          <Heart className="absolute -right-6 -top-6 h-36 w-36 text-green-500 opacity-5 group-hover:scale-110 transition-transform duration-500" />
          <p className="text-[10px] md:text-xs uppercase font-black text-muted-foreground mb-3 tracking-[0.2em]">Satisfaction</p>
          <p className="text-3xl md:text-4xl font-black text-green-600 tracking-tighter">98%</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        <Card className="lg:col-span-4 shadow-sm border-none overflow-hidden rounded-3xl bg-white">
          <CardHeader className="p-6 border-b bg-slate-50/50">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Performance Hebdo
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] md:h-[380px] p-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: '900', fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: '900', fill: '#64748b' }} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', fontWeight: 'bold' }} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-sm border-none overflow-hidden rounded-3xl bg-white">
          <CardHeader className="p-6 border-b bg-slate-50/50">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary">Parts de Mutuelle</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] md:h-[380px] p-6 flex flex-col">
             <div className="flex-1 min-h-0">
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mutuelleData} innerRadius={60} outerRadius={95} paddingAngle={8} dataKey="value">
                    {mutuelleData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none' }} />
                </PieChart>
              </ResponsiveContainer>
             </div>
             <div className="grid grid-cols-2 gap-3 mt-6">
               {mutuelleData.map((item, i) => (
                 <div key={item.name} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100">
                   <div className="h-3 w-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                   <div className="flex flex-col min-w-0">
                     <span className="text-[10px] font-black text-slate-800 truncate uppercase leading-none">{item.name}</span>
                     <span className="text-[10px] font-bold text-slate-400">{item.value}%</span>
                   </div>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-none overflow-hidden rounded-3xl bg-white">
        <CardHeader className="flex flex-row items-center justify-between p-6 border-b bg-primary/5">
          <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary">Dernières Ventes</CardTitle>
          <Button variant="outline" size="sm" asChild className="text-[10px] h-9 px-4 font-black bg-white rounded-xl shadow-sm border-primary/20 hover:bg-primary hover:text-white transition-all">
            <Link href="/ventes">TOUT VOIR <ChevronRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="text-[11px] uppercase font-black px-6 py-5 tracking-widest text-slate-500">ID Facture</TableHead>
                  <TableHead className="text-[11px] uppercase font-black px-6 py-5 tracking-widest text-slate-500">Client</TableHead>
                  <TableHead className="text-right text-[11px] uppercase font-black px-6 py-5 tracking-widest text-slate-500">Total</TableHead>
                  <TableHead className="text-center text-[11px] uppercase font-black px-6 py-5 tracking-widest text-slate-500">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RECENT_SALES.map((sale) => (
                  <TableRow key={sale.id} className="hover:bg-primary/5 border-b last:border-0 transition-colors">
                    <TableCell className="text-sm font-black text-primary px-6 py-6">{sale.id}</TableCell>
                    <TableCell className="text-sm font-black text-slate-800 px-6 py-6">{sale.client}</TableCell>
                    <TableCell className="text-right text-sm font-black text-slate-900 px-6 py-6">{formatCurrency(sale.total)}</TableCell>
                    <TableCell className="text-center px-6 py-6">
                      <Badge 
                        className={cn(
                          "text-[10px] px-3 py-1.5 font-black rounded-lg uppercase tracking-widest shadow-sm",
                          sale.status === "Payé" ? "bg-green-100 text-green-700 border-green-200" : 
                          sale.status === "En attente" ? "bg-red-100 text-red-700 border-red-200" : 
                          "bg-blue-100 text-blue-700 border-blue-200"
                        )}
                        variant="outline"
                      >
                        {sale.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
