// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBSrKtWDxy-hTs7yhNn1ed7Mi6JKXmN_Zw",
    authDomain: "yogotv-web.firebaseapp.com",
    projectId: "yogotv-web",
    storageBucket: "yogotv-web.firebasestorage.app",
    messagingSenderId: "1006166966577",
    appId: "1:1006166966577:web:3d813140d9b9a7b696f010",
    measurementId: "G-DX8X9F9ECD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Analytics 在初始化时会请求 Firebase 的 webConfig（你看到的那个 v1alpha/.../webConfig）。
// 做成“仅生产 + 按需 + 容错”，避免本地调接口时被它的网络噪音干扰。
export let analytics: Analytics | null = null;
if (import.meta.env.PROD) {
    isSupported()
        .then((ok) => {
            if (ok) analytics = getAnalytics(app);
        })
        .catch(() => {
            analytics = null;
        });
}
export const auth = getAuth(app);