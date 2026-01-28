
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
    en: {
        translation: {
            common: {
                welcome: "Welcome",
                logout: "Logout",
                settings: "Settings",
                profile: "Profile",
                history: "Ride History",
                financials: "Financials",
                back: "Back",
                menu: "Menu",
                loading: "Loading...",
                delete: "Delete",
                cancel: "Cancel",
                confirm: "Confirm",
            },
            settings: {
                title: "Settings",
                language: "Language",
                deleteAccount: "Delete Account",
                deleteAccountDesc: "Permanently delete your account and all data",
                warning: "This page allows you to manage sensitive account settings. Please be careful when using the delete account option.",
                confirmDeleteTitle: "Are you absolutely sure?",
                confirmDeleteDesc: "This action cannot be undone. This will permanently delete your account and remove your data from our servers.",
                deleteAction: "Yes, delete my account",
                deleting: "Deleting..."
            },
            sidebar: {
                profile: "Profile",
                financials: "Financials",
                history: "Ride History",
                settings: "Settings",
                logout: "Logout",
                version: "Version"
            }
        }
    },
    ar: {
        translation: {
            common: {
                welcome: "مرحباً",
                logout: "تسجيل الخروج",
                settings: "الإعدادات",
                profile: "الملف الشخصي",
                history: "سجل الرحلات",
                financials: "الوضع المالي",
                back: "رجوع",
                menu: "القائمة",
                loading: "جاري التحميل...",
                delete: "حذف",
                cancel: "إلغاء",
                confirm: "تأكيد",
            },
            settings: {
                title: "الإعدادات",
                language: "اللغة",
                deleteAccount: "حذف حسابي",
                deleteAccountDesc: "حذف الحساب وجميع البيانات نهائياً",
                warning: "هذه الصفحة تتيح لك التحكم في إعدادات الحساب الحساسة. يرجى الحذر عند استخدام خيار حذف الحساب.",
                confirmDeleteTitle: "هل أنت متأكد تماماً؟",
                confirmDeleteDesc: "سيتم حذف حسابك وجميع بياناتك (سجل الرحلات، التقييمات، المحفظة) نهائياً من قاعدة البيانات. لا يمكن التراجع عن هذا الإجراء.",
                deleteAction: "نعم، احذف حسابي",
                deleting: "جاري الحذف..."
            },
            sidebar: {
                profile: "الملف الشخصي",
                financials: "الوضع المالي",
                history: "سجل الرحلات",
                settings: "الإعدادات",
                logout: "تسجيل الخروج",
                version: "الإصدار"
            }
        }
    }
};

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en', // Default language is English as requested
        lng: 'en', // Force start with English to meet user requirement
        interpolation: {
            escapeValue: false // react already safes from xss
        }
    });

export default i18n;
