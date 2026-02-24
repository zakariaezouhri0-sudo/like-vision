"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  ShoppingCart, 
  TrendingUp, 
  Users, 
  Wallet, 
  Glasses, 
  ThumbsUp, 
  ArrowUpRight, 
  ArrowDownRight,
  CalendarDays,
  Clock
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
  const today = new Date().toLocaleDateString("fr-FR", { 
    weekday: 'short', 
    day: 'numeric',
    month: 'short'
  });

  return (
    <div className="space-y-4 md:space-y-8">
      {/* Header Optimisé Mobile */}
      <div className="flex items-center justify-between gap-2 bg-card p-3 rounded-xl border shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground shrink-0">
            <Glasses className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm md:text-xl font-bold text-primary truncate">Bonjour, Like Vision</h1>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 capitalize">
              <CalendarDays className="h-3 w-3" />
              {today}
            </p>
          </div>
        </div>
        
        <div className="shrink-0">
          <div className="bg-green-50 border border-green-200 rounded-full px-2 py-1 flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-green-600 animate-pulse" />
            <span className="text-[8px] md:text-[10px] font-black text-green-700 uppercase whitespace-nowrap">Ouvert</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        <Card className="bg-primary text-primary-foreground border-none shadow-md p-3 md:p-6">
          <p className="text-[10px] uppercase font-bold opacity-70 mb-1">C.A</p>
          <p className="text-sm md:text-2xl font-black">{formatCurrency(24850).split(' ')[0]} <span className="text-[8px] md:text-sm">DH</span></p>
        </Card>
        <Card className="bg-accent text-accent-foreground border-none shadow-md p-3 md:p-6">
          <p className="text-[10px] uppercase font-bold opacity-70 mb-1">Ventes</p>
          <p className="text-sm md:text-2xl font-black">18 Dossiers</p>
        </Card>
        <Card className="border-l-4 border-l-destructive p-3 md:p-6">
          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Crédits</p>
          <p className="text-sm md:text-2xl font-black text-destructive">{formatCurrency(4200).split(' ')[0]} <span className="text-[8px] md:text-sm">DH</span></p>
        </Card>
        <Card className="border-l-4 border-l-green-500 p-3 md:p-6">
          <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Satisfaction</p>
          <p className="text-sm md:text-2xl font-black text-green-600">98%</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 md:gap-6">
        <Card className="lg:col-span-4 shadow-sm border-none">
          <CardHeader className="p-4">
            <CardTitle className="text-sm md:text-lg font-bold">Performance</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] md:h-[320px] p-0 pr-4">
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

        <Card className="lg:col-span-3 shadow-sm border-none">
          <CardHeader className="p-4">
            <CardTitle className="text-sm md:text-lg font-bold">Mutuelles</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] md:h-[320px] p-2 flex flex-col">
             <div className="flex-1 min-h-0">
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={mutuelleData} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                    {mutuelleData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
             </div>
             <div className="grid grid-cols-2 gap-2 mt-2">
               {mutuelleData.map((item, i) => (
                 <div key={item.name} className="flex items-center gap-1.5">
                   <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                   <span className="text-[8px] font-medium truncate">{item.name}</span>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-none">
        <CardHeader className="flex flex-row items-center justify-between p-4">
          <CardTitle className="text-sm md:text-lg font-bold">Ventes Récentes</CardTitle>
          <Badge variant="outline" className="text-[8px] h-6">Voir tout</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="text-[10px] uppercase font-bold whitespace-nowrap">ID</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold whitespace-nowrap">Client</TableHead>
                  <TableHead className="text-right text-[10px] uppercase font-bold whitespace-nowrap">Total</TableHead>
                  <TableHead className="text-center text-[10px] uppercase font-bold whitespace-nowrap">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RECENT_SALES.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-[10px] font-bold text-primary whitespace-nowrap">{sale.id}</TableCell>
                    <TableCell className="text-[10px] font-medium whitespace-nowrap">{sale.client}</TableCell>
                    <TableCell className="text-right text-[10px] font-bold whitespace-nowrap">{formatCurrency(sale.total)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="text-[8px] px-1.5 h-4" variant={sale.status === "Payé" ? "default" : "outline"}>
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
