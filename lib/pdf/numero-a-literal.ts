// Convierte un importe en Bs a su literal en español (P8):
//   1112.4  -> "Un mil ciento doce 40/100 Bolivianos"
//   3060    -> "Tres mil sesenta 00/100 Bolivianos"
// Cubre hasta millones, suficiente para los importes del negocio.

const UNIDADES = [
  "",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
]

const DIEZ_A_VEINTE = [
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
]

const DECENAS = [
  "",
  "",
  "veinte",
  "treinta",
  "cuarenta",
  "cincuenta",
  "sesenta",
  "setenta",
  "ochenta",
  "noventa",
]

const CENTENAS = [
  "",
  "ciento",
  "doscientos",
  "trescientos",
  "cuatrocientos",
  "quinientos",
  "seiscientos",
  "setecientos",
  "ochocientos",
  "novecientos",
]

// 21..29 llevan tilde propia: veintidós, veintitrés, veintiséis.
const VEINTIS = [
  "veinte",
  "veintiuno",
  "veintidós",
  "veintitrés",
  "veinticuatro",
  "veinticinco",
  "veintiséis",
  "veintisiete",
  "veintiocho",
  "veintinueve",
]

// 0..99
function decenasALetras(n: number): string {
  if (n < 10) return UNIDADES[n]
  if (n < 20) return DIEZ_A_VEINTE[n - 10]
  if (n < 30) return VEINTIS[n - 20]
  const d = Math.floor(n / 10)
  const u = n % 10
  return u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`
}

// 0..999
function centenasALetras(n: number): string {
  if (n === 0) return ""
  if (n === 100) return "cien"
  const c = Math.floor(n / 100)
  const resto = n % 100
  const centena = CENTENAS[c]
  const decena = decenasALetras(resto)
  return [centena, decena].filter(Boolean).join(" ")
}

// Apócope antes de sustantivo: "veintiuno mil" -> "veintiún mil".
function apocopar(txt: string): string {
  return txt.replace(/veintiuno$/, "veintiún").replace(/uno$/, "un")
}

// 0..999999 (miles). "Un mil" es la forma usada en documentos comerciales bolivianos.
function milesALetras(n: number): string {
  if (n < 1000) return centenasALetras(n)
  const miles = Math.floor(n / 1000)
  const resto = n % 1000
  const milesTxt = miles === 1 ? "un mil" : `${apocopar(centenasALetras(miles))} mil`
  return [milesTxt, centenasALetras(resto)].filter(Boolean).join(" ")
}

// 0..999,999,999 (millones)
function enteroALetras(n: number): string {
  if (n === 0) return "cero"
  if (n < 1_000_000) return milesALetras(n)
  const millones = Math.floor(n / 1_000_000)
  const resto = n % 1_000_000
  const millonesTxt = millones === 1 ? "un millón" : `${apocopar(milesALetras(millones))} millones`
  return [millonesTxt, milesALetras(resto)].filter(Boolean).join(" ")
}

/**
 * Importe en literal para documentos: "Un mil ciento doce 40/100 Bolivianos".
 * Los centavos van como fracción NN/100 (formato estándar de proformas/facturas).
 */
export function importeALiteral(monto: number): string {
  const entero = Math.floor(Math.abs(monto))
  const centavos = Math.round((Math.abs(monto) - entero) * 100)
  const letras = enteroALetras(entero)
  const conMayuscula = letras.charAt(0).toUpperCase() + letras.slice(1)
  return `${conMayuscula} ${String(centavos).padStart(2, "0")}/100 Bolivianos`
}
