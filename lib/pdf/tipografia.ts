import { Font } from "@react-pdf/renderer"

// Sin partir palabras. Por defecto @react-pdf corta con las reglas del inglés y
// deja cosas como "FIL-TRO", "SCA-NIA" o un código partido en dos; con esto una
// palabra que no entra pasa entera al renglón siguiente.
// `Font` es global al proceso: alcanza con importar este módulo desde cada
// documento PDF (`import "./tipografia"`).
Font.registerHyphenationCallback((palabra) => [palabra])
