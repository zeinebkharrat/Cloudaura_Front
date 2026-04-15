const fs = require('fs');
const path = require('path');

const extra = {
  HEBERG: {
    LIST: {
      HERO_KICKER: { fr: 'SÉJOURS', en: 'STAYS', ar: 'الإقامات' },
      HERO_STAY: { fr: 'Séjour à', en: 'Stay in', ar: 'إقامة في' },
      HERO_DISCOVER: { fr: 'Découvrez des adresses en', en: 'Discover places to stay in', ar: 'اكتشف أماكن للإقامة في' },
      HERO_TUNISIA: { fr: 'Tunisie', en: 'Tunisia', ar: 'تونس' },
      HERO_DEFAULT_DESC: {
        fr: 'Hôtels, maisons d’hôtes et séjours ruraux sélectionnés pour votre voyage.',
        en: 'Hand-picked hotels, guest houses and rural stays for your trip.',
        ar: 'فنادق وبيوت ضيافة وإقامات ريفية مختارة لرحلتك.',
      },
      FILTERS: { fr: 'Filtres', en: 'Filters', ar: 'عوامل التصفية' },
      CLEAR: { fr: 'Effacer', en: 'Clear', ar: 'مسح' },
      CITY: { fr: 'Ville', en: 'City', ar: 'المدينة' },
      ALL_CITIES: { fr: 'Toutes les villes', en: 'All cities', ar: 'كل المدن' },
      CITIES_ARIA: { fr: 'Villes', en: 'Cities', ar: 'المدن' },
      TYPE: { fr: 'Type', en: 'Type', ar: 'النوع' },
      TYPE_ALL: { fr: 'Tous', en: 'All', ar: 'الكل' },
      MAX_BUDGET: { fr: 'Budget max', en: 'Max budget', ar: 'الحد الأقصى للميزانية' },
      MIN_RATING: { fr: 'Note minimum', en: 'Minimum rating', ar: 'الحد الأدنى للتقييم' },
      SEARCHING: { fr: 'Recherche…', en: 'Searching...', ar: 'جاري البحث…' },
      LISTINGS_FOUND: { fr: 'annonce(s)', en: 'listing(s) found', ar: 'قائمة/قوائم' },
      FOUND_PREFIX: { fr: '', en: '', ar: '' },
      EMPTY_TITLE: { fr: 'Aucune annonce', en: 'No listings found', ar: 'لا قوائم' },
      EMPTY_DESC: {
        fr: 'Élargissez les filtres ou choisissez une autre ville.',
        en: 'Try widening your filters or picking another city.',
        ar: 'وسّع عوامل التصفية أو اختر مدينة أخرى.',
      },
      RESET_FILTERS: { fr: 'Réinitialiser les filtres', en: 'Reset filters', ar: 'إعادة ضبط المرشحات' },
      PICK_CITY: { fr: 'Choisir une ville', en: 'Pick a city', ar: 'اختر مدينة' },
      HOME_ALT: { fr: 'Accueil', en: 'Home', ar: 'الرئيسية' },
      CLEAR_RATING: { fr: '×', en: '×', ar: '×' },
      CLEAR_RATING_ARIA: {
        fr: 'Effacer le filtre de note',
        en: 'Clear rating filter',
        ar: 'مسح تصفية التقييم',
      },
    },
    TYPE: {
      HOTEL: { fr: 'Hôtel', en: 'Hotel', ar: 'فندق' },
      MAISON_HOTE: { fr: 'Maison d’hôtes', en: 'Guest house', ar: 'بيت ضيافة' },
      GUESTHOUSE: { fr: 'Séjour rural', en: 'Rural stay', ar: 'إقامة ريفية' },
      AUTRE: { fr: 'Autre', en: 'Other', ar: 'أخرى' },
    },
    CARD: {
      WIFI: { fr: 'Wi‑Fi', en: 'Wi‑Fi', ar: 'واي فاي' },
      PARKING: { fr: 'Parking', en: 'Parking', ar: 'موقف سيارات' },
      POOL: { fr: 'Piscine', en: 'Pool', ar: 'مسبح' },
      VIEW: { fr: 'Voir', en: 'View', ar: 'عرض' },
      NIGHT: { fr: '/ nuit', en: '/ night', ar: '/ ليلة' },
    },
  },
  ADMIN_TICKETS: {
    EYEBROW: { fr: 'Gestion des billets', en: 'Ticket Manager', ar: 'إدارة التذاكر' },
    TITLE: { fr: 'Billets', en: 'Tickets', ar: 'التذاكر' },
    SUBTITLE: {
      fr: 'Filtrez les billets, scannez les QR et validez la présence en temps réel.',
      en: 'Filter tickets, scan QR codes, and validate attendance in real time.',
      ar: 'صفِّ التذاكر، امسح رموز QR، وتحقق من الحضور لحظياً.',
    },
    OPEN_SCANNER: { fr: 'Ouvrir le scanner', en: 'Open Scanner', ar: 'فتح الماسح' },
    SEARCH: { fr: 'Recherche', en: 'Search', ar: 'بحث' },
    SEARCH_PH: {
      fr: 'Nom utilisateur, événement ou billet',
      en: 'User name, event name, or ticket name',
      ar: 'اسم المستخدم أو الحدث أو التذكرة',
    },
    DATE: { fr: 'Date', en: 'Date', ar: 'التاريخ' },
    STATUS: { fr: 'Statut', en: 'Status', ar: 'الحالة' },
    STATUS_ALL: { fr: 'Tous', en: 'All', ar: 'الكل' },
    STATUS_UPCOMING: { fr: 'À venir', en: 'Upcoming', ar: 'قادم' },
    STATUS_PRESENT: { fr: 'Présent', en: 'Present', ar: 'حاضر' },
    STATUS_ABSENT: { fr: 'Absent', en: 'Absent', ar: 'غائب' },
    APPLY: { fr: 'Appliquer', en: 'Apply', ar: 'تطبيق' },
    RESET: { fr: 'Réinitialiser', en: 'Reset', ar: 'إعادة ضبط' },
    LOADING: { fr: 'Chargement des billets…', en: 'Loading tickets...', ar: 'جاري تحميل التذاكر…' },
    EMPTY: { fr: 'Aucun billet trouvé.', en: 'No tickets found.', ar: 'لا توجد تذاكر.' },
    TH_TICKET: { fr: 'Billet', en: 'Ticket Name', ar: 'اسم التذكرة' },
    TH_USER: { fr: 'Utilisateur', en: 'User Name', ar: 'المستخدم' },
    TH_EVENT: { fr: 'Événement', en: 'Event Name', ar: 'الحدث' },
    TH_START: { fr: 'Date de début', en: 'Start Date', ar: 'تاريخ البدء' },
    TH_QR: { fr: 'Jeton QR', en: 'QR Token', ar: 'رمز QR' },
    TH_STATUS: { fr: 'Statut', en: 'Status', ar: 'الحالة' },
    SCAN_TITLE: { fr: 'Scanner QR', en: 'QR Scanner', ar: 'ماسح QR' },
    SCAN_STARTING: { fr: 'Démarrage de la caméra…', en: 'Starting camera...', ar: 'تشغيل الكاميرا…' },
    SCAN_WARN: {
      fr: 'Le scan par caméra n’est pas disponible. Vérifiez les permissions ou saisissez le jeton manuellement.',
      en: 'Camera scanning is unavailable. Please check browser permissions and use manual token input if needed.',
      ar: 'مسح الكاميرا غير متاح. تحقق من الأذونات أو أدخل الرمز يدوياً.',
    },
    MANUAL_LABEL: { fr: 'Saisie manuelle du jeton', en: 'Manual token input', ar: 'إدخال الرمز يدوياً' },
    MANUAL_PH: { fr: 'Coller l’UUID du QR', en: 'Paste QR UUID token', ar: 'الصق معرف QR' },
    VALIDATE: { fr: 'Valider', en: 'Validate', ar: 'تحقق' },
    CHECKING: { fr: 'Vérification…', en: 'Checking...', ar: 'جاري التحقق…' },
    TICKET: { fr: 'Billet', en: 'Ticket', ar: 'تذكرة' },
    USER: { fr: 'Utilisateur', en: 'User', ar: 'مستخدم' },
    EVENT: { fr: 'Événement', en: 'Event', ar: 'حدث' },
    ERR_LOAD_TITLE: { fr: 'Erreur', en: 'Error', ar: 'خطأ' },
    ERR_LOAD_BODY: {
      fr: 'Impossible de charger la liste des billets.',
      en: 'Failed to load tickets list.',
      ar: 'تعذر تحميل قائمة التذاكر.',
    },
    ERR_CAMERA_TITLE: { fr: 'Caméra', en: 'Camera Error', ar: 'الكاميرا' },
    ERR_CAMERA_BODY: {
      fr: 'Impossible d’accéder à la caméra pour le scan QR.',
      en: 'Unable to access camera for QR scanning.',
      ar: 'تعذر الوصول للكاميرا لمسح QR.',
    },
    WARN_TOKEN_TITLE: { fr: 'Jeton manquant', en: 'Missing Token', ar: 'رمز مفقود' },
    WARN_TOKEN_BODY: {
      fr: 'Saisissez d’abord un jeton QR.',
      en: 'Please enter a QR token first.',
      ar: 'يرجى إدخال رمز QR أولاً.',
    },
    WARN_USED_TITLE: { fr: 'Déjà utilisé', en: 'Already Used', ar: 'مستخدم مسبقاً' },
    WARN_USED_BODY: {
      fr: 'Ce billet a déjà été validé.',
      en: 'This ticket was already validated.',
      ar: 'تم التحقق من هذه التذكرة مسبقاً.',
    },
    OK_VALIDATED_TITLE: { fr: 'Validé', en: 'Validated', ar: 'تم التحقق' },
    OK_VALIDATED_BODY: {
      fr: 'Billet validé avec succès.',
      en: 'Ticket validated successfully.',
      ar: 'تم التحقق من التذكرة بنجاح.',
    },
    ERR_SCAN_TITLE: { fr: 'Échec du scan', en: 'Scan Failed', ar: 'فشل المسح' },
    ERR_SCAN_DEFAULT: {
      fr: 'Aucun billet trouvé pour ce code QR.',
      en: 'No ticket found for this QR code.',
      ar: 'لم يتم العثور على تذكرة لهذا الرمز.',
    },
    NO_VALUE: { fr: '—', en: '—', ar: '—' },
  },
};

function flattenForLocale(locale) {
  const out = {};
  function walk(obj, prefix) {
    for (const [k, v] of Object.entries(obj)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v) && 'fr' in v && 'en' in v && 'ar' in v) {
        out[p] = v[locale];
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        walk(v, p);
      }
    }
  }
  walk(extra, '');
  return out;
}

for (const loc of ['fr', 'en', 'ar']) {
  const file = path.join(__dirname, '../src/assets/i18n', `${loc}.json`);
  const base = JSON.parse(fs.readFileSync(file, 'utf8'));
  const flat = flattenForLocale(loc);
  for (const [keyPath, value] of Object.entries(flat)) {
    const parts = keyPath.split('.');
    let cur = base;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
  }
  fs.writeFileSync(file, JSON.stringify(base, null, 2) + '\n');
}

console.log('Merged HEBERG + ADMIN_TICKETS i18n');
