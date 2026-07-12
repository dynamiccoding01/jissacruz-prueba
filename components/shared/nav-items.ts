import {
  LayoutDashboard,
  Package,
  Boxes,
  Truck,
  ShoppingCart,
  FileText,
  CreditCard,
  Users,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react"

export type Rol = "admin" | "vendedor"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  roles: Rol[]
}

// Orden y visibilidad segun UI_UX.md seccion 3
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { label: "Productos", href: "/productos", icon: Package, roles: ["admin", "vendedor"] },
  { label: "Inventario / Kardex", href: "/inventario", icon: Boxes, roles: ["admin", "vendedor"] },
  { label: "Proveedores", href: "/proveedores", icon: Truck, roles: ["admin"] },
  { label: "Compras", href: "/compras", icon: ShoppingCart, roles: ["admin"] },
  { label: "Proformas", href: "/proformas", icon: FileText, roles: ["admin", "vendedor"] },
  { label: "Ventas (POS)", href: "/ventas", icon: CreditCard, roles: ["admin", "vendedor"] },
  { label: "Clientes", href: "/clientes", icon: Users, roles: ["admin", "vendedor"] },
  { label: "Reportes", href: "/reportes", icon: BarChart3, roles: ["admin"] },
  { label: "Configuración", href: "/configuracion", icon: Settings, roles: ["admin"] },
]
