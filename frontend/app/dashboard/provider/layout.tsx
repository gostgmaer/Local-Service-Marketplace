import type { Metadata } from "next";
export const metadata: Metadata = {
  title: {
    default: "Provider Dashboard",
    template: "%s - Provider | Local Service Marketplace",
  },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
