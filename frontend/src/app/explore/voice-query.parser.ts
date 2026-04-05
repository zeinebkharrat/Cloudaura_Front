import { City } from './explore.models';

export interface RestaurantVoiceFilters {
  cleanedTranscript: string;
  searchQuery: string;
  cityId: number | null;
  cuisineType: string | null;
  locationKeyword: string | null;
  detected: {
    city: boolean;
    cuisine: boolean;
    location: boolean;
  };
}

export interface ActivityVoiceFilters {
  cleanedTranscript: string;
  searchQuery: string;
  cityId: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  date: string | null;
  participants: number | null;
  locationKeyword: string | null;
  detected: {
    city: boolean;
    budget: boolean;
    date: boolean;
    participants: boolean;
    location: boolean;
  };
}

const CUISINE_KEYWORDS: Array<{ keyword: string; canonical: string }> = [
  { keyword: 'tunisian', canonical: 'Tunisian' },
  { keyword: 'tunisie', canonical: 'Tunisian' },
  { keyword: 'tunisi', canonical: 'Tunisian' },
  { keyword: 'italian', canonical: 'Italian' },
  { keyword: 'italien', canonical: 'Italian' },
  { keyword: 'french', canonical: 'French' },
  { keyword: 'francais', canonical: 'French' },
  { keyword: 'arabic', canonical: 'Arabic' },
  { keyword: 'arabe', canonical: 'Arabic' },
  { keyword: 'turkish', canonical: 'Turkish' },
  { keyword: 'turc', canonical: 'Turkish' },
  { keyword: 'asian', canonical: 'Asian' },
  { keyword: 'chinese', canonical: 'Chinese' },
  { keyword: 'mexican', canonical: 'Mexican' },
  { keyword: 'indian', canonical: 'Indian' },
  { keyword: 'japanese', canonical: 'Japanese' },
  { keyword: 'mediterranean', canonical: 'Mediterranean' },
  { keyword: 'mediterraneenne', canonical: 'Mediterranean' },
  { keyword: 'seafood', canonical: 'Seafood' },
  { keyword: 'poisson', canonical: 'Seafood' },
  { keyword: 'grill', canonical: 'Grill' },
  { keyword: 'pizza', canonical: 'Pizza' },
];

export function parseRestaurantVoiceQuery(rawTranscript: string, cities: City[]): RestaurantVoiceFilters {
  const transcript = sanitizeTranscript(rawTranscript);
  const normalized = normalizeText(transcript);
  const cityId = findCityId(normalized, cities);
  const cuisineType = findCuisineType(normalized);
  const locationKeyword = findLocationKeyword(normalized, ['restaurant', 'resto', 'cuisine']);
  const searchQuery = extractSearchQuery(normalized, cities, 'restaurant');

  return {
    cleanedTranscript: transcript,
    searchQuery,
    cityId,
    cuisineType,
    locationKeyword,
    detected: {
      city: cityId != null,
      cuisine: !!cuisineType,
      location: !!locationKeyword,
    },
  };
}

export function parseActivityVoiceQuery(rawTranscript: string, cities: City[]): ActivityVoiceFilters {
  const transcript = sanitizeTranscript(rawTranscript);
  const normalized = normalizeText(transcript);
  const cityId = findCityId(normalized, cities);
  const priceRange = findPriceRange(normalized) ?? findExactPriceRange(normalized);
  const date = findDate(normalized);
  const participants = findParticipants(normalized);
  const locationKeyword = findLocationKeyword(normalized, ['activity', 'activite', 'experience', 'tour']);
  const searchQuery = extractSearchQuery(normalized, cities, 'activity');

  return {
    cleanedTranscript: transcript,
    searchQuery,
    cityId,
    minPrice: priceRange?.min ?? null,
    maxPrice: priceRange?.max ?? null,
    date,
    participants,
    locationKeyword,
    detected: {
      city: cityId != null,
      budget: !!priceRange,
      date: !!date,
      participants: participants != null,
      location: !!locationKeyword,
    },
  };
}

function sanitizeTranscript(value: string): string {
  const raw = (value || '')
    .replace(/laser\s+gamle/gi, 'laser game')
    .replace(/lazer\s+game/gi, 'laser game')
    .replace(/laser\s+gamel/gi, 'laser game');

  return raw
    .replace(/[\u061f\u060c]+/g, ' ')
    .replace(/[\.!?,;:]+$/g, '')
    .replace(/[\u2026]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value: string): string {
  const arabicDigitMap: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  };

  const withLatinDigits = value
    .split('')
    .map((char) => arabicDigitMap[char] ?? char)
    .join('');

  return withLatinDigits
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\.!?,;:\u061f\u060c]/g, ' ')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findCityId(normalizedTranscript: string, cities: City[]): number | null {
  for (const city of cities) {
    const normalizedCityName = normalizeText(city.name || '');
    if (!normalizedCityName) {
      continue;
    }
    if (
      normalizedTranscript === normalizedCityName ||
      normalizedTranscript.includes(` ${normalizedCityName} `) ||
      normalizedTranscript.startsWith(`${normalizedCityName} `) ||
      normalizedTranscript.endsWith(` ${normalizedCityName}`)
    ) {
      return city.cityId;
    }
  }
  return null;
}

function findCuisineType(normalizedTranscript: string): string | null {
  for (const entry of CUISINE_KEYWORDS) {
    if (normalizedTranscript.includes(entry.keyword)) {
      return entry.canonical;
    }
  }
  return null;
}

function findPriceRange(normalizedTranscript: string): { min: number; max: number } | null {
  const rangeRegex =
    /(between|entre|from|de|budget|بين|entre\s+|between\s+|tra|zwischen|entre|entre\s+|بين)\s+(.+?)\s+(?:and|et|to|a|الى|-|\u0625\u0644\u0649|y|und|e)\s+(.+?)(?=\s*(?:dt|dinar|dinars|tnd)\b|$)/i;
  const minMaxPairRegex =
    /(?:min|minimum|au minimum|au moins|at least|lower bound|حد ادنى|الحد الادنى)\s+(.+?)\s+(?:max|maximum|au maximum|au plus|at most|upper bound|حد اقصى|الحد الاقصى)\s+(.+?)(?=\s*(?:dt|dinar|dinars|tnd)\b|$)/i;
  const lessThanRegex =
    /(?:under|less than|below|up to|at most|no more than|inferieur a|moins de|moins que|max|maximum|au maximum|au plus|jusqu a|اقل من|ادنى من|على الاكثر|حد اقصى|الحد الاقصى)\s+([a-z0-9\u0600-\u06ff\-\s.,]+)/i;
  const greaterThanRegex =
    /(?:over|more than|above|at least|no less than|greater than|superieur a|plus de|plus que|min|minimum|au minimum|au moins|a partir de|اكثر من|اعلى من|على الاقل|حد ادنى|الحد الادنى)\s+([a-z0-9\u0600-\u06ff\-\s.,]+)/i;
  const symbolLessRegex = /(?:<=|=<|<|≤)\s*(\d+(?:[.,]\d+)?)/;
  const symbolGreaterRegex = /(?:>=|=>|>|≥)\s*(\d+(?:[.,]\d+)?)/;

  const minMaxPairMatch = normalizedTranscript.match(minMaxPairRegex);
  if (minMaxPairMatch) {
    const left = parseAmount(cleanAmountFragment(minMaxPairMatch[1]));
    const right = parseAmount(cleanAmountFragment(minMaxPairMatch[2]));
    if (left != null && right != null) {
      return { min: Math.min(left, right), max: Math.max(left, right) };
    }
  }

  const rangeMatch = normalizedTranscript.match(rangeRegex);
  if (rangeMatch) {
    const left = parseAmount(cleanAmountFragment(rangeMatch[2]));
    const right = parseAmount(cleanAmountFragment(rangeMatch[3]));
    if (left != null && right != null) {
      return { min: Math.min(left, right), max: Math.max(left, right) };
    }
  }

  const lessThanMatch = normalizedTranscript.match(lessThanRegex);
  if (lessThanMatch) {
    const max = parseAmount(lessThanMatch[2]);
    if (max != null) {
      return { min: 0, max };
    }
  }

  const greaterThanMatch = normalizedTranscript.match(greaterThanRegex);
  if (greaterThanMatch) {
    const min = parseAmount(greaterThanMatch[2]);
    if (min != null) {
      return { min, max: 1000 };
    }
  }

  const symbolLessMatch = normalizedTranscript.match(symbolLessRegex);
  if (symbolLessMatch) {
    const max = parseAmount(symbolLessMatch[1]);
    if (max != null) {
      return { min: 0, max };
    }
  }

  const symbolGreaterMatch = normalizedTranscript.match(symbolGreaterRegex);
  if (symbolGreaterMatch) {
    const min = parseAmount(symbolGreaterMatch[1]);
    if (min != null) {
      return { min, max: 1000 };
    }
  }

  return null;
}

function findExactPriceRange(normalizedTranscript: string): { min: number; max: number } | null {
  const exactRegex =
    /(a|a|at|pour|for|de|around|vers|environ|تقريبا|بحوالي)\s+([a-z0-9\u0600-\u06ff\-\s.,]+?)\s*(?:dt|dinar|dinars|tnd)(?:$|\b)/i;

  const match = normalizedTranscript.match(exactRegex);
  if (!match) {
    return null;
  }

  const value = parseAmount(cleanAmountFragment(match[2]));
  if (value == null) {
    return null;
  }

  return { min: value, max: value };
}

function findParticipants(normalizedTranscript: string): number | null {
  const participantsRegex = /(for|pour|participants?|people|personnes?|اشخاص|أشخاص)\s*(\d+)/i;
  const reverseRegex = /(\d+)\s*(participants?|people|personnes?|اشخاص|أشخاص)/i;

  const match = normalizedTranscript.match(participantsRegex) ?? normalizedTranscript.match(reverseRegex);
  if (!match) {
    return null;
  }

  const value = parseInt(match[2] ?? match[1], 10);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function findLocationKeyword(normalizedTranscript: string, stopTokens: string[]): string | null {
  const locationRegex =
    /(near|close to|around|in|a|au|aux|pres de|vers|fi|في|قرب)\s+([a-z0-9\u0600-\u06ff\-\s]{2,})/i;

  const match = normalizedTranscript.match(locationRegex);
  if (!match) {
    return null;
  }

  const rawLocation = (match[2] || '').trim();
  if (!rawLocation) {
    return null;
  }

  const cleaned = rawLocation
    .split(' ')
    .filter((token) => token && !stopTokens.includes(token))
    .join(' ')
    .trim();

  if (cleaned.length < 2) {
    return null;
  }

  return cleaned;
}

function findDate(normalizedTranscript: string): string | null {
  const today = new Date();

  if (containsAny(normalizedTranscript, ['today', 'aujourd hui', 'aujourdhui', 'اليوم'])) {
    return toIsoDate(today);
  }

  if (containsAny(normalizedTranscript, ['tomorrow', 'demain', 'غدا', 'غدا'])) {
    const next = new Date(today);
    next.setDate(today.getDate() + 1);
    return toIsoDate(next);
  }

  const isoRegex = /(\d{4})-(\d{2})-(\d{2})/;
  const isoMatch = normalizedTranscript.match(isoRegex);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const slashRegex = /(\d{2})\/(\d{2})\/(\d{4})/;
  const slashMatch = normalizedTranscript.match(slashRegex);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`;
  }

  return null;
}

function parseDecimal(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseFloat(value.replace(',', '.'));
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, parsed);
}

function parseAmount(value: string | null | undefined): number | null {
  const direct = parseDecimal(value);
  if (direct != null) {
    return direct;
  }

  const spoken = parseSpokenNumber(value || '');
  if (spoken != null) {
    return spoken;
  }

  return null;
}

function cleanAmountFragment(value: string): string {
  return value
    .replace(/\b(a|au|aux|a\s+la|in|dans|fi|في|a\s+tunis|a\s+sfax|a\s+sousse)\b.*$/i, '')
    .replace(/\b(dt|dinar|dinars|tnd)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSpokenNumber(value: string): number | null {
  const normalized = normalizeText(value).replace(/-/g, ' ');
  if (!normalized) {
    return null;
  }

  const englishSimple: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
    ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
    seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
    thirty: 30, forty: 40, fifty: 50, sixty: 60,
  };

  if (englishSimple[normalized] != null) {
    return englishSimple[normalized];
  }

  const englishTokens = normalized.split(' ').filter((token) => !!token);
  const englishTens: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60 };
  const englishUnits: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9,
  };
  if (englishTens[englishTokens[0]] != null) {
    let result = englishTens[englishTokens[0]];
    if (englishUnits[englishTokens[1]] != null) {
      result += englishUnits[englishTokens[1]];
    }
    return result;
  }

  const tokens = normalized.split(' ').filter((token) => !!token && token !== 'dinars' && token !== 'dinar' && token !== 'dt' && token !== 'tnd');
  if (!tokens.length) {
    return null;
  }

  const units: Record<string, number> = {
    zero: 0,
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
    sept: 7,
    huit: 8,
    neuf: 9,
  };

  const teens: Record<string, number> = {
    dix: 10,
    onze: 11,
    douze: 12,
    treize: 13,
    quatorze: 14,
    quinze: 15,
    seize: 16,
    'dix sept': 17,
    'dix huit': 18,
    'dix neuf': 19,
  };

  const tens: Record<string, number> = {
    vingt: 20,
    trente: 30,
    quarante: 40,
    cinquante: 50,
    soixante: 60,
  };

  const joined = tokens.join(' ');
  if (teens[joined] != null) {
    return teens[joined];
  }

  if (teens[tokens[0]] != null && tokens.length === 1) {
    return teens[tokens[0]];
  }

  if (tens[tokens[0]] != null) {
    let result = tens[tokens[0]];
    if (tokens[1] === 'et' && units[tokens[2]] != null) {
      result += units[tokens[2]];
      return result;
    }
    if (units[tokens[1]] != null) {
      result += units[tokens[1]];
      return result;
    }
    return result;
  }

  if (units[tokens[0]] != null && tokens.length === 1) {
    return units[tokens[0]];
  }

  return null;
}

function extractSearchQuery(normalizedTranscript: string, cities: City[], scope: 'restaurant' | 'activity'): string {
  const stopWords = new Set([
    'je', 'veux', 'want', 'i', 'need', 'a', 'an', 'the', 'de', 'des', 'du', 'dans', 'in', 'for', 'pour',
    'activity', 'activite', 'activities', 'restaurant', 'restaurants', 'resto', 'budget', 'between', 'entre',
    'from', 'to', 'et', 'and', 'dt', 'dinar', 'dinars', 'tnd', 'today', 'tomorrow', 'demain', 'aujourd', 'hui',
    'avec', 'with', 'participants', 'people', 'personnes', 'near', 'close', 'to', 'around', 'pres', 'vers',
    'tout', 'toute', 'toutes', 'tous', 'les', 'all', 'any', 'some', 'show', 'moi', 'me',
    'prix', 'price', 'le', 'la', 'au', 'aux', 'minimum', 'maximum', 'min', 'max',
    'inferieur', 'superieur', 'moins', 'plus', 'lower', 'upper', 'least', 'most',
    'at', 'than', 'que', 'auplus', 'aumoins', 'jusqu', 'partir',
  ]);

  const currencyWords = new Set(['dt', 'tnd', 'dinar', 'dinars']);
  const numberWords = new Set([
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
    'twenty', 'thirty', 'forty', 'fifty', 'sixty',
    'un', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
    'vingt', 'trente', 'quarante', 'cinquante', 'soixante',
    'et',
  ]);

  const cityTokenSet = new Set<string>();
  for (const city of cities) {
    const tokens = normalizeText(city.name || '').split(' ').filter((token) => !!token);
    for (const token of tokens) {
      cityTokenSet.add(token);
    }
  }

  const tokens = normalizedTranscript
    .replace(/[^a-z0-9\u0600-\u06ff\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => !!token)
    .map((token) => {
      if (token === 'gamle' || token === 'gamel' || token === 'gamee') {
        return 'game';
      }
      if (token === 'lazer') {
        return 'laser';
      }
      return token;
    })
    .filter((token) => !stopWords.has(token))
    .filter((token) => !currencyWords.has(token))
    .filter((token) => !numberWords.has(token))
    .filter((token) => !cityTokenSet.has(token))
    .filter((token) => !/^\d+$/.test(token));

  const result = tokens.join(' ').trim();
  if (!result) {
    return '';
  }

  const stripped = scope === 'activity'
    ? result.replace(/\bactivites?\b/g, '').trim()
    : result.replace(/\brestaurants?\b/g, '').trim();

  // Guard rail: if only generic control words remain, don't send a restrictive text query.
  const genericLeftovers = new Set(['tout', 'toute', 'toutes', 'tous', 'all', 'any', 'show']);
  const meaningful = stripped
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => !!token && !genericLeftovers.has(token));

  return meaningful.join(' ').trim();
}

function containsAny(input: string, tokens: string[]): boolean {
  return tokens.some((token) => input.includes(token));
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
