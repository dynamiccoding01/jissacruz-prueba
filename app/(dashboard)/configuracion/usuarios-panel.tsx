"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Power, PowerOff, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { asignarSucursal, toggleUsuarioActivo } from "./actions"
import { NuevoUsuarioForm } from "./nuevo-usuario-form"

export type UsuarioFila = {
  id: string
  nombre_completo: string
  rol: "admin" | "vendedor"
  activo: boolean
  creado_en: string
  sucursal_id: string | null
  sucursal_nombre: string | null
}

export function UsuariosPanel({
  usuarios,
  sucursales,
  currentUserId,
}: {
  usuarios: UsuarioFila[]
  sucursales: { id: string; nombre: string }[]
  currentUserId: string
}) {
  const [pendiente, startTransition] = useTransition()
  const router = useRouter()

  function onToggle(u: UsuarioFila) {
    startTransition(async () => {
      const result = await toggleUsuarioActivo(u.id, !u.activo)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(u.activo ? "Usuario desactivado." : "Usuario activado.")
      router.refresh()
    })
  }

  function onAsignarSucursal(id: string, sucursalId: string) {
    startTransition(async () => {
      const result = await asignarSucursal(id, sucursalId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Sucursal asignada.")
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Usuarios</CardTitle>
          <CardDescription>
            Invitá vendedores o administradores y controlá su acceso.
          </CardDescription>
        </div>
        <NuevoUsuarioForm
          sucursales={sucursales}
          trigger={
            <Button size="sm">
              <UserPlus className="size-4" /> Nuevo usuario
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nombre</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Alta</TableHead>
                <TableHead className="text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usuarios.map((u) => {
                const esYo = u.id === currentUserId
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.nombre_completo}
                      {esYo && <span className="ml-1 text-xs text-muted-foreground">(vos)</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.rol === "admin" ? "default" : "secondary"} className="capitalize">
                        {u.rol}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={u.sucursal_id ?? undefined}
                        onValueChange={(v) => onAsignarSucursal(u.id, v)}
                        disabled={pendiente}
                      >
                        <SelectTrigger className="h-8 w-40">
                          <SelectValue placeholder="Sin sucursal" />
                        </SelectTrigger>
                        <SelectContent>
                          {sucursales.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {u.activo ? (
                        <Badge variant="secondary">Activo</Badge>
                      ) : (
                        <Badge variant="destructive">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(u.creado_en), "dd/MM/yyyy", { locale: es })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pendiente || (esYo && u.activo)}
                        title={esYo && u.activo ? "No podés desactivar tu propia cuenta" : undefined}
                        onClick={() => onToggle(u)}
                      >
                        {u.activo ? (
                          <>
                            <PowerOff className="size-4" /> Desactivar
                          </>
                        ) : (
                          <>
                            <Power className="size-4" /> Activar
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
