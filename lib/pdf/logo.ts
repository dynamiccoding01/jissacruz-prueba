import "server-only"

import { readFileSync } from "fs"
import { join } from "path"

// El logo de la empresa vive como asset estatico en public/. Lo leemos una sola
// vez y lo cacheamos como data URI base64 para incrustarlo en los PDFs generados
// en el servidor con @react-pdf/renderer. Si el archivo no existe o falla la
// lectura, devolvemos null y el documento cae al nombre en texto (nunca rompe).
let cache: string | null | undefined

export function getLogoEmpresa(): string | null {
  if (cache !== undefined) return cache
  try {
    const ruta = join(process.cwd(), "public", "logo-empresa.png")
    const data = readFileSync(ruta)
    cache = `data:image/png;base64,${data.toString("base64")}`
  } catch {
    cache = null
  }
  return cache
}
