import {
  LayoutDashboard,
  Package,
  Boxes,
  ArrowLeftRight,
  Truck,
  ShoppingCart,
  FileText,
  CreditCard,
  Users,
  BarChart3,
  Building2,
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

export type NavGroup = {
  label: string
  items: NavItem[]
}

// Navegación agrupada por función (UI_UX.md §3). Cada grupo se muestra solo si
// tiene ítems visibles para el rol; el sidebar oculta los grupos vacíos.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Principal",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin"] }],
  },
  {
    label: "Inventario",
    items: [
      { label: "Productos", href: "/productos", icon: Package, roles: ["admin", "vendedor"] },
      { label: "Inventario / Kardex", href: "/inventario", icon: Boxes, roles: ["admin", "vendedor"] },
      { label: "Traspasos", href: "/traspasos", icon: ArrowLeftRight, roles: ["admin", "vendedor"] },
    ],
  },
  {
    label: "Compras",
    items: [
      { label: "Proveedores", href: "/proveedores", icon: Truck, roles: ["admin"] },
      { label: "Compras", href: "/compras", icon: ShoppingCart, roles: ["admin"] },
    ],
  },
  {
    label: "Ventas",
    items: [
      { label: "Clientes", href: "/clientes", icon: Users, roles: ["admin", "vendedor"] },
      { label: "Proformas", href: "/proformas", icon: FileText, roles: ["admin", "vendedor"] },
      { label: "Ventas (POS)", href: "/ventas", icon: CreditCard, roles: ["admin", "vendedor"] },
    ],
  },
  {
    label: "Administración",
    items: [
      { label: "Reportes", href: "/reportes", icon: BarChart3, roles: ["admin"] },
      { label: "Sucursales", href: "/sucursales", icon: Building2, roles: ["admin"] },
      { label: "Configuración", href: "/configuracion", icon: Settings, roles: ["admin"] },
    ],
  },
]

// Lista plana derivada de los grupos: la usa el Header para resolver el título
// de la sección actual a partir del pathname. No duplicar el orden acá.
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)
