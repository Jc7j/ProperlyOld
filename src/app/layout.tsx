import "~/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";

import { TRPCReactProvider } from "~/trpc/react";
import { SyncActiveOrganization } from "~/components/clerk/SyncActiveOrganizations";
import { ThemeProvider } from "./ThemeProvider";
import { auth } from "@clerk/nextjs/server";

export const metadata: Metadata = {
  title: "Properly | Streamline your Property Management",
  description: "",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { sessionClaims } = await auth();
  return (
    <ClerkProvider>
      <SyncActiveOrganization
        membership={sessionClaims?.membership as Record<string, string>}
      />
      <html lang="en" className={`${GeistSans.variable}`}>
        <body>
          <TRPCReactProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </TRPCReactProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
