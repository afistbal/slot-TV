import { FormattedMessage } from "react-intl";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { ChevronLeft, ChevronRight, Gauge, Home, LayoutDashboard, MoreHorizontal, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { forwardRef, Suspense, useState } from "react";
import Loader from "@/components/Loader";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";

export default function Component() {
    const location = useLocation();

    return <div className="flex flex-col h-full">
        <div className={cn("flex gap-2 px-4 justify-between h-16 items-center border-b border-slate-200 bg-white text-slate-600")}>
            <div className="text-lg font-bold text-ellipsis flex-1 whitespace-nowrap overflow-hidden">
                <FormattedMessage id="admin" />
            </div>
            <Link to="/">
                <Home />
            </Link>
        </div>
        <div className="flex-1 overflow-auto">
            <Suspense key={location.key} fallback={<Loader />}>
                <Outlet key={location.key} />
            </Suspense>
        </div>
        <div className="p-2 grid grid-cols-2 border-t border-slate-200 bg-white text-xs text-slate-500">
            <NavLink end className='flex flex-col items-center gap-0.5' to="/z">
                <Gauge className="w-5 h-5" />
                <div>
                    <FormattedMessage id="home" />
                </div>
            </NavLink>
            <NavLink className='flex flex-col items-center gap-0.5' to="/z/management">
                <LayoutDashboard className="w-5 h-5" />
                <div>
                    <FormattedMessage id="management" />
                </div>
            </NavLink>
        </div>
    </div>;
}

interface IPage { title: string, titleClassName?: string, menu?: { id: string, name: string, confirm?: boolean, className?: string }[], menuButton?: React.ReactNode, onMenuClick?: (value: string) => void, children?: React.ReactNode }

const Page = forwardRef<HTMLDivElement, IPage>(({ title, titleClassName, menu, menuButton, onMenuClick, children }: IPage, ref) => {
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState('');

    function handleBack() {
        navigate(-1);
    }

    function handleToggleMenu() {
        setMenuOpen(!menuOpen);
    }

    function handleConfirmToggle() {
        setConfirmOpen('');
    }

    function handleOk() {
        onMenuClick && onMenuClick(confirmOpen);
        setConfirmOpen('');
    }

    return <div className="flex flex-col h-full" ref={ref}>
        <div className={cn("flex gap-2 pl-4 justify-between h-16 items-center border-b border-slate-200 text-slate-600", titleClassName || 'bg-white')}>
            {history.length > 0 ? <div onClick={handleBack}>
                {document.body.style.direction === 'ltr' ? <ChevronLeft /> : <ChevronRight />}
            </div> : <div />}
            <div className="text-lg font-bold text-ellipsis flex-1 whitespace-nowrap overflow-hidden">
                <FormattedMessage id={title} />
            </div>
            {menuButton || (menu && menu.length > 0 && onMenuClick ? <div className="w-16 h-16 flex justify-center items-center" onClick={handleToggleMenu}>
                <MoreHorizontal />
            </div> : <div />)}
        </div>
        <div className="flex-1 overflow-auto">
            {children}
        </div>
        <Drawer open={menuOpen} onOpenChange={handleToggleMenu}>
            <DrawerContent className="bg-linear-to-b from-yellow-100 to-white" aria-describedby="menu">
                <DrawerTitle className="flex items-center gap-4 px-4 pt-4 mb-4">
                    <div className="flex-1 text-lg text-ellipsis overflow-hidden text-nowrap font-bold">
                        <FormattedMessage id="more_operation" />
                    </div>
                    <div onClick={handleToggleMenu}>
                        <X />
                    </div>
                </DrawerTitle>
                <div className="flex flex-col p-4 pb-12 gap-4">
                    {menu?.map(v => <Button key={v.id} className={v.className} onClick={() => {
                        if (v.confirm) {
                            setConfirmOpen(v.id);
                        } else {
                            onMenuClick && onMenuClick(v.id);
                        }
                        setMenuOpen(false);
                    }}>
                        <FormattedMessage id={v.name} />
                    </Button>)}
                    <Button className="bg-slate-400" onClick={handleToggleMenu}>
                        <FormattedMessage id="cancel" />
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
        <Dialog open={confirmOpen !== ''} onOpenChange={handleConfirmToggle}>
            <DialogContent>
                <DialogTitle>
                    <FormattedMessage id="operation_confirm" />
                </DialogTitle>
                <DialogDescription>
                    <FormattedMessage id="operation_description" />
                </DialogDescription>
                <DialogFooter className="flex flex-row justify-end gap-4">
                    <Button className="w-32" onClick={handleOk}>
                        <FormattedMessage id="ok" />
                    </Button>
                    <Button className="bg-slate-400 w-32" onClick={handleConfirmToggle}>
                        <FormattedMessage id="cancel" />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
});


export { Page }