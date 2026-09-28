import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/LegalPage";
import { legalDetails } from "@/lib/legal";

export const metadata: Metadata = {
  title: "הצהרת נגישות | Spotz",
  description: "מידע על התאמות הנגישות ופנייה בנושא נגישות בשירות Spotz.",
};

export default function AccessibilityPage() {
  return (
    <LegalPage
      eyebrow="נגישות"
      title="הצהרת נגישות"
      intro="Spotz פועלת לאפשר שימוש נוח ושוויוני בשירות לאנשים עם מוגבלויות ולמשתמשים בטכנולוגיות מסייעות."
    >
      <section aria-labelledby="accessibility-commitment">
        <h2 id="accessibility-commitment">מחויבות לנגישות</h2>
        <p>
          מטרתנו היא לשפר את נגישות השירות בהתאם לעקרונות תקן ישראלי 5568
          ולהנחיות WCAG ברמה AA, ככל שהן חלות ומתאימות לשירות. האתר טרם עבר
          ביקורת נגישות מקיפה על ידי גורם חיצוני, ולכן הצהרה זו מתארת את ההתאמות
          שבוצעו בפועל ואינה טענה להסמכה או לעמידה מלאה בכל דרישות התקן.
        </p>
      </section>

      <section aria-labelledby="accessibility-adjustments">
        <h2 id="accessibility-adjustments">התאמות שבוצעו</h2>
        <ul>
          <li>
            מבנה עמודים סמנטי, כותרות ושפה עברית בכיוון כתיבה מימין לשמאל.
          </li>
          <li>קישור דילוג ישיר לתוכן הראשי בתחילת כל עמוד.</li>
          <li>אפשרות ניווט והפעלה באמצעות מקלדת ברכיבים המרכזיים.</li>
          <li>סימון חזותי ברור לרכיב שנמצא במיקוד מקלדת.</li>
          <li>תמיכה בהעדפת מערכת להפחתת תנועה ואנימציות.</li>
          <li>אפשרות הגדלה באמצעות הדפדפן ללא חסימת פעולת הזום.</li>
          <li>
            חלונות דו־שיח עם כותרת נגישה, ניהול מיקוד, סגירה במקש Escape ומלכודת
            מיקוד.
          </li>
          <li>
            טקסט חלופי או תיאור מתאים לרכיבים חזותיים מרכזיים שבשליטת Spotz.
          </li>
        </ul>
      </section>

      <section aria-labelledby="accessibility-limitations">
        <h2 id="accessibility-limitations">מגבלות ידועות</h2>
        <p>
          חלקים מסוימים מסתמכים על רכיבי צד שלישי, ובהם מערכת ההזדהות ושירות
          WhatsApp. בנוסף, בעלי עסקים יכולים להעלות תמונות ותוכן משלהם. אנו
          פועלים לספק תשתית נגישה, אך ייתכנו פערים בתוכן או בממשקים שאינם
          בשליטתנו המלאה.
        </p>
        <p>
          מאחר שטרם הושלמה בדיקה ידנית מלאה עם מגוון קוראי מסך, דפדפנים
          וטכנולוגיות מסייעות, ייתכן שיימצאו קשיים נוספים. נשמח לקבל דיווח מפורט
          ולפעול לתיקון סביר.
        </p>
      </section>

      <section aria-labelledby="accessibility-contact">
        <h2 id="accessibility-contact">פנייה בנושא נגישות</h2>
        <p>
          איש הקשר לנגישות הוא <strong>{legalDetails.operatorName}</strong>.
          ניתן לפנות בדוא״ל לכתובת{" "}
          <a href={`mailto:${legalDetails.contactEmail}`}>
            {legalDetails.contactEmail}
          </a>
          .
        </p>
        <p>
          כדי שנוכל לטפל בפנייה ביעילות, מומלץ לציין את כתובת העמוד, תיאור
          הפעולה שניסיתם לבצע, מה לא עבד, סוג הדפדפן והמכשיר והטכנולוגיה המסייעת
          שבה השתמשתם, אם רלוונטי. נעשה מאמץ לבדוק את הפנייה ולספק פתרון או
          חלופה נגישה בזמן סביר.
        </p>
      </section>

      <section aria-labelledby="accessibility-physical">
        <h2 id="accessibility-physical">הסדרי נגישות במקום פיזי</h2>
        <p>
          Spotz הוא שירות מקוון, ובשלב זה אין קבלת קהל במיקום פיזי מטעם Spotz.
          הנגישות במקום שבו ניתן השירות בפועל היא באחריות בעל העסק הרלוונטי,
          ומומלץ לפנות אליו ישירות לבירור התאמות הנגישות במקום.
        </p>
      </section>
    </LegalPage>
  );
}
