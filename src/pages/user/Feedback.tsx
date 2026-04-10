import { api } from "@/api";
import { Page } from "@/layouts/user";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { toast } from "sonner";

export default function Component() {
    const intl = useIntl();
    const [content, setContent] = useState("");
    const [email, setEmail] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [sending, setSending] = useState(false);

    function handleSubmit() {
        if (content.trim().length < 5) {
            toast.warning(intl.formatMessage({ id: "feedback_content_invalid" }));
            return;
        }
        if (sending) {
            return;
        }
        setSending(true);
        api("feedback", {
            method: "post",
            data: {
                email: email.trim(),
                content: content.trim(),
            },
        })
            .then((result) => {
                if (result.c === 0) {
                    setSubmitted(true);
                }
            })
            .finally(() => {
                setSending(false);
            });
    }

    return (
        <Page title="feedback_help">
            <div className="rs-feedback">
                {submitted ? (
                    <div className="rs-feedback__success">
                        <CheckCircle2
                            className="rs-feedback__successIcon"
                            strokeWidth={1.5}
                            aria-hidden
                        />
                        <p className="rs-feedback__successText">
                            <FormattedMessage id="feedback_submitted" />
                        </p>
                    </div>
                ) : (
                    <>
                        <label className="rs-feedback__field">
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.currentTarget.value)}
                                className="rs-feedback__textarea"
                                maxLength={2000}
                                rows={8}
                                placeholder={intl.formatMessage({
                                    id: "feedback_placeholder",
                                })}
                            />
                        </label>

                        <label className="rs-feedback__field">
                            <div className="rs-feedback__labelRow">
                                <span className="rs-feedback__req" aria-hidden>
                                    *
                                </span>
                                <FormattedMessage id="email" />
                            </div>
                            <div className="rs-feedback__emailRow">
                                <input
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.currentTarget.value)}
                                    className="rs-feedback__input"
                                    maxLength={30}
                                    placeholder={intl.formatMessage({
                                        id: "email_placeholder",
                                    })}
                                />
                            </div>
                        </label>

                        <button
                            type="button"
                            className="rs-feedback__submit"
                            onClick={handleSubmit}
                            disabled={sending}
                        >
                            <FormattedMessage id="submit" />
                        </button>
                    </>
                )}
            </div>
        </Page>
    );
}
