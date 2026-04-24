import { FormattedMessage, useIntl } from 'react-intl';
import { useUserStore } from '@/stores/user';
import { toast } from 'sonner';
import { useLoadingStore } from '@/stores/loading';
import { auth } from '@/firebase';
import { api } from '@/api';
import { useNavigate } from 'react-router';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { Page } from '@/layouts/user';

export default function Component({ embedded = false }: { embedded?: boolean } = {}) {
  const intl = useIntl();
  const userStore = useUserStore();
  const loadingStore = useLoadingStore();
  const navigate = useNavigate();
  const isPc = useMinWidth768();

  const isRealAccount = userStore.signed && userStore.info && userStore.info['anonymous'] !== 1;

  function handleCopyId() {
    if (!userStore.info) return;
    navigator.clipboard.writeText(userStore.info['unique_id'] as string);
    toast.success(intl.formatMessage({ id: 'copied' }));
  }

  async function handleLogout() {
    try {
      loadingStore.show();
      if (isPc) {
        navigate('/profile', { state: { openPcLogin: true }, replace: true });
      } else {
        navigate('/page/login', { replace: true });
      }
      localStorage.removeItem('token');
      localStorage.removeItem('login-method');
      localStorage.removeItem('user-avatar');

      // @ts-expect-error - injected by Flutter InAppWebView
      if (window.flutter_inappwebview) {
        // @ts-expect-error - injected by Flutter InAppWebView
        await window.flutter_inappwebview.callHandler('logout');
      } else {
        await auth.signOut();
      }

      const result = await api<{ token: string; info: { [key: string]: unknown } }>('login/anonymous', {
        loading: false,
      });
      if (result.c !== 0) return;

      localStorage.setItem('token', result.d['token'] as string);
      userStore.signin(result.d['info'] as { [key: string]: unknown });
    } finally {
      loadingStore.hide();
    }
  }

  if (!isRealAccount) {
    const guestContent = (
      <div className="p-6 text-white/75">
        <FormattedMessage id="login" />
      </div>
    );
    return embedded ? guestContent : <Page title="account_infomation">{guestContent}</Page>;
  }

  const detailContent = (
    <>
      <div className="rs-user-detail">
        <div className="rs-user-detail__card">
          <button type="button" className="rs-user-detail__row" onClick={handleCopyId}>
            <div className="rs-user-detail__label">
              <FormattedMessage id="user_id" />
            </div>
            <div className="rs-user-detail__value">{userStore.info!['unique_id'] as string}</div>
          </button>
          <div className="rs-user-detail__row">
            <div className="rs-user-detail__label">
              <FormattedMessage id="user_name" />
            </div>
            <div className="rs-user-detail__value">{userStore.info!['name'] as string}</div>
          </div>
          <div className="rs-user-detail__row">
            <div className="rs-user-detail__label">
              <FormattedMessage id="user_type" />
            </div>
            <div className="rs-user-detail__value">
              <FormattedMessage id={`vip_${userStore.info!['vip'] as number}`} />
            </div>
          </div>
        </div>
      </div>

      <button type="button" className="rs-profile__btnLogin" onClick={handleLogout}>
        <FormattedMessage id="logout" />
      </button>
    </>
  );

  return embedded ? detailContent : <Page title="account_infomation">{detailContent}</Page>;
}

