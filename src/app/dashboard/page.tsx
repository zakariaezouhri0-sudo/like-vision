"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Glasses, 
  CalendarDays,
  TrendingUp,
  ShoppingCart,
  AlertCircle,
  Heart
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
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
    <div className="space-y-4 md:space-y-8">
      {/* Header Compact - Optimisé Mobile */}
      <div className="flex items-center justify-between gap-2 bg-card p-4 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-lg shrink-0">
            <Glasses className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base md:text-2xl font-black text-primary truncate capitalize">Bonjour, {userName}</h1>
            {today && (
              <p className="text-xs text-muted-foreground font-bold flex items-center gap-1 capitalize opacity-70">
                <CalendarDays className="h-3 w-3" />
                {today}
              </p>
            )}
          </div>
        </div>
        
        <div className="shrink-0">
          <div className="bg-green-100 border border-green-200 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-sm">
            <div className="h-2 w-2 rounded-full bg-green-600 animate-pulse" />
            <span className="text-[10px] md:text-xs font-black text-green-700 uppercase whitespace-nowrap tracking-wider">Caisse Ouverte</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="bg-primary text-primary-foreground border-none shadow-lg p-5 md:p-8 rounded-[24px] relative overflow-hidden group">
          <TrendingUp className="absolute -right-6 -top-6 h-32 w-32 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-300" />
          <p className="text-[10px] md:text-xs uppercase font-black opacity-70 mb-2 tracking-widest">Chiffre d'Affaire</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl md:text-4xl font-black">24 850</span>
            <span className="text-xs md:text-lg font-bold opacity-80">DH</span>
          </div>
        </Card>
        
        <Card className="bg-accent text-accent-foreground border-none shadow-lg p-5 md:p-8 rounded-[24px] relative overflow-hidden group">
          <ShoppingCart className="absolute -right-6 -top-6 h-32 w-32 opacity-20 -rotate-12 group-hover:scale-110 transition-transform duration-300" />
          <p className="text-[10px] md:text-xs uppercase font-black opacity-70 mb-2 tracking-widest">Ventes</p>
          <p className="text-2xl md:text-4xl font-black">18</p>
        </Card>
        
        <Card className="bg-card border-none border-l-[8px] border-l-destructive shadow-lg p-5 md:p-8 rounded-[24px] relative overflow-hidden group">
          <AlertCircle className="absolute -right-6 -top-6 h-32 w-32 text-destructive opacity-5 group-hover:scale-110 transition-transform duration-300" />
          <p className="text-[10px] md:text-xs uppercase font-black text-muted-foreground mb-2 tracking-widest">Reste à Recouvrer</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl md:text-4xl font-black text-destructive">4 200</span>
            <span className="text-xs md:text-lg font-bold text-destructive">DH</span>
          </div>
        </Card>
        
        <Card className="bg-card border-none border-l-[8px] border-l-green-500 shadow-lg p-5 md:p-8 rounded-[24px] relative overflow-hidden group">
          <Heart className="absolute -right-6 -top-6 h-32 w-32 text-green-500 opacity-5 group-hover:scale-110 transition-transform duration-300" />
          <p className="text-[10px] md:text-xs uppercase font-black text-muted-foreground mb-2 tracking-widest">Satisfaction</p>
          <p className="text-2xl md:text-4xl font-black text-green-600">98%</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        <Card className="lg:col-span-4 shadow-sm border-none overflow-hidden rounded-2xl">
          <CardHeader className="p-5 border-b bg-muted/10">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Performance Hebdomadaire</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] md:h-[350px] p-4 pr-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 'bold' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 'bold' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={25} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-sm border-none overflow-hidden rounded-2xl">
          <CardHeader className="p-5 border-b bg-muted/10">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Parts de Mutuelle</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] md:h-[350px] p-4 flex flex-col">
             <div className="flex-1 min-h-0">
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mutuelleData} innerRadius={50} outerRadius={80} paddingAngle={8} dataKey="value">
                    {mutuelleData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
             </div>
             <div className="grid grid-cols-2 gap-3 mt-4">
               {mutuelleData.map((item, i) => (
                 <div key={item.name} className="flex items-center gap-2 overflow-hidden">
                   <div className="h-2 w-2 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                   <span className="text-[11px] font-bold text-slate-700 truncate">{item.name} <span className="opacity-50">({item.value}%)</span></span>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-none overflow-hidden rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between p-5 border-b bg-primary/5">
          <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Dernières Ventes</CardTitle>
          <Badge variant="outline" className="text-[10px] h-7 px-3 font-black bg-white shadow-sm hover:bg-primary hover:text-white transition-colors cursor-pointer">TOUT VOIR</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-xs uppercase font-black px-6 py-4">ID Facture</TableHead>
                  <TableHead className="text-xs uppercase font-black px-6 py-4">Client</TableHead>
                  <TableHead className="text-right text-xs uppercase font-black px-6 py-4">Total</TableHead>
                  <TableHead className="text-center text-xs uppercase font-black px-6 py-4">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RECENT_SALES.map((sale) => (
                  <TableRow key={sale.id} className="hover:bg-muted/30 border-b last:border-0 transition-colors">
                    <TableCell className="text-sm font-black text-primary px-6 py-5">{sale.id}</TableCell>
                    <TableCell className="text-sm font-bold text-slate-800 px-6 py-5">{sale.client}</TableCell>
                    <TableCell className="text-right text-sm font-black text-slate-900 px-6 py-5">{formatCurrency(sale.total)}</TableCell>
                    <TableCell className="text-center px-6 py-5">
                      <Badge 
                        className={cn(
                          "text-[10px] px-3 py-1 font-black rounded-lg uppercase tracking-tighter shadow-sm",
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
