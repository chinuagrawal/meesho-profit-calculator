import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  BarChart3,
  Tag,
  Megaphone,
  FileText,
  Receipt,
  RefreshCcw,
  TrendingUp,
  Upload,
  Settings,
  X,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/context/AppContext";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/orders", label: "Orders", icon: ShoppingBag },
  { to: "/sku-analysis", label: "SKU Analysis", icon: BarChart3 },
  { to: "/sku-costs", label: "SKU Costs", icon: Tag },
  { to: "/advertising", label: "Advertising", icon: Megaphone },
  { to: "/gst", label: "GST", icon: Receipt },
  { to: "/referral-payments", label: "Referral Payments", icon: FileText },
  { to: "/compensation", label: "Compensation & Recovery", icon: RefreshCcw },
  { to: "/break-even", label: "Break-Even", icon: Calculator },
  { to: "/import", label: "Import Data", icon: Upload },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { skuCosts, orders } = useApp();
  const missingCosts = skuCosts.filter(
    (s) => s.purchaseCostInclGST === null || s.purchaseCostInclGST === undefined
  ).length;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform lg:translate-x-0 lg:static",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">Meesho</div>
              <div className="text-[11px] text-sidebar-foreground/70 leading-tight">
                Profit Calculator
              </div>
            </div>
          </div>
          <button
            className="lg:hidden p-1.5 rounded hover:bg-sidebar-accent"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {missingCosts > 0 && orders.length > 0 && (
          <div
            className="mx-3 mt-3 p-3 rounded-lg bg-yellow-500/15 border border-yellow-500/30 cursor-pointer hover:bg-yellow-500/25"
            onClick={() => {
              navigate("/sku-costs?filter=missing");
              onClose();
            }}
          >
            <div className="text-yellow-300 text-xs font-semibold">
              ⚠ {missingCosts} SKU{missingCosts !== 1 ? "s" : ""} missing cost
            </div>
            <div className="text-yellow-200/70 text-[11px] mt-0.5">
              Click to fix missing costs
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-3 scrollbar-thin space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-white"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-white"
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border text-[11px] text-sidebar-foreground/50">
          <div>Data stays in your browser</div>
          <div className="mt-0.5">v1.0.0</div>
        </div>
      </aside>
    </>
  );
}
