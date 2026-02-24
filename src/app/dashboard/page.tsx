
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Glasses, 
  CalendarDays, 
  TrendingUp, 
  ShoppingCart, 
  AlertCircle, 
  Heart, 
  ChevronRight,
  ThumbsUp
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

  const userName = user?.displayName || user?.email?.split('@')[0] || "Utilisateur";

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-white p-6 md:p-8 rounded-[32px] border shadow-sm border-slate-200">
        <div className="flex items-center gap-6 min-w-0">
          <div className="h-14 w-14 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg shrink-0 transform rotate-2">
            <div className="relative">
              <Glasses className="h-8 w-8" />
              <ThumbsUp className="h-4 w-4 absolute -top-1.5 -right-1.5 bg-primary p-0.5 rounded-full border border-white" />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-3xl font-black text-slate-900 truncate tracking-tight capitalize">
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
        
        <div className="shrink-0 w-full md:w-auto">
          <div className="bg-green-100 border border-green-200 rounded-2xl px-5 py-3 flex items-center justify-center md:justify-start gap-3 shadow-sm">
            <div className="h-2.5 w-2.5 rounded-full bg-green-600 animate-pulse" />
            <span className="text-[10px] font-black text-green-700 uppercase tracking-widest">Caisse Ouverte</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-primary text-primary-foreground border-none shadow-xl p-8 rounded-[40px] relative overflow-hidden group">
          <TrendingUp className="absolute -right-6 -top-6 h-40 w-40 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-500" />
          <p className="text-[11px] uppercase font-black opacity-60 mb-3 tracking-[0.2em]">Chiffre d'Affaire</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black tracking-tighter">24 850</span>
            <span className="text-lg font-black opacity-60">DH</span>
          </div>
        </Card>
        
        <Card className="bg-accent text-accent-foreground border-none shadow-xl p-8 rounded-[40px] relative overflow-hidden group">
          <ShoppingCart className="absolute -right-6 -top-6 h-40 w-40 opacity-20 -rotate-12 group-hover:scale-110 transition-transform duration-500" />
          <p className="text-[11px] uppercase font-black opacity-60 mb-3 tracking-[0.2em]">Ventes totales</p>
          <p className="text-4xl font-black tracking-tighter">18</p>
        </Card>
        
        <Card className="bg-white border border-slate-100 shadow-xl p-8 rounded-[40px] relative overflow-hidden group border-l-[12px] border-l-destructive">
          <AlertCircle className="absolute -right-6 -top-6 h-40 w-40 text-destructive opacity-5 group-hover:scale-110 transition-transform duration-500" />
          <p className="text-[11px] uppercase font-black text-muted-foreground mb-3 tracking-[0.2em]">Reste à Recouvrer</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-destructive tracking-tighter">4 200</span>
            <span className="text-lg font-black text-destructive opacity-60">DH</span>
          </div>
        </Card>
        
        <Card className="bg-white border border-slate-100 shadow-xl p-8 rounded-[40px] relative overflow-hidden group border-l-[12px] border-l-green-500">
          <Heart className="absolute -right-6 -top-6 h-40 w-40 text-green-500 opacity-5 group-hover:scale-110 transition-transform duration-500" />
          <p className="text-[11px] uppercase font-black text-muted-foreground mb-3 tracking-[0.2em]">Satisfaction</p>
          <p className="text-4xl font-black text-green-600 tracking-tighter">98%</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        <Card className="lg:col-span-4 shadow-sm border-none overflow-hidden rounded-[32px] bg-white">
          <CardHeader className="p-8 border-b bg-slate-50/50">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary flex items-center gap-3">
              <TrendingUp className="h-5 w-5" />
              Performance Hebdo
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[350px] p-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: '900', fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: '900', fill: '#64748b' }} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)', fontWeight: 'bold', padding: '12px' }} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[10, 10, 0, 0]} barSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-sm border-none overflow-hidden rounded-[32px] bg-white">
          <CardHeader className="p-8 border-b bg-slate-50/50">
            <CardTitle className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-primary">PARTS DE MUTUELLE</CardTitle>
          </CardHeader>
          <CardContent className="p-8 flex flex-col items-center">
             <div className="w-full h-[220px]">
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mutuelleData} innerRadius={60} outerRadius={90} paddingAngle={8} dataKey="value">
                    {mutuelleData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} strokeWidth={0} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
             </div>
             <div className="grid grid-cols-2 gap-x-8 gap-y-4 w-full mt-6 px-4">
               {mutuelleData.map((item, i) => (
                 <div key={item.name} className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                   <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">
                     {item.name} <span className="text-slate-400 font-bold ml-1">({item.value}%)</span>
                   </span>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-none overflow-hidden rounded-[40px] bg-white">
        <CardHeader className="flex flex-row items-center justify-between p-6 md:p-8 border-b bg-slate-50/50">
          <CardTitle className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-primary">Dernières Ventes</CardTitle>
          <Button variant="outline" size="sm" asChild className="text-[10px] h-9 px-4 font-black bg-white rounded-xl shadow-sm border-primary/20 hover:bg-primary hover:text-white transition-all whitespace-nowrap uppercase tracking-widest">
            <Link href="/ventes" className="flex items-center gap-1.5">TOUT VOIR</Link>
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80">
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-black px-4 md:px-8 py-4 md:py-6 tracking-widest text-slate-500 whitespace-nowrap">ID FACTURE</TableHead>
                  <TableHead className="text-[10px] uppercase font-black px-4 md:px-8 py-4 md:py-6 tracking-widest text-slate-500 whitespace-nowrap">CLIENT</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-black px-4 md:px-8 py-4 md:py-6 tracking-widest text-slate-500 whitespace-nowrap">TOTAL</TableHead>
                  <TableHead className="text-center text-[10px] uppercase font-black px-4 md:px-8 py-4 md:py-6 tracking-widest text-slate-500 whitespace-nowrap">STATUT</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RECENT_SALES.map((sale) => (
                  <TableRow key={sale.id} className="hover:bg-primary/5 border-b last:border-0 transition-all">
                    <TableCell className="text-xs md:text-sm font-black text-primary px-4 md:px-8 py-5 md:py-7 whitespace-nowrap">{sale.id}</TableCell>
                    <TableCell className="text-xs md:text-sm font-black text-slate-800 px-4 md:px-8 py-5 md:py-7 whitespace-nowrap">{sale.client}</TableCell>
                    <TableCell className="text-right text-xs md:text-sm font-black text-slate-900 px-4 md:px-8 py-5 md:py-7 whitespace-nowrap">
                      <div className="flex flex-col md:block">
                        <span>{formatCurrency(sale.total).replace(' DH', '')}</span>
                        <span className="md:ml-1 font-bold text-slate-400">DH</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center px-4 md:px-8 py-5 md:py-7">
                      <Badge 
                        className={cn(
                          "text-[9px] px-3 py-1 font-black rounded-lg uppercase tracking-widest shadow-sm whitespace-nowrap border-none",
                          sale.status === "Payé" ? "bg-green-100 text-green-700" : 
                          sale.status === "En attente" ? "bg-red-100 text-red-700" : 
                          "bg-blue-100 text-blue-700"
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
