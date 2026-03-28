
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { FormattedMessage } from "react-intl";
import { X } from "lucide-react";

export default function FlixActionSheet({ open, onOpenChange, onAction }: { open: boolean, onAction: (type: string) => void, onOpenChange: (open: boolean) => void }) {
    return <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-linear-to-b from-yellow-100 to-white" aria-describedby="manage">
            <DrawerTitle className="flex items-center gap-4 px-4 pt-4 mb-4">
                <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                    <FormattedMessage id="my_list_manage" />
                </div>
                <div onClick={() => onOpenChange(!open)}>
                    <X />
                </div>
            </DrawerTitle>
            <div className="flex flex-col p-4 pb-12 gap-4">
                <Button onClick={() => onAction('delete')}>
                    <FormattedMessage id="delete" />
                </Button>
                <Button className="bg-slate-400" onClick={() => onOpenChange(false)}>
                    <FormattedMessage id="cancel" />
                </Button>
            </div>
        </DrawerContent>
    </Drawer>;
}