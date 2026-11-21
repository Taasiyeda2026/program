(() => {
  'use strict';

  // הגדרת כפתורי הפעילויות לכל קורס, לפי סדר הופעתם.
  // להוספת כפתור: מוסיפים לרשימת הקורס רשומה עם label ו־href.
  // label.ar ו־hrefAr הם רשות; בהיעדרם משתמשים בכותרת ובקישור בעברית.
  // primary: true שומר על העיצוב הכהה של הכפתור הראשי.
  // רשימה ריקה משאירה את כרטיס הקורס ללא כפתורי פעילות.
  const courseActivities = {
    space: [
      {
        label: { he: 'אתר הקורס', ar: 'موقع الدورة' },
        href: 'https://taasiyeda2026.github.io/spin-off/',
        primary: true
      },
      {
        label: { he: 'אתגרים', ar: 'التحديات' },
        href: 'https://taasiyeda2026.github.io/spin-off/challenge/challenges.html?lang=he',
        hrefAr: 'https://taasiyeda2026.github.io/spin-off/challenge/ar/challenges.html?lang=ar'
      },
      {
        label: { he: 'פוסטר חקר', ar: 'ملصق البحث' },
        href: 'https://taasiyeda2026.github.io/spin-off/poster.html'
      },
      {
        label: { he: 'דף ספינאוף', ar: 'صفحة الابتكار المنبثق' },
        href: 'https://taasiyeda2026.github.io/spin-off/spinoff.html'
      },
      {
        label: { he: 'פרזנטציה', ar: 'العرض التقديمي' },
        href: 'https://taasiyeda2026.github.io/spin-off/presentation.html'
      }
    ],
    premium: [
      {
        label: { he: 'אתר הקורס', ar: 'موقع الدورة' },
        href: 'https://taasiyeda2026.github.io/Premium/',
        primary: true
      }
    ],
    portzot: [
      {
        label: { he: 'אתר הקורס', ar: 'موقع الدورة' },
        href: 'https://portzot-derech.org/',
        primary: true
      },
      {
        label: { he: 'שאלון פתיחה', ar: 'استبيان تمهيدي' },
        href: 'https://portzot-derech.org/start/quiz.html?lang=he',
        hrefAr: 'https://portzot-derech.org/start/quiz.html?lang=ar'
      },
      {
        label: { he: 'תחומי החקר', ar: 'مجالات البحث' },
        href: 'https://portzot-derech.org/domains/alldomains.html?lang=he',
        hrefAr: 'https://portzot-derech.org/domains/alldomains.html?lang=ar'
      },
      {
        label: { he: 'פרסונה', ar: 'الشخصية المستهدفة' },
        href: 'https://portzot-derech.org/steps/persona.html'
      }
    ]
  };

  function renderActivities() {
    const language = document.documentElement.lang === 'ar' ? 'ar' : 'he';

    document.querySelectorAll('.courses .course').forEach(card => {
      const nav = card.querySelector('nav.links');
      if (!nav) return;
      const key = nav.dataset.courseKey || 'space';
      const activities = courseActivities[key];
      if (!activities) return;

      const fragment = document.createDocumentFragment();
      for (const activity of activities) {
        const href = language === 'ar' && activity.hrefAr ? activity.hrefAr : activity.href;
        // אין להפעיל קישורי סקריפט או כתובות שאינן קישורי אינטרנט.
        const url = new URL(href, document.baseURI);
        if (!['https:', 'http:'].includes(url.protocol)) {
          throw new Error('קישור פעילות חייב להשתמש ב־HTTP או HTTPS');
        }

        const link = document.createElement('a');
        link.className = activity.primary ? 'activity primary' : 'activity';
        link.href = href;
        const label = document.createElement('span');
        label.textContent = activity.label[language] || activity.label.he;
        if (language === 'ar' && !activity.label.ar) label.lang = 'he';
        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '←';
        link.append(label, arrow);
        fragment.append(link);
      }
      nav.replaceChildren(fragment);
    });
  }

  renderActivities();
  document.querySelectorAll('[data-lang]').forEach(button => {
    button.addEventListener('click', renderActivities);
  });
})();
