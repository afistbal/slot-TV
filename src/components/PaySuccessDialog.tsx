import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CheckCircle2 } from "lucide-react";
import { FormattedMessage } from "react-intl";

type PaySuccessDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm?: () => void;
};

export default function PaySuccessDialog({
  open,
  onOpenChange,
  onConfirm,
}: PaySuccessDialogProps) {
  function handleDialogOpenChange(next: boolean) {
    // 成功弹窗关闭行为统一按“确定”处理：关闭即刷新当前页
    if (!next) {
      onConfirm?.();
    }
    onOpenChange(next);
  }

  function handleConfirm() {
    onOpenChange(false);
    onConfirm?.();
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        hideCloseButton
        className={cn(
          "w-[calc(100%-2rem)] max-w-[400px] gap-0 overflow-hidden border-0 bg-[#222222] p-0",
        )}
      >
        <div className="box-border flex w-full max-w-full flex-col items-center px-6 pt-10 pb-6 sm:px-8">
          <div className="relative mx-auto h-16 w-16 shrink-0 flex items-center justify-center">
            <CheckCircle2 className="h-16 w-16 text-emerald-400" strokeWidth={1.8} />
          </div>
          <h2 className="mt-4 mb-2 text-center text-xl font-bold text-white/90">
            <FormattedMessage id="payment_successful" />
          </h2>
          <div className="mt-8 flex w-full flex-col gap-2">
            <button
              type="button"
              className="h-12 w-full cursor-pointer rounded bg-[#E52E2E] text-base font-bold text-white/90"
              onClick={handleConfirm}
            >
              <FormattedMessage id="ok" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

