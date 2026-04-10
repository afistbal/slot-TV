import { api, type TData } from "@/api";
import PayIncompleteDialog from "@/components/PayIncompleteDialog";
import { ReelShortBasicsSpin } from "@/components/ReelShortBasicsSpin";
import { init } from "@airwallex/components-sdk";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { useParams, useSearchParams } from "react-router";

function parsePaymentMethod(raw: string | null): number {
  const n = parseInt(raw ?? "1", 10);
  return n === 1 || n === 2 || n === 3 ? n : 1;
}

export default function Component() {
  const intl = useIntl();
  const params = useParams();
  const [searchParams] = useSearchParams();
  const [showIncomplete, setShowIncomplete] = useState(false);

  async function handleCreate() {
    try {
      const payment = parsePaymentMethod(searchParams.get("payment"));

      const result = await api<TData>("pay/create", {
        method: "post",
        loading: false,
        data: {
          payment,
          product_id: parseInt(params["id"] ?? "0", 10),
          redirect: window.location.href,
        },
      });

      if (result.c !== 0) {
        setShowIncomplete(true);
        return;
      }

      let payments;
      try {
        const initResult = await init({
          locale: "en",
          env: result.d["env"] as "prod" | "demo",
          enabledElements: ["payments"],
        });
        payments = initResult.payments;
      } catch {
        setShowIncomplete(true);
        return;
      }

      if (!payments) {
        setShowIncomplete(true);
        return;
      }

      try {
        await payments.redirectToCheckout({
          intent_id: result.d["pi"] as string,
          mode: "recurring",
          recurringOptions: {
            next_triggered_by: "merchant",
            merchant_trigger_reason: "scheduled",
          },
          customer_id: result.d["customer_id"] as string,
          client_secret: result.d["client_secret"] as string,
          currency: result.d["currency"] as string,
          successUrl: result.d["success_url"] as string,
          failUrl: result.d["fail_url"] as string,
          methods: ["card", "googlepay", "applepay"],
          applePayRequestOptions: {
            buttonType: "subscribe",
            countryCode: "HK",
          },
        });
      } catch {
        setShowIncomplete(true);
      }
    } catch {
      setShowIncomplete(true);
    }
  }

  useEffect(() => {
    handleCreate();
  }, []);

  return (
    <>
      {!showIncomplete ? (
        <div className="fixed inset-0 bg-app-canvas">
          <ReelShortBasicsSpin
            visible
            variant="modal"
            withOverlay={false}
            label={intl.formatMessage({ id: "loading" })}
          />
        </div>
      ) : null}
      <PayIncompleteDialog
        open={showIncomplete}
        onOpenChange={setShowIncomplete}
      />
    </>
  );
}
