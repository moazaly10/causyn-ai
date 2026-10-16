import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "CAUSYN AI | Industrial Intelligence", description: "Predict. Understand. Prevent." };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {return <html lang="en"><body>{children}</body></html>}
