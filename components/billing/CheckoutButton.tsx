"use client";

import { useState } from "react";
import type { BillingPlan } from "@/lib/billing/quotas";

interface CheckoutButtonProps {
  plan: BillingPlan;
  label: string;
}

export default function CheckoutButton({ plan, label }: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan }),
      });

      if (!response.ok) {
        throw new Error(`checkout_failed_${response.status}`);
      }

      const data = (await response.json()) as { url?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("missing_checkout_url");
      }
    } catch (error) {
      console.error("[billing] unable to create checkout session", error);
      setLoading(false);
      alert("Impossible d'initialiser le paiement Stripe. Réessayez dans un instant.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="checkout-button"
    >
      {loading ? "Redirection…" : label}
      <style jsx>{`
        .checkout-button {
          background: #6050ff;
          border: none;
          color: #fff;
          cursor: ${loading ? "wait" : "pointer"};
          border-radius: 999px;
          padding: 12px 20px;
          font-size: 15px;
          font-weight: 600;
          box-shadow: 0 10px 20px rgba(96, 80, 255, 0.2);
          transition: transform 0.2s ease;
        }

        .checkout-button:disabled {
          opacity: 0.7;
        }

        .checkout-button:not(:disabled):hover {
          transform: translateY(-1px);
        }
      `}</style>
    </button>
  );
}
