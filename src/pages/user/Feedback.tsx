import { api } from "@/api";
import { Button } from "@/components/ui/button";
import { Page } from "@/layouts/user";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { toast } from "sonner";


export default function Component() {
    const intl = useIntl();
    const [content, setContent] = useState('');
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);

    function handleSubmit() {
        if (content.trim().length < 5) {
            toast.warning(intl.formatMessage({ id: 'feedback_content_invalid' }));
            return;
        }
        if (content.trim().length < 5) {
            toast.warning(intl.formatMessage({ id: 'feedback_content_invalid' }));
            return;
        }

        api('feedback', {
            method: 'post',
            data: {
                email: email.trim(),
                content: content.trim(),
            },
        }).then(result => {
            if (result.c === 0) {
                setSubmitted(true);
            }
        });
    }

    function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
        setContent(e.currentTarget.value);
    }

    function handleEmailChange(e: React.ChangeEvent<HTMLInputElement>) {
        setEmail(e.currentTarget.value);
    }

    return <Page title="feedback_help">
        {submitted ? <div className="w-full h-full flex justify-center items-center flex-col gap-4">
            <div>
                <CheckCircle2 className="w-24 h-24 text-green-400" />
            </div>
            <div className="text-slate-500 text-lg">
                <FormattedMessage id="feedback_submitted" />
            </div>
        </div> : <div>
            <label className="m-4 rounded-md bg-white p-4 block">
                <textarea value={content} onChange={handleContentChange} className="border-none outline-none w-full p-0 m-0 h-60 placeholder-gray-400" maxLength={2000} placeholder={intl.formatMessage({
                    id: 'feedback_placeholder'
                })} />
            </label>
            <label className="m-4 rounded-md bg-white p-4 flex gap-2 items-center">
                <div className="text-muted-foreground"><span className="text-red-400">*</span> <FormattedMessage id="email" /></div>
                <input value={email} onChange={handleEmailChange} className="flex-1 outline-none border-none p-0 h-6 placeholder-gray-400" maxLength={30} placeholder={intl.formatMessage({
                    id: 'email_placeholder'
                })} />
            </label>
            <div className="m-4 mt-8">
                <Button className="select-none" onClick={handleSubmit}><FormattedMessage id="submit" /></Button>
            </div>
        </div>}
    </Page>;
}