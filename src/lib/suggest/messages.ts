import type { FallbackReason } from "./types";

/** Why demo suggestions are shown, in English and Arabic. Never includes the key. */
export const fallbackMessages: Record<FallbackReason, { en: string; ar: string }> = {
  "missing-key": {
    en: "No Gemini API key is set (VITE_GEMINI_API_KEY in .env.local), so local demo suggestions are shown.",
    ar: "لم يتم ضبط مفتاح Gemini API (VITE_GEMINI_API_KEY في ‎.env.local)، لذلك تظهر اقتراحات تجريبية محلية.",
  },
  "invalid-key": {
    en: "The Gemini API rejected the key. Check VITE_GEMINI_API_KEY in .env.local and restart the dev server. Showing local demo suggestions instead.",
    ar: "رفض Gemini API المفتاح. تحقق من VITE_GEMINI_API_KEY في ‎.env.local وأعد تشغيل الخادم. تظهر اقتراحات تجريبية محلية بدلاً منها.",
  },
  permission: {
    en: "This API key isn't allowed to use the selected model. Check VITE_GEMINI_MODEL and your key's access. Showing local demo suggestions instead.",
    ar: "هذا المفتاح غير مسموح له باستخدام النموذج المحدد. تحقق من VITE_GEMINI_MODEL وصلاحيات المفتاح. تظهر اقتراحات تجريبية محلية بدلاً منها.",
  },
  "rate-limit": {
    en: "Free limit reached, try again shortly. Showing local demo suggestions for now.",
    ar: "تم بلوغ الحد المجاني، أعد المحاولة بعد قليل. تظهر اقتراحات تجريبية محلية مؤقتاً.",
  },
  timeout: {
    en: "Gemini took too long to answer. Try again. Showing local demo suggestions for now.",
    ar: "استغرق Gemini وقتاً طويلاً للرد. أعد المحاولة. تظهر اقتراحات تجريبية محلية مؤقتاً.",
  },
  network: {
    en: "Couldn't reach the Gemini API. Check your internet connection. Showing local demo suggestions instead.",
    ar: "تعذر الوصول إلى Gemini API. تحقق من اتصالك بالإنترنت. تظهر اقتراحات تجريبية محلية بدلاً منها.",
  },
  unavailable: {
    en: "The Gemini API is temporarily unavailable. Try again later. Showing local demo suggestions for now.",
    ar: "خدمة Gemini API غير متاحة مؤقتاً. أعد المحاولة لاحقاً. تظهر اقتراحات تجريبية محلية مؤقتاً.",
  },
  "server-error": {
    en: "The Gemini API had a server error. Try again later. Showing local demo suggestions for now.",
    ar: "حدث خطأ في خادم Gemini API. أعد المحاولة لاحقاً. تظهر اقتراحات تجريبية محلية مؤقتاً.",
  },
  "model-not-found": {
    en: "The model in VITE_GEMINI_MODEL wasn't found or doesn't support this request. Check the model id. Showing local demo suggestions instead.",
    ar: "لم يُعثر على النموذج المحدد في VITE_GEMINI_MODEL أو أنه لا يدعم هذا الطلب. تحقق من اسم النموذج. تظهر اقتراحات تجريبية محلية بدلاً منها.",
  },
  "bad-request": {
    en: "The Gemini API rejected the request. Check that VITE_GEMINI_MODEL is a valid model id. Showing local demo suggestions instead.",
    ar: "رفض Gemini API الطلب. تأكد أن VITE_GEMINI_MODEL اسم نموذج صحيح. تظهر اقتراحات تجريبية محلية بدلاً منها.",
  },
  blocked: {
    en: "Gemini's safety filters blocked this answer. Try rewording the description. Showing local demo suggestions instead.",
    ar: "حجبت فلاتر الأمان في Gemini هذا الرد. جرّب إعادة صياغة الوصف. تظهر اقتراحات تجريبية محلية بدلاً منها.",
  },
  empty: {
    en: "Gemini returned an empty answer. Try again. Showing local demo suggestions for now.",
    ar: "أعاد Gemini رداً فارغاً. أعد المحاولة. تظهر اقتراحات تجريبية محلية مؤقتاً.",
  },
  "bad-response": {
    en: "Gemini's answer couldn't be used. Try again. Showing local demo suggestions for now.",
    ar: "تعذر استخدام رد Gemini. أعد المحاولة. تظهر اقتراحات تجريبية محلية مؤقتاً.",
  },
};
