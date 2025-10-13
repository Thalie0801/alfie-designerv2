export const dynamic = "force-dynamic";
export const revalidate = 0;

import HomePageClient from "@/components/HomePageClient";
import { FEATURES_BY_ROLE, getRole } from "@/lib/role";
import { headers } from "next/headers";

export default function Page() {
  const role = getRole();
  const h = headers();
  (h as unknown as Headers).set?.("Vary", "Cookie");

  const features = FEATURES_BY_ROLE[role];

  return (
    <>
      <HomePageClient role={role} features={features} />
      <footer
        style={{
          textAlign: "right",
          opacity: 0.5,
          fontSize: 12,
          marginTop: 8,
          maxWidth: 1200,
          marginLeft: "auto",
          marginRight: "auto",
          padding: "0 20px",
        }}
      >
        build: {process.env.NEXT_PUBLIC_BUILD_ID}
      </footer>
    </>
  );
}
