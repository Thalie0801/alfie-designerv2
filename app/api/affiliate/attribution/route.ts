import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const REF_COOKIE = "ref";

export async function POST() {
  try {
    const refCode = cookies().get(REF_COOKIE)?.value;
    if (!refCode) {
      return NextResponse.json({ ok: true, attributed: false });
    }

    const { client, accessToken } = createServerClient();
    if (!accessToken) {
      return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
    }

    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data.user) {
      return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
    }

    const service = createServiceClient();

    const { data: affiliate } = await service
      .from("affiliates")
      .select("id")
      .eq("referral_code", refCode)
      .maybeSingle();

    if (!affiliate) {
      return NextResponse.json({ ok: true, attributed: false });
    }

    await service
      .from("affiliate_attributions")
      .upsert({ affiliate_id: affiliate.id, user_id: data.user.id }, { onConflict: "affiliate_id,user_id" });

    return NextResponse.json({ ok: true, attributed: true });
  } catch (error) {
    console.error("[api/affiliate/attribution]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
