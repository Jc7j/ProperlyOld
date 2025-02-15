import { type ReactNode } from "react";
import { AppSidebar } from "~/components/AppSidebar";

export const metadata = {
  title: "Dashboard | Properly",
  description: "",
};

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AppSidebar>{children}</AppSidebar>;
}
