import { Page } from "@/layouts/user";
import { useParams, useSearchParams } from "react-router";
import {
  CheckoutAirwallexPanel,
  parsePaymentMethod,
} from "./CheckoutAirwallexPanel";

export default function Component() {
  const params = useParams();
  const [searchParams] = useSearchParams();
  const productId = parseInt(params["id"] ?? "0", 10);
  const rawPayment = searchParams.get("payment");
  const payment = rawPayment == null ? 3 : parsePaymentMethod(rawPayment);

  const redirectHref =
    typeof window !== "undefined" ? window.location.href : "";

  return (
    <Page
      title="payment_method"
      titleClassName="rs-checkout-page__topLight"
      bodyClassName="rs-checkout-page__bodyLight"
    >
      <CheckoutAirwallexPanel
        productId={productId}
        payment={payment}
        redirectHref={redirectHref}
      />
    </Page>
  );
}
