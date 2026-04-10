import {
  Dialog,
  DialogClose,
  DialogContent,
} from "@/components/ui/dialog";
import payErrorIllustration from "@/assets/images/pay_error.svg";
import { cn } from "@/lib/utils";
import { XIcon } from "lucide-react";
import { FormattedMessage } from "react-intl";
import { useRef } from "react";
import { useNavigate } from "react-router";

type PayIncompleteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function PayIncompleteDialog({
  open,
  onOpenChange,
}: PayIncompleteDialogProps) {
  const navigate = useNavigate();
  /** 为 true 时表示本次关闭来自「意见回馈」，不再跳 shopping */
  const closingForFeedbackRef = useRef(false);

  function handleOpenChange(next: boolean) {
    if (!next) {
      if (closingForFeedbackRef.current) {
        closingForFeedbackRef.current = false;
      } else {
        navigate("/shopping");
      }
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideCloseButton
        className={cn(
          "w-[calc(100%-2rem)] max-w-[400px] gap-0 overflow-hidden border-0 bg-[#222222] p-0",
        )}
      >
        <DialogClose
          className={cn(
            "absolute top-3 right-3 z-10 rounded border-0 bg-transparent p-1 text-white/80 opacity-90 transition-opacity hover:opacity-100 focus:outline-none focus:ring-0",
          )}
          aria-label="Close"
        >
          <XIcon className="size-5" />
        </DialogClose>
        <div className="box-border flex w-full max-w-full flex-col items-center px-6 pt-10 pb-6 sm:px-8">
          <div className="relative mx-auto h-16 w-16 shrink-0">
            <img
              src={payErrorIllustration}
              alt=""
              className="h-full w-full object-contain"
            />
          </div>
          <h2 className="mt-4 mb-2 text-center text-xl font-bold text-white/90">
            <FormattedMessage id="pay_incomplete_title" />
          </h2>
          <p className="text-center text-base font-normal text-white/70">
            <FormattedMessage id="pay_incomplete_body" />
          </p>
          <div className="mt-8 flex w-full flex-col gap-2">
            <button
              type="button"
              className="h-12 w-full cursor-pointer rounded bg-[#E52E2E] text-base font-bold text-white/90"
              onClick={() => handleOpenChange(false)}
            >
              <FormattedMessage id="pay_incomplete_change_method" />
            </button>
            <button
              type="button"
              className="h-12 w-full cursor-pointer rounded bg-white/10 text-base font-bold text-white/90"
              onClick={() => {
                closingForFeedbackRef.current = true;
                handleOpenChange(false);
                navigate("/page/feedback");
              }}
            >
              <FormattedMessage id="pay_incomplete_feedback" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
