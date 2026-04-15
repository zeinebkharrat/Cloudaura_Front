const fs = require('fs');
const path = require('path');

const extra = {
  TRANSPORT: {
    TYPE: {
      BUS: { fr: 'Bus', en: 'Bus', ar: 'حافلة' },
      VAN: { fr: 'Van partagé', en: 'Shared van', ar: 'فان مشترك' },
      TAXI: { fr: 'Taxi', en: 'Taxi', ar: 'سيارة أجرة' },
      CAR: { fr: 'Location de voiture', en: 'Car rental', ar: 'تأجير سيارة' },
      PLANE: { fr: 'Vol', en: 'Flight', ar: 'رحلة جوية' },
      TRAIN: { fr: 'Train', en: 'Train', ar: 'قطار' },
      FERRY: { fr: 'Ferry', en: 'Ferry', ar: 'عبّارة' },
    },
    INFRA: {
      bus: { fr: 'gare routière', en: 'bus station', ar: 'محطة حافلات' },
      airport: { fr: 'aéroport', en: 'airport', ar: 'مطار' },
      ferry: { fr: 'port de ferry', en: 'ferry port', ar: 'ميناء عبّارات' },
      train: { fr: 'gare ferroviaire', en: 'train station', ar: 'محطة قطار' },
    },
  },
  TRANSPORT_SEARCH: {
    HERO_TITLE: {
      fr: 'Trouvez votre trajet',
      en: 'Find your ride',
      ar: 'اعثر على رحلتك',
    },
    HERO_SUB: {
      fr: 'Comparez et réservez bus, taxis, voitures et vols en Tunisie',
      en: 'Compare and book buses, taxis, car rentals and flights across Tunisia',
      ar: 'قارن واحجز الحافلات والسيارات والطيران في تونس',
    },
    FROM: { fr: 'De', en: 'From', ar: 'من' },
    TO: { fr: 'Vers', en: 'To', ar: 'إلى' },
    DATE_TIME: { fr: 'Date et heure', en: 'Date & time', ar: 'التاريخ والوقت' },
    PASSENGERS: { fr: 'Passagers', en: 'Passengers', ar: 'ركاب' },
    PLACEHOLDER_FROM: { fr: 'Ville de départ', en: 'Departure city', ar: 'مدينة المغادرة' },
    PLACEHOLDER_TO: { fr: "Ville d'arrivée", en: 'Arrival city', ar: 'مدينة الوصول' },
    PLACEHOLDER_DATE: { fr: 'Date et heure de départ', en: 'Departure date & time', ar: 'تاريخ ووقت المغادرة' },
    SWAP_TT: { fr: 'Échanger les villes', en: 'Swap cities', ar: 'تبديل المدن' },
    TYPES_TITLE_BOTH: {
      fr: 'Choisissez votre mode de transport',
      en: 'Choose how you want to travel',
      ar: 'اختر وسيلة النقل',
    },
    TYPES_TITLE_WAIT: {
      fr: 'Sélectionnez les villes pour voir les modes disponibles',
      en: 'Select cities to see available modes',
      ar: 'اختر المدن لعرض الخيارات',
    },
    AVAILABLE: { fr: 'Disponible', en: 'Available', ar: 'متاح' },
    UNAVAILABLE: { fr: 'Indisponible', en: 'Unavailable', ar: 'غير متاح' },
    POPULAR_HEADING: { fr: 'Trajets populaires', en: 'Popular routes', ar: 'طرق شائعة' },
    POP_TUNIS_SOUSSE: { fr: 'Tunis → Sousse', en: 'Tunis → Sousse', ar: 'تونس → سوسة' },
    POP_TUNIS_DJERBA: { fr: 'Tunis → Djerba', en: 'Tunis → Djerba', ar: 'تونس → جربة' },
    POP_SOUSSE_HAMMAMET: { fr: 'Sousse → Hammamet', en: 'Sousse → Hammamet', ar: 'سوسة → الحمامات' },
    POP_TUNIS_SFAX: { fr: 'Tunis → Sfax', en: 'Tunis → Sfax', ar: 'تونس → صفاقس' },
    ALERT_CHECK_SEARCH: { fr: 'Vérifiez votre recherche', en: 'Check your search', ar: 'تحقق من البحث' },
    ALERT_CHECK_SEARCH_BODY: {
      fr: 'Remplissez correctement tous les champs obligatoires.',
      en: 'Please fill in all required fields correctly.',
      ar: 'يرجى تعبئة جميع الحقول المطلوبة بشكل صحيح.',
    },
    ALERT_INVALID_ROUTE: { fr: 'Trajet invalide', en: 'Invalid route', ar: 'مسار غير صالح' },
    ALERT_SAME_CITY: {
      fr: 'Le départ et la destination doivent être différents.',
      en: 'Departure and destination must be different.',
      ar: 'يجب أن يختلف المغادرة عن الوجهة.',
    },
    ALERT_INVALID_DATE: { fr: 'Date invalide', en: 'Invalid date', ar: 'تاريخ غير صالح' },
    ALERT_PAST_DATE: {
      fr: 'La date et l’heure de départ ne peuvent pas être dans le passé.',
      en: 'Departure date and time cannot be in the past.',
      ar: 'لا يمكن أن يكون تاريخ ووقت المغادرة في الماضي.',
    },
    ALERT_INCOMPLETE: { fr: 'Recherche incomplète', en: 'Incomplete search', ar: 'بحث غير مكتمل' },
    ALERT_INCOMPLETE_BODY: {
      fr: 'Sélectionnez ville de départ, d’arrivée et date/heure.',
      en: 'Please select departure city, arrival city, and departure date & time.',
      ar: 'اختر مدينة المغادرة والوصول وتاريخ ووقت المغادرة.',
    },
    ALERT_SAME_CITIES: {
      fr: 'Les villes de départ et d’arrivée doivent être différentes.',
      en: 'Departure and destination must be different cities.',
      ar: 'يجب أن تختلف مدينة المغادرة عن مدينة الوصول.',
    },
    ALERT_PASSENGERS: { fr: 'Passagers', en: 'Passengers', ar: 'ركاب' },
    ALERT_PASSENGERS_BODY: {
      fr: 'Le nombre de passagers doit être entre 1 et 20.',
      en: 'Number of passengers must be between 1 and 20.',
      ar: 'يجب أن يكون عدد الركاب بين 1 و 20.',
    },
    REASON_NO_INFRA: {
      fr: 'Pas de {{infra}} à {{city}}',
      en: 'No {{infra}} in {{city}}',
      ar: 'لا {{infra}} في {{city}}',
    },
  },
  TRANSPORT_BOOKING: {
    EDIT_BANNER: {
      fr: 'Mise à jour de votre réservation — confirmez pour enregistrer les changements sur cette réservation uniquement.',
      en: 'Updating your existing booking — confirm to save changes to this reservation only.',
      ar: 'تحديث حجزك الحالي — أكّد لحفظ التغييرات على هذا الحجز فقط.',
    },
    STEP_PASSENGERS: { fr: 'Passagers', en: 'Passengers', ar: 'ركاب' },
    STEP_PAYMENT: { fr: 'Paiement', en: 'Payment', ar: 'الدفع' },
    STEP_CONFIRMATION: { fr: 'Confirmation', en: 'Confirmation', ar: 'تأكيد' },
    PASS_TITLE: { fr: 'Coordonnées du passager', en: 'Passenger details', ar: 'بيانات المسافر' },
    PASS_SUB: {
      fr: 'Coordonnées du voyageur principal',
      en: 'Primary traveller contact information',
      ar: 'معلومات الاتصال للمسافر الرئيسي',
    },
    LABEL_FIRST: { fr: 'Prénom', en: 'First name', ar: 'الاسم الأول' },
    PH_FIRST: { fr: 'Prénom', en: 'First name', ar: 'الاسم الأول' },
    ERR_FIRST: {
      fr: 'Le prénom est requis (min. 2 caractères)',
      en: 'First name is required (min. 2 characters)',
      ar: 'الاسم الأول مطلوب (حرفان على الأقل)',
    },
    LABEL_LAST: { fr: 'Nom', en: 'Last name', ar: 'اسم العائلة' },
    PH_LAST: { fr: 'Nom', en: 'Last name', ar: 'اسم العائلة' },
    ERR_LAST: {
      fr: 'Le nom est requis (min. 2 caractères)',
      en: 'Last name is required (min. 2 characters)',
      ar: 'اسم العائلة مطلوب (حرفان على الأقل)',
    },
    LABEL_EMAIL: { fr: 'E-mail', en: 'Email', ar: 'البريد الإلكتروني' },
    PH_EMAIL: { fr: 'vous@email.com', en: 'you@email.com', ar: 'you@email.com' },
    ERR_EMAIL: {
      fr: 'Saisissez une adresse e-mail valide',
      en: 'Enter a valid email address',
      ar: 'أدخل بريداً إلكترونياً صالحاً',
    },
    LABEL_PHONE: { fr: 'Téléphone', en: 'Phone', ar: 'الهاتف' },
    PH_PHONE: { fr: '98 765 432', en: '98 765 432', ar: '98 765 432' },
    ERR_PHONE: {
      fr: 'Saisissez 8 chiffres (mobile TN sans +216)',
      en: 'Enter 8 digits (Tunisia mobile without +216)',
      ar: 'أدخل 8 أرقام (جوال تونس بدون +216)',
    },
    SEATS_RESERVED: { fr: 'place(s) réservée(s)', en: 'seat(s) reserved', ar: 'مقعد/مقاعد محجوزة' },
    BTN_CONTINUE: { fr: 'Continuer', en: 'Continue', ar: 'متابعة' },
    BTN_BACK: { fr: 'Retour', en: 'Back', ar: 'رجوع' },
    SUM_TITLE: { fr: 'Récapitulatif et paiement', en: 'Summary & payment', ar: 'الملخص والدفع' },
    SUM_SUB: {
      fr: 'Vérifiez les informations avant de confirmer',
      en: 'Review details before you confirm',
      ar: 'راجع التفاصيل قبل التأكيد',
    },
    LABEL_DATE: { fr: 'Date', en: 'Date', ar: 'التاريخ' },
    LABEL_PASSENGER: { fr: 'Passager', en: 'Passenger', ar: 'مسافر' },
    LABEL_SEATS: { fr: 'Places', en: 'Seats', ar: 'مقاعد' },
    LABEL_PHONE_SUM: { fr: 'Téléphone', en: 'Phone', ar: 'الهاتف' },
    UNIT_PRICE: { fr: 'Prix unitaire', en: 'Unit price', ar: 'سعر الوحدة' },
    SEATS_X: { fr: 'Places', en: 'Seats', ar: 'مقاعد' },
    TOTAL: { fr: 'Total', en: 'Total', ar: 'الإجمالي' },
    PAY_TITLE: { fr: 'Mode de paiement', en: 'Payment method', ar: 'طريقة الدفع' },
    PAY_CASH: { fr: 'Espèces', en: 'Cash', ar: 'نقداً' },
    PAY_CASH_DESC: {
      fr: 'Payer directement au chauffeur',
      en: 'Pay the driver directly',
      ar: 'ادفع للسائق مباشرة',
    },
    PAY_KONNECT: { fr: 'Konnect', en: 'Konnect', ar: 'Konnect' },
    PAY_KONNECT_DESC: {
      fr: 'Paiement en ligne sécurisé',
      en: 'Secure online payment',
      ar: 'دفع آمن عبر الإنترنت',
    },
    PAY_STRIPE: { fr: 'Stripe', en: 'Stripe', ar: 'Stripe' },
    PAY_STRIPE_DESC: {
      fr: 'Stripe Checkout (page hébergée)',
      en: 'Stripe Checkout (hosted page)',
      ar: 'Stripe Checkout (صفحة مستضافة)',
    },
    PAY_PAYPAL: { fr: 'PayPal', en: 'PayPal', ar: 'PayPal' },
    PAY_PAYPAL_DESC: {
      fr: 'Payer via PayPal (USD)',
      en: 'Pay via PayPal (USD)',
      ar: 'الدفع عبر PayPal (دولار)',
    },
    PAYPAL_NOTE: {
      fr: 'Estimation PayPal : <strong>{{usd}} USD</strong> pour <strong>{{tnd}} TND</strong> (≈ <strong>{{rate}}</strong> USD pour 1 TND).',
      en: 'Estimated PayPal charge: <strong>{{usd}} USD</strong> from <strong>{{tnd}} TND</strong> (≈ <strong>{{rate}}</strong> USD per 1 TND).',
      ar: 'تقدير PayPal: <strong>{{usd}} USD</strong> من <strong>{{tnd}} TND</strong> (≈ <strong>{{rate}}</strong> USD لكل 1 TND).',
    },
    BTN_UPDATE: { fr: 'Mettre à jour · {{money}}', en: 'Update booking · {{money}}', ar: 'تحديث الحجز · {{money}}' },
    BTN_PAY: { fr: 'Payer et confirmer · {{money}}', en: 'Pay & confirm · {{money}}', ar: 'ادفع وأكّد · {{money}}' },
    BTN_CONFIRM: { fr: 'Confirmer · {{money}}', en: 'Confirm · {{money}}', ar: 'تأكيد · {{money}}' },
    CONF_TITLE: { fr: 'Réservation confirmée', en: 'Booking confirmed', ar: 'تم تأكيد الحجز' },
    CONF_THANKS: {
      fr: 'Merci <strong>{{name}}</strong>, votre billet est confirmé.',
      en: 'Thank you <strong>{{name}}</strong>, your ticket is confirmed.',
      ar: 'شكراً <strong>{{name}}</strong>، تم تأكيد تذكرتك.',
    },
    REF_LABEL: { fr: 'Référence', en: 'Reference', ar: 'المرجع' },
    AMOUNT: { fr: 'Montant', en: 'Amount', ar: 'المبلغ' },
    STATUS: { fr: 'Statut', en: 'Status', ar: 'الحالة' },
    PAYMENT: { fr: 'Paiement', en: 'Payment', ar: 'الدفع' },
    QR_HINT: {
      fr: 'Présentez ce QR code à l’embarquement',
      en: 'Show this QR code at boarding',
      ar: 'اعرض رمز QR عند الصعود',
    },
    QR_ALT: { fr: 'QR code embarquement', en: 'Boarding QR code', ar: 'رمز QR للصعود' },
    QR_WAIT: { fr: 'Préparation du QR…', en: 'Preparing QR…', ar: 'جاري تجهيز QR…' },
    BTN_HOME: { fr: 'Accueil', en: 'Home', ar: 'الرئيسية' },
    SEAT_META: {
      fr: '{{n}} place(s)',
      en: '{{n}} seat(s)',
      ar: '{{n}} مقعد/مقاعد',
    },
    TRIP_META_SEP: { fr: ' · ', en: ' · ', ar: ' · ' },
    ALERT_TRIP_NOT_FOUND: { fr: 'Trajet introuvable', en: 'Trip not found', ar: 'الرحلة غير موجودة' },
    ALERT_TRIP_NOT_FOUND_BODY: {
      fr: 'Impossible de charger ce trajet. Retour à la recherche.',
      en: 'We could not load this trip. Returning to search.',
      ar: 'تعذر تحميل هذه الرحلة. العودة للبحث.',
    },
    ALERT_PAID_LOAD: { fr: 'Réservation', en: 'Booking', ar: 'الحجز' },
    ALERT_PAID_LOAD_BODY: {
      fr: 'Impossible de charger la réservation payée.',
      en: 'Could not load paid reservation.',
      ar: 'تعذر تحميل الحجز المدفوع.',
    },
    ALERT_DIFF_TRIP: { fr: 'Autre trajet', en: 'Different trip', ar: 'رحلة مختلفة' },
    ALERT_DIFF_TRIP_BODY: {
      fr: 'Cette réservation concerne un autre trajet. Ouverture de vos réservations.',
      en: 'This booking belongs to another trip. Opening your bookings.',
      ar: 'هذا الحجز لرحلة أخرى. جاري فتح حجوزاتك.',
    },
    ALERT_BOOKING_NOT_FOUND: { fr: 'Réservation introuvable', en: 'Booking not found', ar: 'الحجز غير موجود' },
    ALERT_BOOKING_NOT_FOUND_BODY: {
      fr: 'Impossible de charger cette réservation. Réessayez depuis Mes réservations.',
      en: 'We could not load this reservation. Try again from My bookings.',
      ar: 'تعذر تحميل هذا الحجز. أعد المحاولة من حجوزاتي.',
    },
    ALERT_CHECK_PASS: { fr: 'Coordonnées passager', en: 'Check passenger details', ar: 'تحقق من بيانات المسافر' },
    ALERT_CHECK_PASS_BODY: {
      fr: 'Corrigez les champs surlignés avant de continuer.',
      en: 'Please correct the highlighted fields before continuing.',
      ar: 'صحح الحقول المظللة قبل المتابعة.',
    },
    ALERT_CHECKOUT: { fr: 'Paiement', en: 'Checkout', ar: 'الدفع' },
    ALERT_CHECKOUT_INVALID: {
      fr: 'Réponse de paiement invalide du serveur.',
      en: 'Invalid payment response from server.',
      ar: 'استجابة دفع غير صالحة من الخادم.',
    },
    LOGIN_TITLE: {
      fr: 'Connectez-vous pour réserver le transport',
      en: 'Sign in to reserve transport',
      ar: 'سجّل الدخول لحجز النقل',
    },
    LOGIN_MSG: {
      fr: 'Connectez-vous ou créez un compte pour confirmer cette réservation.',
      en: 'Please sign in or create an account to confirm this transport booking.',
      ar: 'يرجى تسجيل الدخول أو إنشاء حساب لتأكيد هذا الحجز.',
    },
    ALERT_NOT_ENOUGH_SEATS: { fr: 'Pas assez de places', en: 'Not enough seats', ar: 'لا توجد مقاعد كافية' },
    ALERT_NOT_ENOUGH_SEATS_BODY: {
      fr: 'Ce trajet n’a que {{n}} place(s) disponible(s). Réduisez le nombre de places et réessayez.',
      en: 'This trip only has {{n}} seat(s) available. Reduce the number of seats and try again.',
      ar: 'هذه الرحلة توفر {{n}} مقعد/مقاعد فقط. قلّل العدد وحاول مرة أخرى.',
    },
    ALERT_ROUTE_TITLE: { fr: 'Itinéraire', en: 'Route', ar: 'المسار' },
    STRIPE_CHECKOUT_FAIL: {
      fr: 'Impossible de démarrer Stripe Checkout.',
      en: 'Could not start Stripe checkout.',
      ar: 'تعذر بدء Stripe Checkout.',
    },
    PAYPAL_CHECKOUT_FAIL: {
      fr: 'Impossible de démarrer PayPal Checkout.',
      en: 'Could not start PayPal checkout.',
      ar: 'تعذر بدء PayPal Checkout.',
    },
    ALERT_UPDATE_FAIL_BODY: {
      fr: 'Impossible de mettre à jour cette réservation. Réessayez.',
      en: 'We could not update this booking. Try again.',
      ar: 'تعذر تحديث هذا الحجز. حاول مرة أخرى.',
    },
    ALERT_UPDATE_FAIL: { fr: 'Échec de la mise à jour', en: 'Update failed', ar: 'فشل التحديث' },
    ALERT_DATE: { fr: 'Date', en: 'Date', ar: 'التاريخ' },
    ALERT_DATE_BODY: {
      fr: 'Sélectionnez une date de voyage depuis la recherche avant de payer.',
      en: 'Select a travel date from search before paying.',
      ar: 'اختر تاريخ السفر من البحث قبل الدفع.',
    },
    ALERT_TAXI_ROUTE: { fr: 'Itinéraire taxi', en: 'Taxi route', ar: 'مسار التاكسي' },
    ALERT_TAXI_ROUTE_BODY: {
      fr: 'Le tarif taxi nécessite un itinéraire. Relancez une recherche avec les villes pour estimer la distance.',
      en: 'Taxi pricing needs a driving route. Run a search with cities so the map can estimate distance.',
      ar: 'تسعير التاكسي يحتاج مساراً. نفّذ بحثاً بالمدن لتقدير المسافة.',
    },
    ALERT_STRIPE_FAIL: { fr: 'Paiement', en: 'Checkout', ar: 'الدفع' },
    ALERT_PAYPAL_FAIL: { fr: 'PayPal', en: 'PayPal', ar: 'PayPal' },
    ALERT_BOOKING_FAIL: { fr: 'Échec de la réservation', en: 'Booking failed', ar: 'فشل الحجز' },
    ALERT_BOOKING_FAIL_BODY: {
      fr: 'Impossible de finaliser la réservation. Réessayez.',
      en: 'We could not complete the reservation. Please try again.',
      ar: 'تعذر إتمام الحجز. حاول مرة أخرى.',
    },
  },
  TRANSPORT_RESULTS: {
    BACK_EDIT: { fr: 'Modifier la recherche', en: 'Edit search', ar: 'تعديل البحث' },
    BADGE_PASSENGERS: {
      fr: '{{n}} passager(s)',
      en: '{{n}} passenger(s)',
      ar: '{{n}} راكب/ركاب',
    },
    EMPTY_TITLE: { fr: 'Aucun trajet disponible', en: 'No trips available', ar: 'لا توجد رحلات' },
    EMPTY_PART1: {
      fr: 'Aucune option ',
      en: 'No ',
      ar: 'لا خيارات ',
    },
    EMPTY_PART2: {
      fr: ' pour cette route et cette date.',
      en: ' options for this route and date.',
      ar: ' لهذا المسار والتاريخ.',
    },
    EMPTY_HINT: {
      fr: 'Utilisez le bouton ci-dessus pour modifier vos critères.',
      en: 'Use the button above to change your search criteria.',
      ar: 'استخدم الزر أعلاه لتغيير معايير البحث.',
    },
    COUNT: {
      fr: '{{n}} trajet(s) disponible(s)',
      en: '{{n}} trip(s) available',
      ar: '{{n}} رحلة/رحلات متاحة',
    },
    SEATS_LEFT: {
      fr: 'Plus que {{n}} place(s)',
      en: 'Only {{n}} seat(s) left',
      ar: 'تبقى {{n}} مقعد/مقاعد فقط',
    },
    SEATS: { fr: '{{n}} places', en: '{{n}} seats', ar: '{{n}} مقعد/مقاعد' },
    BTN_BOOK: { fr: 'Réserver', en: 'Book', ar: 'احجز' },
    ALERT_LOAD_TITLE: {
      fr: 'Impossible de charger les résultats',
      en: 'Could not load results',
      ar: 'تعذر تحميل النتائج',
    },
    ALERT_LOAD_BODY: {
      fr: 'Impossible de récupérer les trajets. Vérifiez votre connexion et réessayez.',
      en: 'We could not fetch trips. Check your connection and try again.',
      ar: 'تعذر جلب الرحلات. تحقق من الاتصال وحاول مرة أخرى.',
    },
  },
  RESERVATION: {
    STATUS: {
      CONFIRMED: { fr: 'Confirmée', en: 'Confirmed', ar: 'مؤكد' },
      PENDING: { fr: 'En attente', en: 'Pending', ar: 'قيد الانتظار' },
      CANCELLED: { fr: 'Annulée', en: 'Cancelled', ar: 'ملغاة' },
    },
    PAYMENT: {
      CASH: { fr: 'Espèces', en: 'Cash', ar: 'نقداً' },
      KONNECT: { fr: 'Konnect', en: 'Konnect', ar: 'Konnect' },
      STRIPE: { fr: 'Stripe', en: 'Stripe', ar: 'Stripe' },
      PAYPAL: { fr: 'PayPal', en: 'PayPal', ar: 'PayPal' },
    },
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

console.log('Merged transport i18n into fr/en/ar.json');
