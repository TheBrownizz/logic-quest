# הפעלת חשבונות והתחברות עם Google

המדריך הזה מיועד למי שלא עבד אף פעם עם Supabase או עם Google Cloud. עושים אותו **פעם אחת**, ואחריו כפתור "התחברות עם Google" מופיע באתר. בלי המדריך האתר ממשיך לעבוד כרגיל, כאורח.

**כמה זמן:** כ־40 דקות. **עלות:** אפס (החבילות החינמיות מספיקות).

**מה תצטרך:** חשבון Google, חשבון GitHub עם גישה לריפו של המשחק, ומחשב עם Node.js (כבר מותקן אצלך, כי אתה מריץ את המשחק).

**שני דברים שמעתיקים לאורך הדרך:**
- **Project URL**, נראה כך: `https://abcdefgh.supabase.co`. החלק `abcdefgh` נקרא כאן `<ref>`.
- **anon key** (המפתח הציבורי), מפתח ארוך שמתחיל ב־`eyJ`. הוא ציבורי, מותר שיופיע באתר.

> **אסור לשים בשום מקום** את ה־`service_role` key של Supabase. הוא מפתח סודי. הוא נשאר רק בתוך Supabase, והפונקציה שמוחקת חשבון קוראת אותו משם.

---

## שלב 1: פותחים פרויקט ב־Supabase

1. נכנסים ל־https://supabase.com ולוחצים **Start your project**. נרשמים (אפשר עם GitHub).
2. לוחצים **New project** (אם מבקשים ליצור Organization, יוצרים אחד, שם חופשי, תוכנית **Free**).
3. ממלאים:
   - **Name**: `logic-quest`
   - **Database Password**: לוחצים **Generate a password**, ו**שומרים אותה** במנהל סיסמאות או בקובץ פרטי. היא לא נדרשת ביום יום, אבל אי אפשר לראות אותה שוב.
   - **Region**: בוחרים אזור קרוב לישראל, למשל **Europe (Frankfurt)** או **Europe (London)**.
4. לוחצים **Create new project** וממתינים כדקה וחצי עד שהפרויקט מוכן.
5. מעתיקים את שני הערכים:
   - **Project URL**: בתפריט הצד **Project Settings** (גלגל שיניים) ← **Data API**, שם מופיע ה־URL. אפשר גם ללחוץ על הכפתור **Connect** בראש הפרויקט.
   - **anon key**: **Project Settings** ← **API Keys** ← הלשונית **Legacy API Keys** ← השורה **anon** **public** (מתחילה ב־`eyJ`) ← **Copy**. משתמשים במפתח הזה בלבד, ולא במפתח שמתחיל ב־`sb_publishable_`. **לעולם לא** ב־**service_role**. מעתיקים את שני הערכים לקובץ זמני.

## שלב 2: יוצרים את הטבלה (schema.sql)

1. בתפריט הצד של Supabase: **SQL Editor**.
2. לוחצים **New query**.
3. פותחים בעורך הקוד שלך את הקובץ `supabase/schema.sql` מהריפו, מעתיקים את כל התוכן, ומדביקים בחלון.
4. לוחצים **Run** (או `Ctrl+Enter`). ב־SQL Editor תופיע שאלת אישור, כי בקובץ יש פקודות `drop` (הן מוחקות רק policy או trigger ישנים של הטבלה הזו). זה צפוי: לוחצים **Run this query**. אמורה להופיע ההודעה **Success. No rows returned**.
5. בדיקה: בתפריט הצד **Table Editor**. צריכה להופיע טבלה בשם `saves`.

הרצה חוזרת של הקובץ בטוחה, והיא לא מוחקת נתונים.

## שלב 3: Google Cloud, יוצרים "כניסה עם Google"

כאן אומרים ל־Google שהאתר רשאי לבקש מהמשתמשים להתחבר.

1. נכנסים ל־https://console.cloud.google.com עם חשבון Google.
2. למעלה, ליד הלוגו, לוחצים על בורר הפרויקטים ← **New Project**. **Project name**: `logic-quest` ← **Create**. מוודאים שהפרויקט החדש נבחר.
3. **מסך ההסכמה (OAuth consent screen).** בתפריט (☰): **APIs & Services** ← **OAuth consent screen**.
   (בממשק החדש של Google זה נקרא **Google Auth Platform**, ויש בו לשוניות **Branding**, **Audience**, **Clients**. הצעדים זהים.)
   - לוחצים **Get started** (אם מוצג).
   - **App name**: `Logic Quest`. **User support email**: האימייל שלך.
   - **Audience** / **User type**: בוחרים **External**.
   - **Contact information**: האימייל שלך. מסמנים הסכמה ל־User Data Policy ו־**Create**.
   - **Test users** (בלשונית **Audience**): לוחצים **Add users** ומוסיפים את כתובת ה־Gmail שלך ואת כל מי שיבדוק איתך. כל עוד האפליקציה במצב **Testing**, רק משתמשים ברשימה הזו יכולים להתחבר. בשלב 3.6 מפרסמים את האפליקציה, ואז כל אחד יכול.
4. **יוצרים OAuth client ID.** **APIs & Services** ← **Credentials** ← **Create credentials** ← **OAuth client ID**.
   (בממשק החדש: **Google Auth Platform** ← **Clients** ← **Create client**.)
   - **Application type**: **Web application**. **Name**: `Logic Quest web`.
   - **Authorized JavaScript origins** ← **Add URI**, ומוסיפים שתיים:
     - `https://thebrownizz.github.io`
     - `http://localhost:5173`
   - **Authorized redirect URIs** ← **Add URI**:
     - `https://<ref>.supabase.co/auth/v1/callback`  (מחליפים את `<ref>` ב־ref מהשלב הראשון)
   - **Create**.
5. נפתח חלון עם **Client ID** ו־**Client secret**. מעתיקים את שניהם לקובץ זמני. ה־secret סודי: לא בריפו ולא בצ'אט.
6. **יוצאים ממצב Testing.** **Google Auth Platform** ← **Audience** ← **Publish app** ← **Confirm**. ההרשאות היחידות שהאתר מבקש הן `openid`, `email` ו־`profile` (זיהוי, אימייל ושם), ולכן Google לא דורשת אימות (verification) ואין שום בדיקה נוספת. בלי השלב הזה רק Test users יכולים להתחבר.

## שלב 4: מחברים את Google ל־Supabase

1. ב־Supabase: **Authentication** ← **Sign In / Providers** (בגרסאות קודמות: **Providers**).
2. פותחים **Google** ומפעילים **Enable Sign in with Google**.
3. מדביקים **Client ID** ו־**Client Secret** מהשלב הקודם.
4. **Save**.

## שלב 5: כתובות האתר (URL Configuration)

1. ב־Supabase: **Authentication** ← **URL Configuration**.
2. **Site URL**: `https://thebrownizz.github.io/logic-quest/`
3. **Redirect URLs** ← **Add URL**, ומוסיפים:
   - `https://thebrownizz.github.io/logic-quest/`
   - `http://localhost:5173/`
4. **Save**.

הכתובות צריכות להיות זהות לתו, כולל הלוכסן בסוף.

## שלב 6: מפעילים את פונקציית מחיקת החשבון

הפונקציה `delete-account` היא מה שמאפשר למשתמש למחוק את החשבון שלו. היא נמצאת בריפו בתיקייה `supabase/functions/delete-account`.

### דרך א (מומלצת): שורת פקודה

בטרמינל, בתיקיית הפרויקט:

```
npx supabase login
npx supabase link --project-ref <ref>
npx supabase functions deploy delete-account --use-api
```

- `login` פותח דפדפן לאישור. תמיד מפעילים את הפריסה עם `--use-api`.
- `link` יבקש את ה־Database Password מהשלב הראשון.
- אם מופיעה השאלה `Ok to proceed? (y/N)`, מקלידים `y` ו־Enter. בסוף מופיעה הודעה שהפונקציה נפרסה (`Deployed Functions ... delete-account`), ואפשר לוודא ב־**Edge Functions** בדשבורד שהיא ברשימה.
- אין צורך להגדיר מפתחות: Supabase נותן לפונקציה בעצמו את `SUPABASE_URL`, `SUPABASE_ANON_KEY` ואת `SUPABASE_SERVICE_ROLE_KEY`.

### דרך ב: דרך האתר של Supabase (בלי טרמינל)

1. **Edge Functions** ← **Deploy a new function** ← **Via Editor**.
2. **Function name**: `delete-account` (בדיוק כך).
3. מדביקים את התוכן של `supabase/functions/delete-account/index.ts`.
4. הקובץ מייבא את `./handler.ts`. אם העורך מאפשר להוסיף קובץ, מוסיפים קובץ בשם `handler.ts` ומדביקים בו את התוכן של `supabase/functions/delete-account/handler.ts`. אם לא, משתמשים בדרך א.
5. **Deploy**.

## שלב 7: מעבירים לאתר את שני הערכים (GitHub)

1. בריפו ב־GitHub: **Settings** ← **Secrets and variables** ← **Actions**.
2. בלשונית **Variables** (לא Secrets!) לוחצים **New repository variable**, ויוצרים שניים:
   - **Name**: `VITE_SUPABASE_URL`, **Value**: ה־Project URL.
   - **Name**: `VITE_SUPABASE_ANON_KEY`, **Value**: ה־anon key.
3. מוודאים ש־**Settings** ← **Pages** ← **Source** מוגדר ל־**GitHub Actions**.

## שלב 8: מפרסמים ובודקים

1. ב־GitHub: **Actions** ← **Deploy to GitHub Pages** ← **Run workflow**. ממתינים לסימן ירוק.
2. פותחים https://thebrownizz.github.io/logic-quest/. אמור להופיע כפתור **התחברות עם Google** בכותרת.
3. מתחברים. אם יש התקדמות כאורח, תופיע השאלה "לצרף את ההתקדמות מהמכשיר הזה לחשבון?".
4. פותרים חדר, ומחכים לסימן ✓ ליד התמונה.
5. **בדיקה בטלפון:** נכנסים לאתר מהטלפון ומתחברים עם אותו חשבון. החדר שפתרת במחשב צריך להופיע שם כחדר שנפתר, עם הכוכבים שלו.
6. בדיקה אחרונה, **רק עם חשבון בדיקה**: התפריט ← **מחיקת חשבון** ← מקלידים `מחק`.

### בדיקה על המחשב שלך (לפיתוח)

יוצרים קובץ `.env.local` בתיקיית הפרויקט (הוא לא עולה לגיט):

```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

מריצים `npm run dev`. השרת תמיד עולה על `http://localhost:5173`. אם הפורט תפוס, הוא ייכשל, ולא יעבור לפורט אחר, כי כתובת ה־redirect מוגדרת רק לפורט הזה.

---

## אם משהו לא עובד

| מה רואים | למה זה קורה | מה עושים |
|---|---|---|
| `Error 400: redirect_uri_mismatch` ב־Google | הכתובת ב־**Authorized redirect URIs** לא זהה לכתובת של Supabase | ב־Google Cloud ← **Credentials** ← ה־client ← בודקים שיש בדיוק `https://<ref>.supabase.co/auth/v1/callback`. אין רווח, אין לוכסן בסוף, וה־`<ref>` נכון. השינוי יכול לקחת כמה דקות |
| `Unsupported provider: provider is not enabled` | Google לא הופעל ב־Supabase | שלב 4: **Authentication** ← **Sign In / Providers** ← **Google** ← **Enable**, ולשמור |
| `Error 403: access_denied` / "האפליקציה לא עברה אימות" | האפליקציה עדיין במצב Testing, והמשתמש לא ברשימת ה־Test users | משלימים את שלב 3.6 (**Publish app**), או מוסיפים את המשתמש ב־**Test users** |
| חוזרים לאתר אבל נשארים אורחים | ה־redirect לא ברשימה, או ה־Site URL שגוי | שלב 5, ולבדוק שהכתובות זהות לתו |
| הכפתור "התחברות עם Google" לא מופיע | האתר נבנה בלי המשתנים | שלב 7. מוודאים שהם ב־**Variables** ולא ב־**Secrets**, ואז מריצים שוב את ה־Deploy |
| הכפתור לא מופיע בפיתוח מקומי | חסר `.env.local` | ראו "בדיקה על המחשב שלך", והפעלה מחדש של `npm run dev` |
| `401` במחיקת חשבון | הפונקציה לא פרוסה, או שהמשתמש לא מחובר | שלב 6. בודקים ב־**Edge Functions** שיש `delete-account`, ומתחברים מחדש לפני המחיקה |
| `404` או "Failed to send a request to the Edge Function" | שם הפונקציה שגוי, או שהיא לא נפרסה | השם חייב להיות בדיוק `delete-account`. פורסים שוב |
| אחרי המחיקה מופיעה "המחיקה נכשלה" | הפונקציה נכשלה בצד השרת | **Edge Functions** ← `delete-account` ← **Logs** |
| ✓ לא מופיע ויש ⚠ | אין חיבור, שגיאה בשרת, או שההתקדמות גדולה מדי לשמירה בענן | האתר ינסה שוב אוטומטית. אם זה נמשך, בודקים שהרצת את `schema.sql` (שלב 2) |
| אחרי חצי שנה: "Project paused" | פרויקטים חינמיים שלא בשימוש מושהים | נכנסים ל־Supabase ולוחצים **Restore project** |

אם נתקעים, שולחים ל־Claude את ההודעה המדויקת שמופיעה (בלי מפתחות!) ואת מספר השלב.
