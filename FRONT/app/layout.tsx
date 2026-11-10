import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
 title: "Page Builder — Tu negocio merece su propia web",
 description: "Crea tu sitio web sin saber código. Prueba tres plantillas y nueve tipos de módulos con un editor drag & drop. Personaliza y exporta tu sitio web.",
 icons: { icon: "/favicon.svg" }
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
 return <html lang="es"><body>{children}</body></html>;
}
