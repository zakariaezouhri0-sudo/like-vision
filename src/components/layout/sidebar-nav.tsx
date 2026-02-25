import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Wallet, 
  ShoppingCart, 
  History, 
  Users, 
  Settings, 
  Eye, 
  TrendingUp,
  HandCoins,
  Upload
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tableau de Bord", icon: LayoutDashboard, roles: ["ADMIN", "OPTICIENNE"] },
  { href: "/caisse", label: "Gestion Caisse", icon: Wallet, roles: ["ADMIN", "OPTICIENNE"] },
  { href: "/ventes/nouvelle", label: "Nouvelle Vente", icon: ShoppingCart, roles: ["ADMIN", "OPTICIENNE"] },
  { href: "/ventes", label: "Historique Ventes", icon: History, roles: ["ADMIN", "OPTICIENNE"] },
  { href: "/restes", label: "Restes à Régler", icon: HandCoins, roles: ["ADMIN", "OPTICIENNE"] },
  { href: "/clients", label: "Clients", icon: Eye, roles: ["ADMIN", "OPTICIENNE"] },
  { href: "/rapports", label: "Rapports", icon: TrendingUp, roles: ["ADMIN"] },
  { href: "/import", label: "Importation", icon: Upload, roles: ["ADMIN"] },
  { href: "/utilisateurs", label: "Utilisateurs", icon: Users, roles: ["ADMIN"] },
  { href: "/parametres", label: "Paramètres", icon: Settings, roles: ["ADMIN"] },
];

export function SidebarNav({ role = "OPTICIENNE" }: { role?: string }) {
  const pathname = usePathname();
  
  // Normalisation : Si ce n'est pas ADMIN, on considère que c'est OPTICIENNE pour l'affichage
  const currentRole = (role || "OPTICIENNE").toUpperCase();
  const effectiveRole = currentRole === "ADMIN" ? "ADMIN" : "OPTICIENNE";

  return (
    <nav className="flex flex-col gap-1.5 p-2">
      {NAV_ITEMS.filter(item => item.roles.includes(effectiveRole)).map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-bold group",
              isActive 
                ? "bg-primary text-primary-foreground shadow-md scale-[1.02]" 
                : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
            )}
          >
            <Icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-primary/40")} />
            <span className="tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
