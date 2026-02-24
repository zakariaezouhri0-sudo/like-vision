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
  LineChart,
  Line,
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
  { id: "OPT-2024-045", client: "Karim Tazi", date: "Il y a 10 min", total: 1850, status: "Payé" },
  { id: "OPT-2024-044", client: "Siham Alaoui", date: "Il y a 1h", total: 2400, status: "Partiel" },
  { id: "OPT-2024-043", client: "Yassine Jaber", date: "Il y a 3h", total: 950, status: "Payé" },
  { id: "OPT-2024-042", client: "Meryem Bennani", date: "Aujourd'hui", total: 3100, status: "En attente" },
];

const COLORS = ['#31577A', '#34B9DB', '#4ADE80', '#FACC15', '#F87171'];

export default function DashboardPage() {
  const today = new Date().toLocaleDateString("fr-FR", { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="space-y-8">
      {/* Header with Welcome Message */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-primary-foreground shadow-sm">
              <div className="relative">
                <Glasses className="h-6 w-6" />
                <ThumbsUp className="h-3 w-3 absolute -top-1 -right-1 bg-primary p-0.5 rounded-full" />
              </div>
            </div>
            <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Bonjour, Like Vision</h1>
          </div>
          <p className="text-muted-foreground flex items-center gap-2 capitalize">
            <CalendarDays className="h-4 w-4" />
            {today}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-3 flex items-center gap-4 shadow-sm">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">État de la Caisse</span>
            <span className="text-lg font-black text-green-600">Ouverte</span>
          </div>
          <div className="h-8 w-px bg-border" />
          <Clock className="h-5 w-5 text-primary animate-pulse" />
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-none shadow-md bg-primary text-primary-foreground overflow-hidden relative">
          <div className="absolute right-[-10%] top-[-10%] opacity-10 rotate-12">
            <TrendingUp size={120} />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase opacity-80 tracking-wider">Chiffre d'Affaires</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{formatCurrency(24850)}</div>
            <div className="flex items-center gap-1 mt-2 text-xs font-bold text-primary-foreground/90 bg-white/10 w-fit px-2 py-1 rounded-full">
              <ArrowUpRight className="h-3 w-3" />
              +12.5% ce mois
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-accent text-accent-foreground overflow-hidden relative">
          <div className="absolute right-[-10%] top-[-10%] opacity-10 rotate-12">
            <ShoppingCart size={120} />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase opacity-80 tracking-wider">Ventes du Jour</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">18 Ventes</div>
            <div className="flex items-center gap-1 mt-2 text-xs font-bold bg-black/5 w-fit px-2 py-1 rounded-full">
              <Glasses className="h-3 w-3" />
              Objectif: 85% atteint
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white overflow-hidden relative border-l-4 border-l-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Crédits à Recouvrer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-destructive">{formatCurrency(4200)}</div>
            <p className="text-xs text-muted-foreground mt-2 font-medium">12 dossiers en attente</p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md bg-white overflow-hidden relative border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Satisfaction Client</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-green-600">98%</div>
            <div className="flex items-center gap-1 mt-2 text-xs font-bold text-green-600">
              <ThumbsUp className="h-3 w-3" />
              Excellent ce mois
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-7 gap-6">
        {/* Sales Chart */}
        <Card className="lg:col-span-4 shadow-sm border-none">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Performance Hebdomadaire</CardTitle>
            <CardDescription>Évolution du chiffre d'affaires sur les 7 derniers jours.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(value) => `${value} DH`}
                />
                <Tooltip 
                  cursor={{fill: 'rgba(49, 87, 122, 0.05)'}}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [formatCurrency(value), 'Chiffre d\'Affaires']}
                />
                <Bar 
                  dataKey="total" 
                  fill="hsl(var(--primary))" 
                  radius={[6, 6, 0, 0]} 
                  barSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Insurance Distribution */}
        <Card className="lg:col-span-3 shadow-sm border-none">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Part des Mutuelles</CardTitle>
            <CardDescription>Répartition par type de couverture.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px] flex flex-col items-center justify-center">
             <div className="w-full h-full">
               <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mutuelleData}
                    cx="50%"
                    cy="45%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {mutuelleData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
             </div>
             <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-[-20px] w-full px-4">
               {mutuelleData.map((item, i) => (
                 <div key={item.name} className="flex items-center gap-2">
                   <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                   <span className="text-xs font-medium text-muted-foreground">{item.name}</span>
                   <span className="text-xs font-bold ml-auto">{item.value}%</span>
                 </div>
               ))}
             </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales Table */}
      <Card className="shadow-sm border-none">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold">Ventes Récentes</CardTitle>
            <CardDescription>Les 5 dernières transactions effectuées.</CardDescription>
          </div>
          <Badge variant="outline" className="h-8 px-4 cursor-pointer hover:bg-muted">Voir tout l'historique</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Facture</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Client</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Date/Heure</TableHead>
                  <TableHead className="text-right font-bold text-xs uppercase tracking-wider">Total</TableHead>
                  <TableHead className="text-center font-bold text-xs uppercase tracking-wider">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {RECENT_SALES.map((sale) => (
                  <TableRow key={sale.id} className="hover:bg-muted/20">
                    <TableCell className="font-bold text-primary">{sale.id}</TableCell>
                    <TableCell className="font-medium">{sale.client}</TableCell>
                    <TableCell className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {sale.date}
                    </TableCell>
                    <TableCell className="text-right font-black">{formatCurrency(sale.total)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="text-[10px] font-bold" variant={
                        sale.status === "Payé" ? "default" : 
                        sale.status === "Partiel" ? "secondary" : "outline"
                      }>
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
