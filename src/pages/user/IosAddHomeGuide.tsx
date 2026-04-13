import { Page } from '@/layouts/user';
import { FormattedMessage } from 'react-intl';
import step1 from '@/assets/images/1.png';
import step2 from '@/assets/images/2.png';
import step3 from '@/assets/images/3.png';

/** iOS 添加主屏幕说明：留白 + 顶栏返回 + 标题 */
export default function Component() {
    return (
        <Page title="ios_add_home_page_title" bodyClassName="bg-app-canvas">
            <div className="rs-ios-add-home">
                <div className="rs-ios-add-home__lead">
                    <FormattedMessage id="ios_add_home_guide_lead" />
                </div>

                <ol className="rs-ios-add-home__steps">
                    <li className="rs-ios-add-home__step">
                        <div className="rs-ios-add-home__stepTitle">
                            <FormattedMessage id="ios_add_home_guide_step_1" />
                        </div>
                        <img className="rs-ios-add-home__img" src={step1} alt="" loading="lazy" />
                    </li>
                    <li className="rs-ios-add-home__step">
                        <div className="rs-ios-add-home__stepTitle">
                            <FormattedMessage id="ios_add_home_guide_step_2" />
                        </div>
                        <img className="rs-ios-add-home__img" src={step2} alt="" loading="lazy" />
                    </li>
                    <li className="rs-ios-add-home__step">
                        <div className="rs-ios-add-home__stepTitle">
                            <FormattedMessage id="ios_add_home_guide_step_3" />
                        </div>
                        <img className="rs-ios-add-home__img" src={step3} alt="" loading="lazy" />
                    </li>
                </ol>
            </div>
        </Page>
    );
}
