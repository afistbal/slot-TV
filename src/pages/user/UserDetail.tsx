import { FormattedMessage, useIntl } from 'react-intl';
import { useUserStore } from '@/stores/user';
import { toast } from 'sonner';
import { logoutToAnonymousSession } from '@/lib/logoutToAnonymousSession';
import { useNavigate } from 'react-router';
import { useMinWidth768 } from '@/hooks/useMinWidth768';
import { Page } from '@/layouts/user';
import { getUserUidForDisplay } from '@/lib/formatUserUniqueIdForDisplay';

export default function Component({ embedded = false }: { embedded?: boolean } = {}) {
  const intl = useIntl();
  const userStore = useUserStore();
  const navigate = useNavigate();
  const isPc = useMinWidth768();

  const isRealAccount = userStore.signed && userStore.info && userStore.info['anonymous'] !== 1;

  function handleCopyId() {
    if (!userStore.info) return;
    navigator.clipboard.writeText(getUserUidForDisplay(userStore.info));
    toast.success(intl.formatMessage({ id: 'copied' }));
  }

  async function handleLogout() {
    const ok = await logoutToAnonymousSession();
    if (!ok) {
      return;
    }
    if (isPc) {
      navigate('/profile', { state: { openPcLogin: true }, replace: true });
    } else {
      navigate('/page/login', { replace: true });
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
            <div className="rs-user-detail__value">
              {getUserUidForDisplay(userStore.info)}
            </div>
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

