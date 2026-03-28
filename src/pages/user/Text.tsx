import { Page } from "@/layouts/user";
import { useIntl } from "react-intl";
import { useLocation } from "react-router";

export default function Component() {
    const location = useLocation();
    const intl = useIntl();

    return <Page title={(new URLSearchParams(location.search)).get('title') ?? 'untitled'}>
        <article className="p-4">
            <h1 className="text-2xl">Software Privacy Policy</h1>
            <p className="my-2">Last updated: [2025-01-01]</p>
            This Privacy Policy describes how [{intl.formatMessage({ id: 'domain' })}] ("we," "us," or "our") collects, uses, stores, and discloses information when you use our software application ("the Software"). By using the Software, you consent to the practices described in this Privacy Policy.
            <h2 className="text-xl my-2">1. Information We Collect</h2>
            <h3 className="text-lg my-2">1.1 Personal Information</h3>
            Account Information: When you create an account with the Software, we may collect your name, email address, and password to identify you and provide personalized services.
            Contact Information: If you choose to use certain features like customer support, we may collect additional contact details such as phone number to communicate with you effectively.
            <h3 className="text-lg my-2">1.2 Non - Personal Information</h3>
            Device Information: We automatically collect information about the device you use to access the Software, including the device type, operating system version, unique device identifiers, and mobile network information. This helps us optimize the Software's performance for different devices.
            Usage Information: We track how you interact with the Software, such as the pages you visit, features you use, and actions you take. This data is used to improve the user experience, diagnose technical issues, and analyze usage trends.
            <h2 className="text-xl my-2">2. How We Use Your Information</h2>
            Provide and Maintain the Software: We use your information to operate, maintain, and improve the Software, ensuring it functions properly and meets your needs.
            Personalize Your Experience: Based on the information we collect, we may customize the Software's content, features, and advertisements to make them more relevant to you.
            Send You Communications: We may send you important notices regarding the Software, including updates to our terms, policies, and security alerts. Additionally, with your consent, we may send you promotional emails about our products and services.
            Analyze and Improve: We analyze the collected data to understand user behavior, preferences, and pain points, which helps us develop new features and improve existing ones.
            <h2 className="text-xl my-2">3. Information Sharing and Disclosure</h2>
            <h3 className="text-lg my-2">3.1 Service Providers</h3>
            We may share your information with third - party service providers who assist us in operating the Software, such as cloud hosting providers, analytics companies, and customer support services. These service providers are obligated to use your information only for the purposes for which we engage them and to maintain its confidentiality.
            <h3 className="text-lg my-2">3.2 Legal Requirements</h3>
            We may disclose your information if required to do so by law, regulation, or legal process, such as in response to a court order, subpoena, or government investigation. We may also disclose your information to protect our rights, property, or safety, and the rights, property, or safety of others.
            <h3 className="text-lg my-2">3.3 Business Transfers</h3>
            In the event of a merger, acquisition, sale of all or substantially all of our assets, or similar corporate transaction, your information may be transferred as part of that transaction. We will notify you via email or prominent notice on the Software of any such change in ownership or uses of your information, along with any choices you may have regarding your information.
            <h2 className="text-xl my-2">4. Data Security</h2>
            We implement reasonable technical and organizational measures to protect your information from unauthorized access, disclosure, alteration, and destruction. However, no method of transmission over the internet or electronic storage is 100% secure, and we cannot guarantee the absolute security of your information.
            <h2 className="text-xl my-2">5. Your Rights</h2>
            Access and Update: You have the right to access and update the personal information we hold about you. You can usually do this through your account settings within the Software.
            Delete: In some cases, you may be able to delete your personal information from our systems. Please contact our support team for assistance.
            Opt - Out: You can unsubscribe from promotional emails at any time by clicking on the "unsubscribe" link in the email or by adjusting your notification settings within the Software.
            <h2 className="text-xl my-2">6. Children's Privacy</h2>
            The Software is not intended for use by children under the age of [X]. We do not knowingly collect personal information from children. If we become aware that we have collected personal information from a child without verification of parental consent, we will delete that information as soon as possible.
            <h2 className="text-xl my-2">7. International Transfers</h2>
            Your information may be transferred to and stored on servers located outside of your country. These countries may have data protection laws that are different from those in your country. By using the Software, you consent to the international transfer of your information.
            <h2 className="text-xl my-2">8. Changes to this Privacy Policy</h2>
            We may update this Privacy Policy from time to time. When we do, we will post the updated version on this page and indicate at the top of the page the date it was last updated. We encourage you to review this Privacy Policy periodically to stay informed about how we are protecting your information.
            <h2 className="text-xl my-2">9. Contact Us</h2>
            If you have any questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us at [Contact Email Address].
            [{intl.formatMessage({ id: 'domain' })}]
        </article>
    </Page>
}