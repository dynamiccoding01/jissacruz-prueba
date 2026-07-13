/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Las rutas /api/pdf/* leen public/logo-empresa.png en tiempo de ejecucion
    // con fs. El file-tracing de Next no detecta esa lectura (la ruta es
    // dinamica via process.cwd()), asi que en Vercel el archivo no viajaria
    // con la funcion serverless. Lo incluimos explicitamente para que el logo
    // este disponible en el bundle y aparezca en los PDFs en produccion.
    outputFileTracingIncludes: {
      "/api/pdf/proforma/[id]": ["./public/Logo_transparente_2.png"],
      "/api/pdf/venta/[id]": ["./public/Logo_transparente_2.png"],
      "/api/pdf/reporte": ["./public/Logo_transparente_2.png"],
      "/api/pdf/kardex": ["./public/Logo_transparente_2.png"],
    },
  },
}

export default nextConfig
