import { describe, expect, it } from "vitest";
import { normalizeIntent } from "./intent";

describe("normalizeIntent", () => {
  it("applique 5 slides par défaut pour un carrousel", () => {
    const intent = normalizeIntent({
      brandId: "brand-1",
      kind: "carousel",
      copyBrief: "Carrousel hero produit",
    });
    expect(intent.slides).toBe(5);
  });

  it("nettoie les champs optionnels", () => {
    const intent = normalizeIntent({
      brandId: "brand-1",
      kind: "image",
      copyBrief: " Image pour landing ",
      campaign: "  Lancement  ",
      assetsRefs: ["  asset-1  ", "asset-1"],
    });

    expect(intent.campaign).toBe("Lancement");
    expect(intent.assetsRefs).toEqual(["asset-1"]);
  });
});
