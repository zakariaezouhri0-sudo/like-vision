
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
  { href: "/dashboard", label: "Tableau de Bord", icon: LayoutDashboard, roles: ["ADMIN", "CAISSIER"] },
  { href: "/caisse", label: "Gestion Caisse", icon: Wallet, roles: ["ADMIN", "CAISSIER"] },
  { href: "/ventes/nouvelle", label: "Nouvelle Vente", icon: ShoppingCart, roles: ["ADMIN", "CAISSIER"] },
  { href: "/ventes", label: "Historique Ventes", icon: History, roles: ["ADMIN", "CAISSIER"] },
  { href: "/restes", label: "Restes à Régler", icon: HandCoins, roles: ["ADMIN", "CAISSIER"] },
  { href: "/clients", label: "Clients", icon: Eye, roles: ["ADMIN", "CAISSIER"] },
  { href: "/rapports", label: "Rapports", icon: TrendingUp, roles: ["ADMIN"] },
  { href: "/import", label: "Importation", icon: Upload, roles: ["ADMIN"] },
  { href: "/utilisateurs", label: "Utilisateurs", icon: Users, roles: ["ADMIN"] },
  { href: "/parametres", label: "Paramètres", icon: Settings, roles: ["ADMIN"] },
];

export function SidebarNav({ role = "ADMIN" }: { role?: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-2 p-4">
      {NAV_ITEMS.filter(item => item.roles.includes(role)).map((item) => {
        const Icon = item.icon;
        
        const isActive = pathname === item.href || (
          pathname.startsWith(item.href + "/") && 
          !NAV_ITEMS.some(otherItem => 
            otherItem.href !== item.href && 
            otherItem.href.startsWith(item.href + "/") && 
            (pathname === otherItem.href || pathname.startsWith(otherItem.href + "/"))
          )
        );

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium",
              isActive 
                ? "bg-primary text-primary-foreground shadow-sm" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
