import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
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
  Upload,
  CalendarClock
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Tableau de Bord", icon: LayoutDashboard, roles: ["ADMIN"] },
  { href: "/caisse", label: "Gestion Caisse", icon: Wallet, roles: ["ADMIN", "OPTICIENNE"] },
  { href: "/caisse/sessions", label: "Sessions de Caisse", icon: CalendarClock, roles: ["ADMIN", "OPTICIENNE"] },
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
  const [mounted, setMounted] = useState(false);
  const activeRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [mounted, pathname]); // Re-run scroll when pathname changes
  
  const currentRole = (role || "OPTICIENNE").toUpperCase();
  const effectiveRole = (currentRole === "ADMIN" || currentRole === "PREPA") ? "ADMIN" : "OPTICIENNE";

  return (
    <nav className="flex flex-col gap-1.5 p-2">
      {NAV_ITEMS.filter(item => item.roles.includes(effectiveRole)).map((item) => {
        const Icon = item.icon;
        
        // Match exact path for specific items to avoid double highlight
        // or match subpaths for items like /ventes/facture/...
        const isActive = pathname === item.href || (item.href !== "/" && item.href !== "/ventes" && pathname.startsWith(item.href + "/"));
        
        // Special case for Historique vs Nouvelle to prevent overlap
        const isHistoriqueActive = item.href === "/ventes" && (pathname === "/ventes" || pathname.startsWith("/ventes/facture") || pathname.startsWith("/ventes/recu"));
        const isFinalActive = item.href === "/ventes" ? isHistoriqueActive : isActive;

        return (
          <Link
            key={item.href}
            href={item.href}
            ref={isFinalActive ? activeRef : null}
            prefetch={true}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-full transition-all text-sm font-bold group",
              isFinalActive 
                ? "bg-[#D4AF37] text-[#0D1B2A] shadow-lg scale-[1.02]" 
                : "text-white/70 hover:bg-white/10 hover:text-[#D4AF37]"
            )}
          >
            <Icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", isFinalActive ? "text-[#0D1B2A]" : "text-[#D4AF37]/40 group-hover:text-[#D4AF37]")} />
            <span className="tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}