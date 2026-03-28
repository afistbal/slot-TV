import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { FormattedMessage } from "react-intl";
import visa from "@/assets/visa.svg";
import master from "@/assets/master.svg";
import googlePay from "@/assets/google-pay.svg";
import applePay from "@/assets/apple-pay.svg";
import { Button } from "@/components/ui/button";
import MemberTerms from "./MemberTerms";


export default function Payment({ open, onSubmit, onOpenChange }: { open: boolean, onSubmit: (payment: number) => void, onOpenChange?: (open: boolean) => void }) {
    const isIos = /Mac|iPhone|iPad|iPod/gi.test(navigator.userAgent);
    const [payment, setPayment] = useState(isIos ? 1 : 2);
    const [terms, setTerms] = useState(false);

    function handleOpenTerms() {
        setTerms(!terms);
    }

    return <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-linear-to-br from-amber-50 to-pink-50" aria-describedby="payment">
            <DrawerTitle className="flex items-center gap-4 px-4 pt-4 mb-4">
                <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                    <FormattedMessage id="payment_method" />
                </div>
                <div onClick={() => onOpenChange && onOpenChange(false)}>
                    <X />
                </div>
            </DrawerTitle>
            <div className="border-t p-8 flex flex-col gap-4">
                <button className={cn("px-4 border rounded-full h-16 bg-white/50 flex gap-1 items-center justify-center relative", payment === 1 ? 'border-red-400 bg-red-50' : '')} onClick={() => setPayment(1)}>
                    <img src={applePay} alt="Apple Pay" className="h-[30px]" />
                    {payment === 1 && <Check className="text-red-400 absolute right-8" />}
                </button>
                <button className={cn("px-4 border rounded-full h-16 bg-white/50 flex gap-1 items-center justify-center relative", payment === 2 ? 'border-red-400 bg-red-50' : '')} onClick={() => setPayment(2)}>
                    <img src={googlePay} alt="Google Pay" className="h-[28px]" />
                    {payment === 2 && <Check className="text-red-400 absolute right-8" />}
                </button>
                <button className={cn("px-4 border rounded-full h-16 bg-white/50 flex gap-1 items-center justify-center relative", payment === 3 ? 'border-red-400 bg-red-50' : '')} onClick={() => setPayment(3)}>
                    <img src={visa} alt="Visa" className="h-5" />
                    <img src={master} alt="Master" className="h-6" />
                    {payment === 3 && <Check className="text-red-400 absolute right-8" />}
                </button>
                {/* <button className={cn("px-4 border rounded-full h-16 bg-white/50 flex gap-1 items-center justify-center relative", payment === 2 ? 'border-red-400 bg-red-50' : '')} onClick={() => setPayment(2)}>
                            <img src={paypal} alt="PayPal" className="h-6 mx-auto" />
                            {payment === 2 && <Check className="text-red-400 absolute right-8" />}
                        </button> */}
            </div>
            <div className="p-8 pt-0 flex flex-col gap-4">
                <Button onClick={() => onSubmit(payment)}><FormattedMessage id="pay_now" /></Button>
                <div className="text-center text-sm text-muted-foreground">
                    <FormattedMessage id="payment_agreement" />
                    <div>「<span onClick={handleOpenTerms} className="underline"><FormattedMessage id="membership_terms_of_service" /></span>」</div>
                </div>
            </div>
        </DrawerContent>

        <Drawer open={terms} onOpenChange={handleOpenTerms}>
            <DrawerContent aria-describedby="terms">
                <DrawerTitle className="flex items-center gap-4 px-4 pt-4 mb-4">
                    <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                        <FormattedMessage id="membership_terms_of_service" />
                    </div>
                    <div onClick={() => setTerms(false)}>
                        <X />
                    </div>
                </DrawerTitle>
                <div className="p-4 border-t overflow-y-auto">
                    <MemberTerms />
                </div>
            </DrawerContent>
        </Drawer>
    </Drawer>;
}