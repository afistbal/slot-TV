import { Navigate } from 'react-router';

export default function Component() {
    return <Navigate to="/profile" replace state={{ openLanguage: true }} />;
}
