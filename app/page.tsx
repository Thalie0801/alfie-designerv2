export const dynamic = "force-dynamic";
export const revalidate = 0;

import HomePageClient from "@/components/HomePageClient";

export default function Page() {
  return (
    <>
      <HomePageClient />
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
