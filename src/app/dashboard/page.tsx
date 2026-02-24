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
      <div className="flex items-center justify-between gap-2 bg-card p-3 rounded-xl border shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground shrink-0">
            <Glasses className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm md:text-xl font-bold text-primary truncate capitalize">Bonjour, {userName}</h1>
            {today && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 capitalize">
                <CalendarDays className="h-3 w-3" />
                {today}
              </p>
            )}
          </div>
        </div>
        
        <div className="shrink-0">
          <div className="bg-green-50 border border-green-200 rounded-full px-2 py-1 flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-green-600 animate-pulse" />
            <span className="text-[8px] md:text-[10px] font-black text-green-700 uppercase whitespace-nowrap">Caisse Ouverte</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="bg-primary text-primary-foreground border-none shadow-lg p-4 md:p-6 rounded-[20px] relative overflow-hidden group">
          <TrendingUp className="absolute -right-4 -top-4 h-24 w-24 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-300" />
          <p className="text-[9px] md:text-[10px] uppercase font-black opacity-70 mb-2 tracking-wider">Chiffre d'Affaire</p>
          <div className="flex items-baseline gap-1">
            <span className="text-xl md:text-3xl font-black">24 850</span>
            <span className="text-[10px] md:text-sm font-bold opacity-80">DH</span>
          </div>
        </Card>
        
        <Card className="bg-accent text-accent-foreground border-none shadow-lg p-4 md:p-6 rounded-[20px] relative overflow-hidden group">
          <ShoppingCart className="absolute -right-4 -top-4 h-24 w-24 opacity-20 -rotate-12 group-hover:scale-110 transition-transform duration-300" />
          <p className="text-[9px] md:text-[10px] uppercase font-black opacity-70 mb-2 tracking-wider">Ventes</p>
          <p className="text-xl md:text-3xl font-black">18</p>
        </Card>
        
        <Card className="bg-card border-none border-l-[6px] border-l-destructive shadow-lg p-4 md:p-6 rounded-[20px] relative overflow-hidden group">
          <AlertCircle className="absolute -right-4 -top-4 h-24 w-24 text-destructive opacity-5 group-hover:scale-110 transition-transform duration-300" />
          <p className="text-[9px] md:text-[10px] uppercase font-black text-muted-foreground mb-2 tracking-wider">Montant à Recouvrer</p>
          <div className="flex items-baseline gap-1">
            <span className="text-xl md:text-3xl font-black text-destructive">4 200</span>
            <span className="text-[10px] md:text-sm font-bold text-destructive">DH</span>
          </div>
        </Card>
        
        <Card className="bg-card border-none border-l-[6px] border-l-green-500 shadow-lg p-4 md:p-6 rounded-[20px] relative overflow-hidden group">
          <Heart className="absolute -right-4 -top-4 h-24 w-24 text-green-500 opacity-5 group-hover:scale-110 transition-transform duration-300" />
          <p className="text-[9px] md:text-[10px] uppercase font-black text-muted-foreground mb-2 tracking-wider">Satisfaction</p>
          <p className="text-xl md:text-3xl font-black text-green-600">98%</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 md:gap-6">
        <Card className="lg:col-span-4 shadow-sm border-none overflow-hidden">
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-xs md:text-sm font-bold uppercase tracking-wider">Performance Semaine</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] md:h-[320px] p-2 pr-4 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 shadow-sm border-none overflow-hidden">
          <CardHeader className="p-4 border-b">
            <CardTitle className="text-xs md:text-sm font-bold uppercase tracking-wider">Répartition Mutuelles</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] md:h-[320px] p-2 flex flex-col">
             <div className="flex-1 min-h-0">
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mutuelleData} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                    {mutuelleData.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
             </div>
             <div className="grid grid-cols-2 gap-x-2 gap-y-1 mt-2">
               {mutuelleData.map((item, i) => (
                 <div key={item.name} className="flex items-center gap-1.5 overflow-hidden">
                   <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                   <span className="text-[8px] font-medium truncate">{item.name} ({item.value}%)</span>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-none overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between p-4 border-b bg-muted/20">
          <CardTitle className="text-xs md:text-sm font-bold uppercase tracking-wider">Dernières Ventes</CardTitle>
          <Badge variant="outline" className="text-[10px] h-6 font-bold">Voir Historique</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-xs uppercase font-bold whitespace-nowrap px-4 py-3">ID Facture</TableHead>
                  <TableHead className="text-xs uppercase font-bold whitespace-nowrap px-4 py-3">Client</TableHead>
                  <TableHead className="text-right text-xs uppercase font-bold whitespace-nowrap px-4 py-3">Total</TableHead>
                  <TableHead className="text-center text-xs uppercase font-bold whitespace-nowrap px-4 py-3">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RECENT_SALES.map((sale) => (
                  <TableRow key={sale.id} className="hover:bg-muted/30 border-b last:border-0">
                    <TableCell className="text-xs font-bold text-primary whitespace-nowrap px-4 py-4">{sale.id}</TableCell>
                    <TableCell className="text-xs font-medium whitespace-nowrap px-4 py-4">{sale.client}</TableCell>
                    <TableCell className="text-right text-xs font-bold whitespace-nowrap px-4 py-4">{formatCurrency(sale.total)}</TableCell>
                    <TableCell className="text-center px-4 py-4">
                      <Badge 
                        className="text-[10px] px-2 py-0.5 font-black rounded-sm whitespace-nowrap" 
                        variant={sale.status === "Payé" ? "default" : sale.status === "En attente" ? "destructive" : "outline"}
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