import { api } from "@/api";
import Forward from "@/components/Forward";
import Loader from "@/components/Loader";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Page } from "@/layouts/admin";
import { useEffect, useState } from "react";
import { FormattedDate, FormattedMessage, FormattedTime, useIntl } from "react-intl";
import { Link, useParams } from "react-router";
import { toast } from "sonner";


export default function Component() {
    const intl = useIntl();
    const params = useParams();
    const [isAdmin, setIsAdmin] = useState('no');
    const [isVip, setIsVip] = useState('no');
    const [info, setInfo] = useState<{ [key: string]: unknown }>();
    const [loading, setLoading] = useState(true);

    function handleIsAdminChange(value: string) {
        setIsAdmin(value)
    }

    function handleIsVipChange(value: string) {
        setIsVip(value)
    }

    function handleSave() {
        api('admin/user/save', {
            data: {
                id: params['id'],
                admin: isAdmin === 'yes' ? 1 : 0,
                vip: isVip === 'yes' ? 1 : 0,
            },
        }).then(res => {
            if (res.c !== 0) {
                return;
            }
            toast.success(intl.formatMessage({ id: 'save_success' }));
        });
    }

    useEffect(() => {
        api('admin/user/info', {
            data: {
                id: params['id'],
            },
            loading: false,
        }).then(res => {
            if (res.c !== 0) {
                return;
            }
            setLoading(false);
            setIsAdmin((res.d['admin'] as number) > 0 ? 'yes' : 'no');
            setIsVip((res.d['vip'] as number) > 0 ? 'yes' : 'no');
            setInfo(res.d);
        });
    }, [])

    return <Page title="user_detail" menuButton={<div className="px-4 text-lg" onClick={handleSave}>Save</div>}>
        {loading ? <div className="h-full w-full flex justify-center items-center">
            <Loader />
        </div> : <>
            <div className="m-4 flex flex-col">
                <div className="text-slate-500 mb-2">
                    <FormattedMessage id="user_basic_info" />
                </div>
                <div className="flex gap-2 justify-between border-b border-gray-100 p-4 bg-white rounded-t-md">
                    <div className="text-muted-foreground">
                        <FormattedMessage id="id" />
                    </div>
                    <div>{info!['id'] as number}</div>
                </div>
                <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100 overflow-hidden">
                    <div className="text-muted-foreground shrink-0">
                        <FormattedMessage id="unique_id" />
                    </div>
                    <div className="wrap-anywhere text-wrap text-right">{info!['unique_id'] as string}</div>
                </div>
                <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100 overflow-hidden">
                    <div className="text-muted-foreground shrink-0">
                        <FormattedMessage id="email" />
                    </div>
                    <div className="wrap-anywhere text-wrap text-right">{info!['email'] as string}</div>
                </div>
                <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100 overflow-hidden">
                    <div className="text-muted-foreground shrink-0">
                        <FormattedMessage id="anonymous" />
                    </div>
                    <div className="wrap-anywhere text-wrap text-right">{(info!['anonymous'] as number) === 1 ? <FormattedMessage id="yes" /> : <FormattedMessage id="no" />}</div>
                </div>
                <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100">
                    <div className="text-muted-foreground">
                        <FormattedMessage id="created_at" />
                    </div>
                    <div>
                        <FormattedDate value={info!['created_at'] as string} />&nbsp;<FormattedTime value={info!['created_at'] as string} />
                    </div>
                </div>
                <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100">
                    <div className="text-muted-foreground">
                        <FormattedMessage id="login_at" />
                    </div>
                    <div>
                        {info!['login_at'] as string ? <>
                            <FormattedDate value={info!['created_at'] as string} />&nbsp;<FormattedTime value={info!['created_at'] as string} />
                        </> : 'N/A'}
                    </div>
                </div>
                <div className="flex gap-2 justify-between p-4 bg-white rounded-b-md">
                    <div className="text-muted-foreground">
                        <FormattedMessage id="active_at" />
                    </div>
                    <div>
                        {info!['active_at'] as string ? <>
                            <FormattedDate value={info!['created_at'] as string} />&nbsp;<FormattedTime value={info!['created_at'] as string} />
                        </> : 'N/A'}
                    </div>
                </div>
                <div className="flex gap-2 justify-between p-4 bg-white rounded-b-md">
                    <div className="text-muted-foreground">
                        <FormattedMessage id="retention_time" />
                    </div>
                    <div className="flex gap-1">
                        <div>{(info!['alive_time'] as number) === 0 ? '< 1' : (((info!['alive_time'] as number) / 60).toFixed(2))}</div>
                        <FormattedMessage id="minute"/>
                    </div>
                </div>
                <Link to={`/z/page/user-activity/${params['id']}`} className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100 overflow-hidden">
                    <div className="text-muted-foreground shrink-0">
                        <FormattedMessage id="activity_log" />
                    </div>
                    <div className="wrap-anywhere text-wrap text-right"><Forward /></div>
                </Link>
            </div>
            <div className="m-4 flex flex-col">
                <div className="text-slate-500 mb-2">
                    <FormattedMessage id="user_settings" />
                </div>
                <div className="flex gap-2 justify-between border-b border-gray-100 p-4 bg-white rounded-t-md">
                    <div className="text-muted-foreground">
                        <FormattedMessage id="user_is_admin" />
                    </div>
                    <RadioGroup value={isAdmin} className='flex space-x-2 mt-2' onValueChange={handleIsAdminChange}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="admin-one" />
                            <Label htmlFor="admin-one">
                                <FormattedMessage id="yes" />
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="admin-two" />
                            <Label htmlFor="admin-two">
                                <FormattedMessage id="no" />
                            </Label>
                        </div>
                    </RadioGroup>
                </div>
                <div className="flex gap-2 justify-between p-4 bg-white border-b border-gray-100">
                    <div className="text-muted-foreground">
                        <FormattedMessage id="user_is_vip" />
                    </div>
                    <RadioGroup value={isVip} className='flex space-x-2 mt-2' onValueChange={handleIsVipChange}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="vip-one" />
                            <Label htmlFor="vip-one">
                                <FormattedMessage id="yes" />
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="vip-two" />
                            <Label htmlFor="vip-two">
                                <FormattedMessage id="no" />
                            </Label>
                        </div>
                    </RadioGroup>
                </div>
            </div>
        </>}
    </Page>
}