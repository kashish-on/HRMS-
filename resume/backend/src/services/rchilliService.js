import fetch from "node-fetch";
import mammoth from "mammoth";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
 
// pdf-parse has inconsistent exports depending on version — handle all cases
const _pdfParseRaw = require("pdf-parse");
const pdfParse = typeof _pdfParseRaw === "function"
  ? _pdfParseRaw
  : typeof _pdfParseRaw?.default === "function"
  ? _pdfParseRaw.default
  : typeof _pdfParseRaw?.parse === "function"
  ? _pdfParseRaw.parse
  : null;
 
if (!pdfParse) throw new Error("pdf-parse could not be loaded. Run: npm install pdf-parse");
 
// ─── Basic Helpers ────────────────────────────────────────────────────────────
 
const sanitizeText = (value) => {
  if (typeof value !== "string") return null;
  return (
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim() || null
  );
};
 
const toSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
 
const unique = (values) => Array.from(new Set((values || []).filter(Boolean)));
const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const getFirstValue = (v) => (Array.isArray(v) ? v[0] || null : v || null);
const splitSkillText = (value) =>
  String(value || "")
    .split(/[,|\n]/)
    .map((e) => sanitizeText(e))
    .filter(Boolean);
 
const cleanLine = (value) =>
  String(value || "")
    .replace(/[|]+/g, " ")
    .replace(/[\u2022\u25cf\u25aa\u25a0\u2023\u2043]+/g, " ")
    .replace(/\t+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
 
const buildLocation = (loc = {}) => {
  // Use pre-built formatted string if available (set by our own parser)
  if (loc?.formatted) return loc.formatted;
  const city = sanitizeText(loc?.City);
  const state = sanitizeText(loc?.State);
  const country = sanitizeText(loc?.Country);
  // Deduplicate: don't add state/country if same as city, and don't repeat "India, India"
  const parts = [];
  if (city) parts.push(city);
  if (state && state.toLowerCase() !== city?.toLowerCase()) parts.push(state);
  if (country && country.toLowerCase() !== state?.toLowerCase() && country.toLowerCase() !== city?.toLowerCase()) parts.push(country);
  return parts.length ? parts.join(", ") : null;
};
 
const getLines = (text) =>
  String(text || "")
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);
 
const normalizeHeader = (value) =>
  cleanLine(value)
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
 
// ─── Section Detection ────────────────────────────────────────────────────────
 
const SECTION_HEADER_MAP = {
  summary: ["summary", "professional summary", "profile summary", "career summary", "profile", "about me", "objective", "career objective", "about", "overview"],
  experience: ["experience", "work experience", "professional experience", "employment history", "employment", "work history", "career history", "internship", "internships"],
  education: ["education", "academic qualification", "academic qualifications", "qualification", "qualifications", "educational background", "academics"],
  skills: ["skills", "technical skills", "core competencies", "key skills", "competencies", "expertise", "areas of expertise", "skill set", "tools", "technologies"],
  projects: ["projects", "project experience", "key projects"],
  certifications: ["certifications", "certification", "licenses", "achievements", "awards"],
};
 
const STOP_HEADERS = new Set(Object.values(SECTION_HEADER_MAP).flat());
 
const getSectionKey = (line) => {
  const normalized = normalizeHeader(line);
  if (!normalized) return null;
  // All-caps lines that are very long are probably bullet content, not headers
  if (line === line.toUpperCase() && line.length > 40) return null;
 
  for (const [key, aliases] of Object.entries(SECTION_HEADER_MAP)) {
    for (const alias of aliases) {
      // Exact match
      if (normalized === alias) return key;
      // Header starts with the alias (handles "Experience (2018-2022)", "Skills & Tools")
      if (normalized.startsWith(alias + " ") || normalized.startsWith(alias + ":")) return key;
      // Header ends with the alias (handles "Technical Skills", "Key Skills")
      if (normalized.endsWith(" " + alias)) return key;
      // Alias is contained as whole words within a short header (≤5 words)
      const words = normalized.split(/\s+/);
      if (words.length <= 5 && normalized.includes(alias)) return key;
    }
  }
  return null;
};
 
const buildSections = (text) => {
  const sections = { header: [] };
  let current = "header";
  for (const line of getLines(text)) {
    const key = getSectionKey(line);
    if (key) { current = key; sections[current] ||= []; continue; }
    sections[current] ||= [];
    sections[current].push(line);
  }
  return sections;
};
 
// ─── Date Parsing ─────────────────────────────────────────────────────────────
 
const MONTH_MAP = { jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11 };
 
const DATE_RANGE_REGEX =
  /\b((?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{4}|\d{1,2}[\/\-]\d{4}|\d{4})\s*(?:-|[\u2013\u2014]|to)\s*(present|current|till\s*date|now|(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{4}|\d{1,2}[\/\-]\d{4}|\d{4})\b/gi;
 
const parseDateToken = (value) => {
  if (!value) return null;
  const token = value.trim().toLowerCase();
  if (/(present|current|till\s*date|now)/i.test(token)) {
    const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() };
  }
  const m1 = token.match(/^(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{4})$/);
  if (m1) return { year: Number(m1[2]), month: MONTH_MAP[m1[1]] ?? 0 };
  const m2 = token.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (m2) return { year: Number(m2[2]), month: Math.max(0, Number(m2[1]) - 1) };
  const m3 = token.match(/^(\d{4})$/);
  if (m3) return { year: Number(m3[1]), month: 0 };
  return null;
};
 
const dateToMonths = (d) => d.year * 12 + d.month;
 
const mergeDateRanges = (ranges) => {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const merged = [{ ...sorted[0] }];
  for (const r of sorted.slice(1)) {
    const prev = merged[merged.length - 1];
    if (r.start <= prev.end + 1) prev.end = Math.max(prev.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
};
 
const extractDateRanges = (text) => {
  const ranges = [];
  let m;
  const re = new RegExp(DATE_RANGE_REGEX.source, "gi");
  while ((m = re.exec(text)) !== null) {
    const start = parseDateToken(m[1]);
    const end = parseDateToken(m[2]);
    if (!start || !end) continue;
    const s = dateToMonths(start), e = dateToMonths(end);
    if (e < s || end.year - start.year > 45) continue;
    ranges.push({ start: s, end: e });
  }
  return mergeDateRanges(ranges);
};
 
// ─── Location Data ────────────────────────────────────────────────────────────
 
const COUNTRY_NAMES = ["india","united states","usa","united kingdom","uk","uae","united arab emirates","canada","australia","singapore","germany","france","malaysia","indonesia"];
const STATE_NAMES = ["andhra pradesh","arunachal pradesh","assam","bihar","chhattisgarh","delhi","goa","gujarat","haryana","himachal pradesh","jharkhand","karnataka","kerala","madhya pradesh","maharashtra","odisha","punjab","rajasthan","tamil nadu","telangana","uttar pradesh","uttarakhand","west bengal"];
const CITY_NAMES = ["mumbai","new delhi","delhi","bangalore","bengaluru","hyderabad","chennai","kolkata","pune","ahmedabad","jaipur","noida","greater noida","gurugram","gurgaon","lucknow","chandigarh","indore","bhopal","nagpur","surat","vadodara","navi mumbai","thane","kochi","coimbatore","mysore","vizag","visakhapatnam","agra","meerut","faridabad","panchkula","mohali","dehradun","patna","raipur","bhubaneswar","ranchi"];
 
// ─── Job Titles ───────────────────────────────────────────────────────────────
 
const JOB_TITLES = [
  // Conference / Events
  "conference producer","senior conference producer","junior conference producer","conference manager","event producer","event manager","conference coordinator","event coordinator","conference director","content producer","programme producer","program producer","conference content manager",
  // Operations
  "operations executive","operations manager","operations coordinator","operations specialist","operations analyst","operations associate","senior operations executive","operations head","operations lead","chief operating officer","coo","process manager","process executive",
  // HR
  "hr manager","hr executive","hr generalist","hr specialist","hr coordinator","hr associate","hr business partner","hrbp","talent acquisition","talent acquisition specialist","talent acquisition executive","talent acquisition manager","recruiter","senior recruiter","recruitment executive","recruitment manager","recruitment specialist","learning and development","l&d","training manager","training executive","payroll executive","payroll manager","hr head","chief human resources officer","chro","people manager","people operations",
  // Marketing
  "marketing manager","marketing executive","marketing specialist","marketing coordinator","digital marketing manager","digital marketing executive","content writer","content manager","content strategist","seo executive","seo manager","social media manager","social media executive","brand manager","growth manager","growth hacker","performance marketing","email marketing","marketing analyst","marketing head","chief marketing officer","cmo","product marketing manager",
  // Business Development
  "business development manager","business development executive","business development associate","bdm","bde","bd manager","bd executive","key account manager","account manager","account executive","partnership manager","alliance manager","corporate sales manager","enterprise sales manager",
  // Sales
  "sales manager","sales executive","sales associate","sales representative","sales officer","sales head","vp sales","sales director","inside sales","field sales","pre-sales","presales","sales analyst","channel sales","retail sales","b2b sales","lead generation executive","lead generation manager",
  // Tech
  "software engineer","senior software engineer","junior software engineer","lead software engineer","full stack developer","frontend developer","backend developer","web developer","mobile developer","react developer","node.js developer","python developer","java developer","data scientist","data analyst","data engineer","machine learning engineer","ai engineer","devops engineer","cloud engineer","site reliability engineer","sre","product manager","project manager","scrum master","qa engineer","quality assurance","test engineer","automation engineer","database administrator","tech lead","team lead","cto","vp engineering","engineering manager",
  // General
  "intern","trainee","fresher","associate","consultant","senior consultant","manager","senior manager","director","vice president","vp","assistant manager","deputy manager","executive","coordinator","specialist","analyst","officer",
];
 
// ─── Skills Database ──────────────────────────────────────────────────────────
 
const SKILLS_DB = [
  // Tech
  "javascript","typescript","python","java","c++","c#","ruby","php","swift","kotlin","go","rust","scala","r","matlab",
  "react","react.js","angular","vue","vue.js","html","css","html5","css3","sass","bootstrap","tailwind","next.js","redux","jquery","webpack",
  "node.js","express","django","flask","spring boot","laravel","fastapi","nestjs","graphql","rest api",
  "sql","mysql","postgresql","mongodb","redis","firebase","supabase","dynamodb","elasticsearch",
  "aws","azure","gcp","docker","kubernetes","jenkins","ci/cd","terraform","linux","git","github","gitlab","jira","figma","postman",
  "machine learning","deep learning","tensorflow","pytorch","pandas","numpy","data analysis","power bi","tableau","excel","ai","data science",
  // HR Skills
  "talent acquisition","recruitment","sourcing","headhunting","onboarding","offboarding","payroll","hris","hrms","performance management","employee relations","hr operations","hr generalist","training and development","learning and development","compensation and benefits","workforce planning","employer branding","hr analytics","exit interviews","bgv","background verification",
  // Marketing Skills
  "digital marketing","seo","sem","google ads","facebook ads","meta ads","linkedin ads","content marketing","email marketing","social media marketing","brand management","market research","google analytics","hubspot","salesforce","crm","performance marketing","affiliate marketing","influencer marketing","ppc","lead generation","b2b marketing","b2c marketing","marketing automation","mailchimp","zoho","campaign management","product launch",
  // Sales Skills
  "b2b sales","b2c sales","inside sales","field sales","cold calling","lead generation","client acquisition","account management","key account management","revenue generation","sales forecasting","sales strategy","pipeline management","crm management","negotiation","business development","channel sales","enterprise sales","retail sales","target achievement","presales","upselling","cross selling",
  // Conference / Events Skills
  "conference production","event management","event planning","agenda development","speaker management","programme development","content curation","delegate management","sponsorship","webinar management","virtual events","hybrid events","exhibition management","venue management","event marketing","conference marketing","abstract management",
  // Operations Skills
  "operations management","process improvement","process optimization","supply chain","logistics","vendor management","procurement","quality management","lean","six sigma","project management","stakeholder management","reporting","mis","data entry","team management","sop","compliance","budget management","cost reduction","escalation management","client servicing",
  // Soft Skills
  "leadership","communication","teamwork","problem solving","time management","analytical","critical thinking","presentation","negotiation","decision making","multitasking","attention to detail","adaptability","creativity","interpersonal skills",
  // Tools
  "microsoft office","ms office","word","powerpoint","google workspace","slack","zoom","teams","trello","asana","notion","monday.com","freshdesk","zendesk","whatsapp business","canva","adobe","photoshop",
];
 
// ─── Company Detection ────────────────────────────────────────────────────────
 
const COMPANY_SUFFIX_REGEX =
  /\b(pvt\.?\s*ltd\.?|private\s+limited|limited|ltd\.?|inc\.?|corp\.?|corporation|llc|llp|technologies|technology|tech|solutions|systems|services|consulting|consultants|group|infotech|software|labs|international|enterprises|ventures|associates|partners|agency|media|networks|global|india|worldwide)\b/i;
 
const JOB_TITLE_HINT_REGEX =
  /\b(engineer|developer|manager|executive|specialist|analyst|consultant|associate|lead|architect|administrator|coordinator|recruiter|designer|producer|director|officer|supervisor|head|intern|trainee|assistant|deputy|senior|junior|vp|president)\b/i;
 
const isContactLine = (line) =>
  /@|linkedin|github|portfolio|www\.|https?:|phone|mobile|contact|\+91|\+1/i.test(line);
 
const looksLikeCompany = (line) => {
  if (!line || line.length > 120 || line.length < 3) return false;
  if (isContactLine(line)) return false;
  // Has a company suffix keyword
  return COMPANY_SUFFIX_REGEX.test(line);
};
 
const looksLikeGenericCompany = (line) => {
  if (!line || line.length > 80 || isContactLine(line) || looksLikeJobTitle(line)) return false;
  const words = line.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 7) return false;
  // All words start with uppercase (proper noun pattern)
  return words.filter((w) => w.length > 1).every((w) => /^[A-Z]/.test(w));
};
 
const looksLikeJobTitle = (line) => {
  if (!line || line.length > 100) return false;
  if (isContactLine(line)) return false;
  return JOB_TITLE_HINT_REGEX.test(line) || JOB_TITLES.some((t) => line.toLowerCase().includes(t));
};
 
// ─── Experience Extraction ────────────────────────────────────────────────────
 
const extractExperienceYears = (fullText, sections) => {
  // 1. Explicit statement — most reliable
  const patterns = [
    /(\d+(?:\.\d+)?)\s*\+?\s*years?\s+(?:of\s+)?(?:total\s+)?(?:work\s+)?(?:professional\s+)?experience/i,
    /(?:total\s+)?(?:work\s+)?experience\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*\+?\s*years?/i,
    /(\d+(?:\.\d+)?)\s*\+?\s*years?\s+(?:in|of|with)\s+/i,
    /(\d+(?:\.\d+)?)\s*\+?\s*yrs?\s*(?:of\s+)?(?:exp|experience)/i,
    /experience\s*[:\-]\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i,
    /(\d+(?:\.\d+)?)\s*years?\s+(?:and\s+\d+\s*months?\s+)?(?:of\s+)?(?:overall|total|combined)/i,
    /overall\s+(?:work\s+)?experience\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
  ];
 
  for (const pattern of patterns) {
    const match = fullText.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      if (val > 0 && val < 60) return val;
    }
  }
 
  // 2. Calculate from date ranges in experience section
  const expText = (sections.experience || []).join("\n");
  if (expText.trim()) {
    const ranges = extractDateRanges(expText);
    if (ranges.length) {
      const totalMonths = ranges.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
      const years = parseFloat((totalMonths / 12).toFixed(1));
      if (years > 0 && years < 60) return years;
    }
  }
 
  // 3. Fallback: date ranges from full text (excluding education section which has graduation years)
  const textWithoutEdu = fullText.replace(
    /(?:education|qualification|academic)[^\n]*\n[\s\S]{0,800}?(?=\n(?:experience|skills|projects|certifications|\n)|$)/gi,
    ""
  );
  const fullRanges = extractDateRanges(textWithoutEdu || fullText);
  if (fullRanges.length) {
    const totalMonths = fullRanges.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
    const years = parseFloat((totalMonths / 12).toFixed(1));
    if (years > 0 && years < 60) return years;
  }
 
  return null;
};
 
// ─── Skills Extraction ────────────────────────────────────────────────────────
 
const MIN_SKILL_WORD_COUNT = 1;
const MAX_SKILL_WORD_COUNT = 5;
 
// Words that are NOT skills even if they appear in text
const SKILL_BLACKLIST = new Set([
  "and","the","of","to","in","for","with","on","at","by","from","as","is","are","was","were","be","been","being",
  "have","has","had","do","does","did","will","would","could","should","may","might","shall","must","can",
  "that","this","these","those","a","an","it","its","we","our","you","your","they","their","he","she","i","my",
  "not","no","yes","so","but","if","or","nor","yet","both","either","neither","each","every","all","any","few","more","most",
  "other","some","such","than","then","there","when","where","which","who","whom","how","what","why",
  "new","good","great","well","also","just","only","very","much","many","more","less","same","different","various",
  "including","related","relevant","using","used","skills","skill","experience","knowledge","ability","work",
  "resume","cv","candidate","position","role","job","company","team","year","month","day","time","date",
]);
 
const isValidSkillEntry = (entry) => {
  if (!entry || typeof entry !== "string") return false;
  const cleaned = entry.trim();
  if (cleaned.length < 2 || cleaned.length > 60) return false;
  const words = cleaned.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length < MIN_SKILL_WORD_COUNT || words.length > MAX_SKILL_WORD_COUNT) return false;
  // Reject if it's just blacklisted words
  if (words.every((w) => SKILL_BLACKLIST.has(w))) return false;
  // Reject lines that look like sentences (has verb indicators)
  if (/\b(responsible|worked|developed|managed|achieved|led|handled|performed|assisted|supported|ensured|helped|provided|created|designed|implemented|maintained|improved|built|delivered)\b/i.test(cleaned)) return false;
  // Reject if contains numbers that suggest it's a bullet point or date
  if (/^\d+[\.\)]/.test(cleaned)) return false;
  return true;
};
 
const extractSkillsFromSections = (sections) => {
  const entries = [];
  for (const line of sections.skills || []) {
    // Strip leading bullet characters or numbers before splitting
    const stripped = line.replace(/^[\u2022\u25cf\u25aa\u25a0\u2023\u2043\-\*\+\>]\s*/, "").trim();
    // Split on common delimiters: comma, slash, semicolon, pipe, 2+ spaces, bullet chars
    const parts = stripped.split(/[,\/;|]|\s{2,}|[\u2022\u25cf\u25aa\u25a0]/).map(cleanLine);
    for (const part of parts) {
      // Some resumes list one skill per line with no delimiter
      const subParts = part.split(/\s*[-–]\s*(?=[A-Z])/).map(cleanLine); // "React - Redux" → two entries
      for (const sub of subParts) {
        if (isValidSkillEntry(sub)) entries.push(sub);
      }
    }
  }
  return unique(entries.filter((e) => e.split(/\s+/).length <= MAX_SKILL_WORD_COUNT));
};
 
const extractSkillsFromDB = (text) => {
  const lowerText = text.toLowerCase();
  const found = [];
  for (const skill of SKILLS_DB) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
    if (regex.test(lowerText)) found.push(skill);
  }
  return unique(found);
};
 
// ─── Education ────────────────────────────────────────────────────────────────
 
const extractEducation = (text, sections) => {
  const degrees = [];
  // Prefer education section lines, then scan full text
  const eduLines = sections.education || [];
  const allLines = [...eduLines, ...getLines(text)];
 
  const degreePatterns = [
    /\b(Ph\.?D\.?|Doctor of Philosophy)\b/gi,
    /\b(M\.?Tech\.?|Master of Technology)\b/gi,
    /\b(M\.?E\.?|Master of Engineering)\b/gi,
    /\b(MBA|Master of Business Administration)\b/gi,
    /\b(M\.?Sc\.?|Master of Science)\b/gi,
    /\b(M\.?A\.?|Master of Arts)\b/gi,
    /\b(PGDM|Post Graduate Diploma in Management)\b/gi,
    /\b(B\.?Tech\.?|Bachelor of Technology)\b/gi,
    /\b(B\.?E\.?|Bachelor of Engineering)\b/gi,
    /\b(B\.?Sc\.?|Bachelor of Science)\b/gi,
    /\b(B\.?Com\.?|Bachelor of Commerce)\b/gi,
    /\b(B\.?A\.?|Bachelor of Arts)\b/gi,
    /\b(BCA|Bachelor of Computer Applications)\b/gi,
    /\b(MCA|Master of Computer Applications)\b/gi,
    /\b(BBA|Bachelor of Business Administration)\b/gi,
    /\b(Diploma)\b/gi,
    /\b(10th|12th|SSC|HSC|Intermediate|High School|Secondary)\b/gi,
  ];
 
  for (const line of allLines) {
    if (!line || line.length > 200) continue;
    for (const pattern of degreePatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        // Use just the degree keyword + up to 60 chars of context, not the full bullet
        const match = line.match(pattern);
        if (match) {
          const idx = line.indexOf(match[0]);
          const snippet = cleanLine(line.substring(0, idx + match[0].length + 40)).slice(0, 80);
          degrees.push(snippet || cleanLine(line));
        }
        break;
      }
    }
  }
 
  return unique(degrees).slice(0, 3);
};
 
// ─── Location Extraction ──────────────────────────────────────────────────────
 
const extractLocation = (text, sections) => {
  // Search priority: header section → explicit label anywhere → top 20 lines → full text scan
  const headerLines = sections.header || [];
  const allLines = getLines(text);
  const topLines = allLines.slice(0, 20);
 
  const tryParseLine = (line) => {
    if (!line || line.length > 150) return null;
 
    // Explicit label: "Location: Noida, UP" or "City: Delhi"
    const explicit = line.match(/(?:location|address|current\s+location|city|residing\s+at|residence)\s*[:\-]\s*(.+)/i);
    const candidate = cleanLine(explicit ? explicit[1] : line);
    const lower = candidate.toLowerCase();
 
    // Use longest matching city name to avoid "noida" beating "greater noida"
    const cityMatch = CITY_NAMES.filter((c) => lower.includes(c)).sort((a, b) => b.length - a.length)[0] || null;
    const stateMatch = STATE_NAMES.find((s) => lower.includes(s));
    const countryMatch = COUNTRY_NAMES.find((c) => lower.includes(c));
 
    if (cityMatch || stateMatch || countryMatch) {
      // Split on commas or pipes for structured parts
      const parts = candidate.split(/[,|]/).map(cleanLine).filter(Boolean);
 
      // Extract just the city token from parts[0], stripping institution names etc.
      // e.g. "Chandigarh University Chandigarh" → "Chandigarh"
      // e.g. "Noida, Uttar Pradesh" → "Noida"
      let city = parts[0] || cityMatch || null;
      if (city && cityMatch) {
        const cityLower = city.toLowerCase();
        // If the part starts with the city name directly, trim trailing words
        if (cityLower.startsWith(cityMatch)) {
          city = city.substring(0, cityMatch.length);
        } else {
          // City name appears after some text (e.g. institution name) — find last occurrence
          // "Chandigarh University Chandigarh" — take the last occurrence of "chandigarh"
          const lastIdx = cityLower.lastIndexOf(cityMatch);
          city = lastIdx !== -1
            ? cleanLine(city.substring(lastIdx, lastIdx + cityMatch.length))
            : cityMatch;
        }
        // Capitalise first letter
        city = city.charAt(0).toUpperCase() + city.slice(1);
      }
 
      // Build clean formatted string
      const formattedParts = [city, parts[1] || stateMatch, parts[parts.length - 1] || countryMatch || "India"]
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i); // deduplicate
      const formatted = formattedParts.join(", ");
 
      return {
        formatted,
        City: city || null,
        State: parts[1] || stateMatch || null,
        Country: parts[parts.length - 1] || countryMatch || "India",
      };
    }
    return null;
  };
 
  // Pass 1: header section
  for (const line of headerLines) {
    if (looksLikeJobTitle(line)) continue;
    const result = tryParseLine(line);
    if (result) return result;
  }
 
  // Pass 2: top 20 lines
  for (const line of topLines) {
    if (looksLikeJobTitle(line)) continue;
    // Contact lines often contain location ("Mumbai | +91-xxx | email@x.com") — extract city from them too
    const result = tryParseLine(line);
    if (result) return result;
  }
 
  // Pass 3: scan entire resume for explicit "Location:" label
  for (const line of allLines) {
    const explicit = line.match(/(?:location|current\s+location|address)\s*[:\-]\s*(.+)/i);
    if (explicit) {
      const result = tryParseLine(line);
      if (result) return result;
    }
  }
 
  return null;
};
 
// ─── Name Extraction ──────────────────────────────────────────────────────────
 
// Words that should never be treated as a candidate name
const NAME_BLACKLIST = new Set([
  "resume","cv","curriculum","vitae","profile","summary","objective","career",
  "contact","address","email","phone","mobile","linkedin","github","portfolio",
  "experience","education","skills","projects","certifications","references",
  "professional","technical","personal","details","information","overview",
  "fresher","candidate","applicant","dear","hiring","manager","sir","madam",
  "updated","new","my","the","a","an",
]);
 
const titleCaseLine = (line) =>
  line.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
 
const isBlacklistedName = (line) => {
  const lower = line.toLowerCase().trim();
  return NAME_BLACKLIST.has(lower) || NAME_BLACKLIST.has(lower.split(/\s+/)[0]);
};
 
// Strip contact-info tokens from a line so we can still find the name portion.
// e.g. "Anchal Arora   Email: foo@bar.com   Mobile: 9999" => "Anchal Arora"
const stripContactTokens = (line) =>
  line
    .replace(/\b(?:email|mobile|phone|tel|contact|linkedin|github|portfolio|www)\s*[:\-].*$/i, "")
    .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/(?:\+\d{1,3}[\s\-]?)?\d[\d\s\-\.]{8,}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
 
const isNameLike = (str) => {
  if (!str || str.length < 3 || str.length > 60) return false;
  if (isBlacklistedName(str)) return false;
  const lower = str.toLowerCase();
  if (CITY_NAMES.some((c) => lower === c) || STATE_NAMES.some((s) => lower === s)) return false;
  return true;
};
 
const extractName = (text, sections) => {
  const headerLines = sections.header || [];
  const topLines = getLines(text).slice(0, 10);
  const candidates = [...headerLines, ...topLines];
 
  // Pass 1 — Explicit "Name:" label
  for (const line of candidates) {
    const m = line.match(/^(?:name|full\s+name|candidate\s+name)\s*[:\-]\s*(.+)/i);
    if (m) {
      const val = cleanLine(m[1]);
      if (isNameLike(val)) return titleCaseLine(val);
    }
  }
 
  // Pass 2 — Strip contact tokens first, then test proper-case pattern.
  // Handles PDFs that render "Anchal Arora   Email: foo@bar.com" on one line.
  for (const line of candidates) {
    if (looksLikeJobTitle(line)) continue;
    const stripped = cleanLine(stripContactTokens(line));
    if (!isNameLike(stripped)) continue;
    if (/^[A-Z][a-zA-Z'\-\.]{0,25}(?:\s+[A-Z][a-zA-Z'\-\.]{0,25}){1,3}$/.test(stripped)) {
      return stripped;
    }
  }
 
  // Pass 3 — All-caps name (e.g. "RAHUL SHARMA" or "ANCHAL ARORA")
  for (const line of candidates) {
    const stripped = cleanLine(stripContactTokens(line));
    if (/^[A-Z]{2,}(?:\s+[A-Z]{2,}){1,3}$/.test(stripped) && stripped.length < 60) {
      if (isNameLike(stripped)) return titleCaseLine(stripped);
    }
  }
 
  // Pass 4 — Lenient: at least 2 capitalised words, only alpha chars
  for (const line of candidates) {
    if (looksLikeJobTitle(line)) continue;
    const stripped = cleanLine(stripContactTokens(line));
    if (!isNameLike(stripped)) continue;
    const words = stripped.split(/\s+/);
    if (
      words.length >= 2 && words.length <= 4 &&
      words.every((w) => /^[A-Za-z'\-\.]+$/.test(w)) &&
      words.filter((w) => /^[A-Z]/.test(w)).length >= 2
    ) {
      return titleCaseLine(stripped);
    }
  }
 
  return null;
};
 
// ─── Job Title Extraction ─────────────────────────────────────────────────────
 
const extractJobTitlesFromText = (text) => {
  const lowerText = text.toLowerCase();
  const found = [];
  for (const title of JOB_TITLES) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?<![a-z])${escaped}(?![a-z])`, "i");
    if (regex.test(lowerText)) found.push(title);
  }
  return unique(found);
};
 
// ─── Header Title ─────────────────────────────────────────────────────────────
 
const extractHeaderTitle = (sections) => {
  for (const line of (sections.header || []).slice(0, 10)) {
    if (isContactLine(line)) continue;
    // Exact match against known titles first
    if (looksLikeJobTitle(line) && line.length < 80) return line;
  }
  // Second pass: any short line after the name that isn't contact info
  // (e.g. "HR Executive | 3 Years Exp" or "Business Development | Sales")
  for (const line of (sections.header || []).slice(1, 8)) {
    if (isContactLine(line)) continue;
    if (line.length < 80 && line.match(/[A-Za-z]{3,}/) && !line.match(/^\d+/)) {
      // Contains a pipe or dash separating roles — take first part
      const firstPart = line.split(/[|•\-–—]|(?:\s{2,})/)[0].trim();
      if (firstPart && firstPart.length > 3 && firstPart.length < 60) return firstPart;
    }
  }
  return null;
};
 
// ─── Experience Entries ───────────────────────────────────────────────────────
 
const extractExperienceEntries = (sections) => {
  const expLines = sections.experience || [];
  const entries = [];
  const dateRe = new RegExp(DATE_RANGE_REGEX.source, "gi");
 
  for (let i = 0; i < expLines.length; i++) {
    const line = expLines[i];
    dateRe.lastIndex = 0;
    if (!dateRe.test(line)) continue;
 
    // Gather context: 2 lines before and 2 lines after the date line
    const prev2 = cleanLine(expLines[i - 2] || "");
    const prev  = cleanLine(expLines[i - 1] || "");
    const next  = cleanLine(expLines[i + 1] || "");
    const next2 = cleanLine(expLines[i + 2] || "");
 
    // Parts embedded in the date line itself (e.g. "UI/UX Designer | ObserveNow AI | Jan 2026 – Present")
    const parts = line
      .replace(new RegExp(DATE_RANGE_REGEX.source, "gi"), "")
      .split(/[\|,]/)
      .map(cleanLine)
      .filter(Boolean);
 
    const title =
      parts.find(looksLikeJobTitle) ||
      (looksLikeJobTitle(prev)  ? prev  : null) ||
      (looksLikeJobTitle(next)  ? next  : null) ||
      (looksLikeJobTitle(prev2) ? prev2 : null) ||
      (looksLikeJobTitle(next2) ? next2 : null) ||
      null;
 
    const company =
      parts.find((p) => looksLikeCompany(p) || looksLikeGenericCompany(p)) ||
      (looksLikeCompany(prev)  || looksLikeGenericCompany(prev)  ? prev  : null) ||
      (looksLikeCompany(next)  || looksLikeGenericCompany(next)  ? next  : null) ||
      (looksLikeCompany(prev2) || looksLikeGenericCompany(prev2) ? prev2 : null) ||
      (looksLikeCompany(next2) || looksLikeGenericCompany(next2) ? next2 : null) ||
      null;
 
    const isCurrent = /present|current|till\s*date|now/i.test(line);
    if (title || company) entries.push({ title, company, isCurrentEmployer: isCurrent });
  }
 
  // Fallback: look for title+company pairs
  if (!entries.length) {
    for (let i = 0; i < expLines.length - 1; i++) {
      const cur = expLines[i], nxt = expLines[i + 1];
      if (looksLikeJobTitle(cur) && (looksLikeCompany(nxt) || looksLikeGenericCompany(nxt))) {
        entries.push({ title: cur, company: nxt, isCurrentEmployer: i < 3 });
      } else if ((looksLikeCompany(cur) || looksLikeGenericCompany(cur)) && looksLikeJobTitle(nxt)) {
        entries.push({ title: nxt, company: cur, isCurrentEmployer: i < 3 });
      }
    }
  }
 
  return entries.filter((e) => e.title || e.company);
};
 
// ─── Summary ──────────────────────────────────────────────────────────────────
 
const extractSummary = (text, sections) => {
  if ((sections.summary || []).length) {
    return sanitizeText((sections.summary || []).join(" "));
  }
  const firstParagraph = getLines(text)
    .slice(0, 15)
    .filter((line) => !isContactLine(line) && !looksLikeJobTitle(line))
    .slice(1, 5)
    .join(" ");
  return sanitizeText(firstParagraph);
};
 
// ─── File Download & Text Extraction ─────────────────────────────────────────
 
const downloadFile = async (fileUrl) => {
  const response = await fetch(fileUrl);
  if (!response.ok) throw new Error(`Failed to download resume: HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, contentType };
};
 
const extractText = async (buffer, contentType) => {
  const isPdf =
    contentType.includes("pdf") ||
    (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46); // %PDF magic
 
  // DOCX: ZIP magic bytes (PK) — also used for .docx
  const isDocx =
    contentType.includes("wordprocessingml") ||
    contentType.includes("docx") ||
    (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04);
 
  // Legacy .doc: OLE2 Compound Document magic (D0 CF 11 E0)
  const isLegacyDoc =
    contentType.includes("msword") ||
    contentType.includes("application/doc") ||
    (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0);
 
  if (isPdf) {
    const r = await pdfParse(buffer);
    return r?.text || "";
  }
  if (isDocx) {
    const r = await mammoth.extractRawText({ buffer });
    return r.value || "";
  }
  if (isLegacyDoc) {
    // mammoth can sometimes handle legacy .doc — try it, fall back to raw text
    try {
      const r = await mammoth.extractRawText({ buffer });
      if (r.value && r.value.trim().length > 30) return r.value;
    } catch (_) { /* fall through */ }
    // Last resort: extract printable ASCII strings (like `strings` command)
    const raw = buffer.toString("binary");
    const strings = raw.match(/[\x20-\x7e\r\n\t]{4,}/g) || [];
    return strings.join("\n");
  }
  return buffer.toString("utf-8");
};
 
// ─── Build Payload ────────────────────────────────────────────────────────────
 
const buildPayload = (rawText) => {
  const sections = buildSections(rawText);
  const name = extractName(rawText, sections);
  const email = rawText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)?.[0] || null;
 
  // Phone: prefer 10-digit Indian numbers, then international formats
  const phonePatterns = [
    // Indian mobile with optional +91/0 prefix
    /(?:\+91|0)?[\s\-]?(?:[6-9]\d{9})\b/,
    // Generic international: +<cc> <number>
    /\+\d{1,3}[\s\-.]?\(?\d{2,5}\)?[\s\-.]?\d{3,5}[\s\-.]?\d{4,6}/,
    // 10-digit plain number
    /\b[6-9]\d{9}\b/,
    // Fallback: at least 10 digits in a row with separators
    /\b\d[\d\s\-\.]{8,14}\d\b/,
  ];
 
  let phone = null;
  for (const pattern of phonePatterns) {
    const m = rawText.match(pattern);
    if (m) {
      const cleaned = m[0].replace(/[\s\-\.]/g, "").trim();
      // Reject if it looks like a year range or very short
      if (cleaned.replace(/\D/g, "").length >= 10) {
        phone = m[0].trim();
        break;
      }
    }
  }
  const location = extractLocation(rawText, sections);
  const sectionSkills = extractSkillsFromSections(sections);
  const dbSkills = extractSkillsFromDB(rawText);
  const skills = unique([...sectionSkills, ...dbSkills]);
  const education = extractEducation(rawText, sections);
  const expEntries = extractExperienceEntries(sections);
  const dbTitles = extractJobTitlesFromText(rawText);
  const jobTitles = unique([
    extractHeaderTitle(sections),
    ...expEntries.map((e) => e.title).filter(Boolean),
    ...dbTitles,
  ]).filter(Boolean);
  const companies = unique([
    ...expEntries.map((e) => e.company).filter(Boolean),
    ...(sections.experience || []).filter((l) => looksLikeCompany(l)),
    // Also scan for lines that are clearly organisation names (proper nouns, 2-5 words, no verbs)
    ...(sections.experience || []).filter((l) => {
      if (!l || l.length > 80 || l.length < 4) return false;
      if (isContactLine(l) || looksLikeJobTitle(l)) return false;
      if (new RegExp(DATE_RANGE_REGEX.source, "gi").test(l)) return false;
      const words = l.split(/\s+/).filter(Boolean);
      return words.length >= 1 && words.length <= 6 &&
        words.filter((w) => w.length > 1).every((w) => /^[A-Z]/.test(w));
    }),
  ]).slice(0, 5);
  const experienceYears = extractExperienceYears(rawText, sections);
  const summary = extractSummary(rawText, sections);
  const currentEntry = expEntries.find((e) => e.isCurrentEmployer) || expEntries[0] || null;
 
  return {
    ResumeParserData: {
      Name: { FullName: name, FormattedName: name },
      Email: email ? [{ EmailAddress: email }] : [],
      PhoneNumber: phone ? [{ FormattedNumber: phone, Number: phone, OriginalNumber: phone }] : [],
      Address: location ? [{ City: location.City, State: location.State, Country: location.Country }] : [],
      CurrentLocation: location ? [{ City: location.City, State: location.State, Country: location.Country }] : [],
      CurrentEmployer: currentEntry?.company || companies[0] || null,
      JobProfile: currentEntry?.title || jobTitles[0] || null,
      WorkedPeriod: {
        TotalExperienceInYear: experienceYears != null ? String(experienceYears) : null,
        TotalExperienceInMonths: experienceYears != null ? String(Math.round(experienceYears * 12)) : null,
      },
      ExecutiveSummary: summary,
      Summary: summary,
      Objectives: null,
      WorkAuthorization: null,
      VisaStatus: null,
      Skill: skills.map((s) => ({ Skill: s, FormattedName: s, Alias: s })),
      SegregatedSkill: skills.map((s) => ({ FormattedName: s, Skill: s })),
      SkillKeywords: skills.join(", "),
      SegregatedExperience: (
        expEntries.length
          ? expEntries
          : companies.map((c, i) => ({ title: jobTitles[i] || jobTitles[0] || null, company: c, isCurrentEmployer: i === 0, rawDateLine: "" }))
      ).map((e, i) => ({
        IsCurrentEmployer: e.isCurrentEmployer ? "true" : "false",
        JobProfile: {
          FormattedName: e.title || jobTitles[i] || jobTitles[0] || null,
          Title: e.title || jobTitles[i] || jobTitles[0] || null,
          Alias: null,
        },
        Employer: {
          EmployerName: e.company || companies[i] || null,
          FormattedName: e.company || companies[i] || null,
        },
        Location: { City: location?.City || null, State: location?.State || null, Country: location?.Country || null },
        StartDate: null,
        // Preserve "Present" so deriveCompany in frontendMappers can detect current employer
        EndDate: e.isCurrentEmployer ? "Present" : "Previous",
      })),
      SegregatedQualification: education.map((d) => ({
        Degree: { DegreeName: d, NormalizeDegree: d },
        Institution: { Name: null },
        StartDate: null,
        EndDate: null,
      })),
      DetailResume: rawText,
      ResumeCountry: { Country: location?.Country || "India" },
      ApiInfo: { BuildVersion: "free-parser-2.0.0" },
    },
  };
};
 
// ─── Public Exports ───────────────────────────────────────────────────────────
 
export const parseResumeWithRChilli = async (fileUrl) => {
  const { buffer, contentType } = await downloadFile(fileUrl);
  const rawText = await extractText(buffer, contentType);
  if (!rawText || rawText.trim().length < 30) {
    throw new Error("Could not extract readable text. File may be scanned or corrupted.");
  }
  return buildPayload(rawText);
};
 
// ─── Normalizer (unchanged interface) ────────────────────────────────────────
 
const pickCurrentExperience = (experiences = []) => {
  const arr = toArray(experiences);
  return arr.find((e) => e?.IsCurrentEmployer === "true") || arr[0] || null;
};
 
const extractJobTitlesFromParsed = (parsed) => {
  const titles = [];
  const direct = sanitizeText(parsed?.JobProfile);
  if (direct) titles.push(direct);
  for (const exp of toArray(parsed?.SegregatedExperience)) {
    const t = sanitizeText(exp?.JobProfile?.FormattedName) || sanitizeText(exp?.JobProfile?.Title) || sanitizeText(exp?.JobProfile?.Alias);
    if (t) titles.push(t);
  }
  return unique(titles);
};
 
const extractCompaniesFromParsed = (parsed) => {
  const companies = [];
  const cur = sanitizeText(parsed?.CurrentEmployer);
  if (cur) companies.push(cur);
  for (const exp of toArray(parsed?.SegregatedExperience)) {
    const c = sanitizeText(exp?.Employer?.EmployerName) || sanitizeText(exp?.Employer?.FormattedName);
    if (c) companies.push(c);
  }
  return unique(companies);
};
 
const extractLocationsFromParsed = (parsed) => {
  const locs = [];
  const addLoc = (locObj) => {
    // Prefer the pre-built "formatted" string if present (set by our own buildPayload)
    if (locObj?.formatted) { locs.push(locObj.formatted); return; }
    const l = buildLocation(locObj);
    if (l) locs.push(l);
  };
  for (const a of toArray(parsed?.Address)) addLoc(a);
  for (const a of toArray(parsed?.CurrentLocation)) addLoc(a);
  for (const e of toArray(parsed?.SegregatedExperience)) {
    const l = buildLocation(e?.Location);
    // Only push experience locations if they contain a known city (not just "India")
    if (l && l.toLowerCase() !== "india" && CITY_NAMES.some((c) => l.toLowerCase().includes(c))) {
      locs.push(l);
    }
  }
  const rc = sanitizeText(parsed?.ResumeCountry?.Country);
  if (rc && rc.toLowerCase() !== "india") locs.push(rc);
  // If nothing found yet, still try country
  if (!locs.length && rc) locs.push(rc);
  return unique(locs);
};
 
const extractEducationFromParsed = (parsed) => {
  const edu = [];
  for (const q of toArray(parsed?.SegregatedQualification)) {
    const d = sanitizeText(q?.Degree?.DegreeName) || sanitizeText(q?.Degree?.NormalizeDegree) || sanitizeText(q?.Institution?.Name);
    if (d) edu.push(d);
  }
  for (const e of toArray(parsed?.Education)) {
    const d = sanitizeText(e?.Degree) || sanitizeText(e?.DegreeName) || sanitizeText(e?.Qualification);
    if (d) edu.push(d);
  }
  if (!edu.length) { const q = sanitizeText(parsed?.Qualification); if (q) edu.push(q); }
  return unique(edu);
};
 
const extractSkillsFromParsed = (parsed) => {
  const skills = [];
  for (const s of toArray(parsed?.Skill)) {
    const sk = sanitizeText(s?.Skill) || sanitizeText(s?.FormattedName) || sanitizeText(s?.Alias);
    if (sk) skills.push(sk);
  }
  for (const s of toArray(parsed?.SegregatedSkill)) {
    const sk = sanitizeText(s?.FormattedName) || sanitizeText(s?.Skill);
    if (sk) skills.push(sk);
  }
  skills.push(...splitSkillText(parsed?.SkillKeywords));
  skills.push(...splitSkillText(parsed?.SkillBlock));
  return unique(skills);
};
 
const extractExperienceYearsFromParsed = (parsed) => {
  const wp = parsed?.WorkedPeriod || {};
  const candidates = [
    wp?.TotalExperienceInYear,
    wp?.TotalExperienceInYears,
    wp?.TotalExperienceInMonths ? Number(wp.TotalExperienceInMonths) / 12 : null,
    parsed?.YearOfExperience?.Years,
    parsed?.TotalExperienceInYears,
    parsed?.ExperienceSummary?.TotalExperienceInYears,
  ];
  for (const v of candidates) {
    if (v === null || v === undefined || v === "" || v === "null") continue;
    const n = parseFloat(String(v));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
};
 
const extractResumeText = (parsed) =>
  sanitizeText(parsed?.DetailResume) ||
  sanitizeText(parsed?.ResumeText) ||
  sanitizeText(parsed?.Summary) ||
  sanitizeText(parsed?.ExecutiveSummary) ||
  null;
 
export const normalizeRChilliResumeData = (payload) => {
  const parsed = payload?.ResumeParserData || {};
  const emailEntry = getFirstValue(parsed.Email);
  const phoneEntry = getFirstValue(parsed.PhoneNumber);
  const parsedSkills = extractSkillsFromParsed(parsed);
  const parsedJobTitles = extractJobTitlesFromParsed(parsed);
  const parsedLocations = extractLocationsFromParsed(parsed);
  const parsedEducation = extractEducationFromParsed(parsed);
  const parsedCompanies = extractCompaniesFromParsed(parsed);
  const currentExperience = pickCurrentExperience(parsed?.SegregatedExperience);
 
  const normalizedSkills = unique(parsedSkills.map(toSlug).filter(Boolean));
  const normalizedJobTitles = unique(parsedJobTitles.map(toSlug).filter(Boolean));
  const normalizedLocations = unique(parsedLocations.map(toSlug).filter(Boolean));
  const normalizedEducation = unique(parsedEducation.map(toSlug).filter(Boolean));
 
  const currentLocation = parsedLocations[0] || null;
  const currentJobTitle =
    sanitizeText(currentExperience?.JobProfile?.FormattedName) ||
    sanitizeText(currentExperience?.JobProfile?.Title) ||
    sanitizeText(parsed?.JobProfile) ||
    parsedJobTitles[0] ||
    null;
  const currentCompany =
    sanitizeText(currentExperience?.Employer?.EmployerName) ||
    sanitizeText(parsed?.CurrentEmployer) ||
    parsedCompanies[0] ||
    null;
  const highestEducation = parsedEducation[0] || null;
  const totalExperienceRaw = extractExperienceYearsFromParsed(parsed);
  // Always store as a proper number for Supabase numeric column
  const totalExperience = totalExperienceRaw != null ? Number(totalExperienceRaw) : null;
  const extractedText = extractResumeText(parsed);
 
  // Last-resort name: derive from email address (e.g. "rahul.sharma@gmail.com" → "Rahul Sharma")
  const deriveNameFromEmail = (email) => {
    if (!email) return null;
    const local = email.split("@")[0];
    // Strip trailing digits (e.g. "rahul123" → "rahul")
    const cleaned = local.replace(/[\d_\-\.]+$/, "");
    // Split on dots/underscores/hyphens
    const parts = cleaned.split(/[.\-_]+/).filter((p) => p.length > 1);
    if (parts.length >= 2) {
      return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
    }
    return null;
  };
 
  const rawName = sanitizeText(parsed?.Name?.FullName) || sanitizeText(parsed?.Name?.FormattedName) || null;
  const resolvedEmail = sanitizeText(emailEntry?.EmailAddress);
  const fullName = rawName || deriveNameFromEmail(resolvedEmail) || null;
 
  return {
    candidate: {
      full_name: fullName,
      email: resolvedEmail,
      phone: sanitizeText(phoneEntry?.FormattedNumber) || sanitizeText(phoneEntry?.Number) || sanitizeText(phoneEntry?.OriginalNumber) || null,
      location: currentLocation,
      current_company: currentCompany,
      current_job_title: currentJobTitle,
      total_experience: totalExperience,
      highest_education: highestEducation,
      work_authorization: sanitizeText(parsed?.WorkAuthorization) || sanitizeText(parsed?.VisaStatus),
      profile_summary: sanitizeText(parsed?.ExecutiveSummary) || sanitizeText(parsed?.Summary) || sanitizeText(parsed?.Objectives) || null,
    },
    parsedData: {
      parser_name: "FreeParser",
      parser_version: parsed?.ApiInfo?.BuildVersion || "free-parser-2.0.0",
      raw_parser_response: payload,
      extracted_text: extractedText,
      parsed_job_titles: parsedJobTitles,
      parsed_skills: parsedSkills,
      parsed_locations: parsedLocations,
      parsed_education: parsedEducation,
      parsed_companies: parsedCompanies,
      normalized_job_titles: normalizedJobTitles,
      normalized_skills: normalizedSkills,
      normalized_locations: normalizedLocations,
      normalized_education: normalizedEducation,
    },
  };
};
 

// import fetch from "node-fetch";
// import mammoth from "mammoth";
// import { createRequire } from "module";
// const require = createRequire(import.meta.url);
 
// // pdf-parse has inconsistent exports depending on version — handle all cases
// const _pdfParseRaw = require("pdf-parse");
// const pdfParse = typeof _pdfParseRaw === "function"
//   ? _pdfParseRaw
//   : typeof _pdfParseRaw?.default === "function"
//   ? _pdfParseRaw.default
//   : typeof _pdfParseRaw?.parse === "function"
//   ? _pdfParseRaw.parse
//   : null;
 
// if (!pdfParse) throw new Error("pdf-parse could not be loaded. Run: npm install pdf-parse");
 
// // ─── Basic Helpers ────────────────────────────────────────────────────────────
 
// const sanitizeText = (value) => {
//   if (typeof value !== "string") return null;
//   return (
//     value
//       .replace(/<br\s*\/?>/gi, "\n")
//       .replace(/<\/p>/gi, "\n")
//       .replace(/<[^>]+>/g, " ")
//       .replace(/&nbsp;/gi, " ")
//       .replace(/\s+/g, " ")
//       .trim() || null
//   );
// };
 
// const toSlug = (value) =>
//   String(value || "")
//     .trim()
//     .toLowerCase()
//     .replace(/[^a-z0-9]+/g, " ")
//     .trim();
 
// const unique = (values) => Array.from(new Set((values || []).filter(Boolean)));
// const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
// const getFirstValue = (v) => (Array.isArray(v) ? v[0] || null : v || null);
// const splitSkillText = (value) =>
//   String(value || "")
//     .split(/[,|\n]/)
//     .map((e) => sanitizeText(e))
//     .filter(Boolean);
 
// const cleanLine = (value) =>
//   String(value || "")
//     .replace(/[|]+/g, " ")
//     .replace(/[\u2022\u25cf\u25aa\u25a0\u2023\u2043]+/g, " ")
//     .replace(/\t+/g, " ")
//     .replace(/\s+/g, " ")
//     .trim();
 
// const buildLocation = (loc = {}) => {
//   // Use pre-built formatted string if available (set by our own parser)
//   if (loc?.formatted) return loc.formatted;
//   const city = sanitizeText(loc?.City);
//   const state = sanitizeText(loc?.State);
//   const country = sanitizeText(loc?.Country);
//   // Deduplicate: don't add state/country if same as city, and don't repeat "India, India"
//   const parts = [];
//   if (city) parts.push(city);
//   if (state && state.toLowerCase() !== city?.toLowerCase()) parts.push(state);
//   if (country && country.toLowerCase() !== state?.toLowerCase() && country.toLowerCase() !== city?.toLowerCase()) parts.push(country);
//   return parts.length ? parts.join(", ") : null;
// };
 
// const getLines = (text) =>
//   String(text || "")
//     .split(/\r?\n/)
//     .map(cleanLine)
//     .filter(Boolean);
 
// const normalizeHeader = (value) =>
//   cleanLine(value)
//     .toLowerCase()
//     .replace(/[^a-z\s]/g, " ")
//     .replace(/\s+/g, " ")
//     .trim();
 
// // ─── Section Detection ────────────────────────────────────────────────────────
 
// const SECTION_HEADER_MAP = {
//   summary: ["summary", "professional summary", "profile summary", "career summary", "profile", "about me", "objective", "career objective", "about", "overview"],
//   experience: ["experience", "work experience", "professional experience", "employment history", "employment", "work history", "career history", "internship", "internships"],
//   education: ["education", "academic qualification", "academic qualifications", "qualification", "qualifications", "educational background", "academics"],
//   skills: ["skills", "technical skills", "core competencies", "key skills", "competencies", "expertise", "areas of expertise", "skill set", "tools", "technologies"],
//   projects: ["projects", "project experience", "key projects"],
//   certifications: ["certifications", "certification", "licenses", "achievements", "awards"],
// };
 
// const STOP_HEADERS = new Set(Object.values(SECTION_HEADER_MAP).flat());
 
// const getSectionKey = (line) => {
//   const normalized = normalizeHeader(line);
//   if (!normalized) return null;
//   // All-caps lines that are very long are probably bullet content, not headers
//   if (line === line.toUpperCase() && line.length > 40) return null;
 
//   for (const [key, aliases] of Object.entries(SECTION_HEADER_MAP)) {
//     for (const alias of aliases) {
//       // Exact match
//       if (normalized === alias) return key;
//       // Header starts with the alias (handles "Experience (2018-2022)", "Skills & Tools")
//       if (normalized.startsWith(alias + " ") || normalized.startsWith(alias + ":")) return key;
//       // Header ends with the alias (handles "Technical Skills", "Key Skills")
//       if (normalized.endsWith(" " + alias)) return key;
//       // Alias is contained as whole words within a short header (≤5 words)
//       const words = normalized.split(/\s+/);
//       if (words.length <= 5 && normalized.includes(alias)) return key;
//     }
//   }
//   return null;
// };
 
// const buildSections = (text) => {
//   const sections = { header: [] };
//   let current = "header";
//   for (const line of getLines(text)) {
//     const key = getSectionKey(line);
//     if (key) { current = key; sections[current] ||= []; continue; }
//     sections[current] ||= [];
//     sections[current].push(line);
//   }
//   return sections;
// };
 
// // ─── Date Parsing ─────────────────────────────────────────────────────────────
 
// const MONTH_MAP = { jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11 };
 
// const DATE_RANGE_REGEX =
//   /\b((?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{4}|\d{1,2}[\/\-]\d{4}|\d{4})\s*(?:-|[\u2013\u2014]|to)\s*(present|current|till\s*date|now|(?:jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+\d{4}|\d{1,2}[\/\-]\d{4}|\d{4})\b/gi;
 
// const parseDateToken = (value) => {
//   if (!value) return null;
//   const token = value.trim().toLowerCase();
//   if (/(present|current|till\s*date|now)/i.test(token)) {
//     const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() };
//   }
//   const m1 = token.match(/^(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{4})$/);
//   if (m1) return { year: Number(m1[2]), month: MONTH_MAP[m1[1]] ?? 0 };
//   const m2 = token.match(/^(\d{1,2})[\/\-](\d{4})$/);
//   if (m2) return { year: Number(m2[2]), month: Math.max(0, Number(m2[1]) - 1) };
//   const m3 = token.match(/^(\d{4})$/);
//   if (m3) return { year: Number(m3[1]), month: 0 };
//   return null;
// };
 
// const dateToMonths = (d) => d.year * 12 + d.month;
 
// const mergeDateRanges = (ranges) => {
//   if (!ranges.length) return [];
//   const sorted = [...ranges].sort((a, b) => a.start - b.start);
//   const merged = [{ ...sorted[0] }];
//   for (const r of sorted.slice(1)) {
//     const prev = merged[merged.length - 1];
//     if (r.start <= prev.end + 1) prev.end = Math.max(prev.end, r.end);
//     else merged.push({ ...r });
//   }
//   return merged;
// };
 
// const extractDateRanges = (text) => {
//   const ranges = [];
//   let m;
//   const re = new RegExp(DATE_RANGE_REGEX.source, "gi");
//   while ((m = re.exec(text)) !== null) {
//     const start = parseDateToken(m[1]);
//     const end = parseDateToken(m[2]);
//     if (!start || !end) continue;
//     const s = dateToMonths(start), e = dateToMonths(end);
//     if (e < s || end.year - start.year > 45) continue;
//     ranges.push({ start: s, end: e });
//   }
//   return mergeDateRanges(ranges);
// };
 
// // ─── Location Data ────────────────────────────────────────────────────────────
 
// const COUNTRY_NAMES = ["india","united states","usa","united kingdom","uk","uae","united arab emirates","canada","australia","singapore","germany","france","malaysia","indonesia"];
// const STATE_NAMES = ["andhra pradesh","arunachal pradesh","assam","bihar","chhattisgarh","delhi","goa","gujarat","haryana","himachal pradesh","jharkhand","karnataka","kerala","madhya pradesh","maharashtra","odisha","punjab","rajasthan","tamil nadu","telangana","uttar pradesh","uttarakhand","west bengal"];
// const CITY_NAMES = ["mumbai","new delhi","delhi","bangalore","bengaluru","hyderabad","chennai","kolkata","pune","ahmedabad","jaipur","noida","greater noida","gurugram","gurgaon","lucknow","chandigarh","indore","bhopal","nagpur","surat","vadodara","navi mumbai","thane","kochi","coimbatore","mysore","vizag","visakhapatnam","agra","meerut","faridabad","panchkula","mohali","dehradun","patna","raipur","bhubaneswar","ranchi"];
 
// // ─── Job Titles ───────────────────────────────────────────────────────────────
 
// const JOB_TITLES = [
//   // Conference / Events
//   "conference producer","senior conference producer","junior conference producer","conference manager","event producer","event manager","conference coordinator","event coordinator","conference director","content producer","programme producer","program producer","conference content manager",
//   // Operations
//   "operations executive","operations manager","operations coordinator","operations specialist","operations analyst","operations associate","senior operations executive","operations head","operations lead","chief operating officer","coo","process manager","process executive",
//   // HR
//   "hr manager","hr executive","hr generalist","hr specialist","hr coordinator","hr associate","hr business partner","hrbp","talent acquisition","talent acquisition specialist","talent acquisition executive","talent acquisition manager","recruiter","senior recruiter","recruitment executive","recruitment manager","recruitment specialist","learning and development","l&d","training manager","training executive","payroll executive","payroll manager","hr head","chief human resources officer","chro","people manager","people operations",
//   // Marketing
//   "marketing manager","marketing executive","marketing specialist","marketing coordinator","digital marketing manager","digital marketing executive","content writer","content manager","content strategist","seo executive","seo manager","social media manager","social media executive","brand manager","growth manager","growth hacker","performance marketing","email marketing","marketing analyst","marketing head","chief marketing officer","cmo","product marketing manager",
//   // Business Development
//   "business development manager","business development executive","business development associate","bdm","bde","bd manager","bd executive","key account manager","account manager","account executive","partnership manager","alliance manager","corporate sales manager","enterprise sales manager",
//   // Sales
//   "sales manager","sales executive","sales associate","sales representative","sales officer","sales head","vp sales","sales director","inside sales","field sales","pre-sales","presales","sales analyst","channel sales","retail sales","b2b sales","lead generation executive","lead generation manager",
//   // Tech
//   "software engineer","senior software engineer","junior software engineer","lead software engineer","full stack developer","frontend developer","backend developer","web developer","mobile developer","react developer","node.js developer","python developer","java developer","data scientist","data analyst","data engineer","machine learning engineer","ai engineer","devops engineer","cloud engineer","site reliability engineer","sre","product manager","project manager","scrum master","qa engineer","quality assurance","test engineer","automation engineer","database administrator","tech lead","team lead","cto","vp engineering","engineering manager",
//   // General
//   "intern","trainee","fresher","associate","consultant","senior consultant","manager","senior manager","director","vice president","vp","assistant manager","deputy manager","executive","coordinator","specialist","analyst","officer",
// ];
 
// // ─── Skills Database ──────────────────────────────────────────────────────────
 
// const SKILLS_DB = [
//   // Tech
//   "javascript","typescript","python","java","c++","c#","ruby","php","swift","kotlin","go","rust","scala","r","matlab",
//   "react","react.js","angular","vue","vue.js","html","css","html5","css3","sass","bootstrap","tailwind","next.js","redux","jquery","webpack",
//   "node.js","express","django","flask","spring boot","laravel","fastapi","nestjs","graphql","rest api",
//   "sql","mysql","postgresql","mongodb","redis","firebase","supabase","dynamodb","elasticsearch",
//   "aws","azure","gcp","docker","kubernetes","jenkins","ci/cd","terraform","linux","git","github","gitlab","jira","figma","postman",
//   "machine learning","deep learning","tensorflow","pytorch","pandas","numpy","data analysis","power bi","tableau","excel","ai","data science",
//   // HR Skills
//   "talent acquisition","recruitment","sourcing","headhunting","onboarding","offboarding","payroll","hris","hrms","performance management","employee relations","hr operations","hr generalist","training and development","learning and development","compensation and benefits","workforce planning","employer branding","hr analytics","exit interviews","bgv","background verification",
//   // Marketing Skills
//   "digital marketing","seo","sem","google ads","facebook ads","meta ads","linkedin ads","content marketing","email marketing","social media marketing","brand management","market research","google analytics","hubspot","salesforce","crm","performance marketing","affiliate marketing","influencer marketing","ppc","lead generation","b2b marketing","b2c marketing","marketing automation","mailchimp","zoho","campaign management","product launch",
//   // Sales Skills
//   "b2b sales","b2c sales","inside sales","field sales","cold calling","lead generation","client acquisition","account management","key account management","revenue generation","sales forecasting","sales strategy","pipeline management","crm management","negotiation","business development","channel sales","enterprise sales","retail sales","target achievement","presales","upselling","cross selling",
//   // Conference / Events Skills
//   "conference production","event management","event planning","agenda development","speaker management","programme development","content curation","delegate management","sponsorship","webinar management","virtual events","hybrid events","exhibition management","venue management","event marketing","conference marketing","abstract management",
//   // Operations Skills
//   "operations management","process improvement","process optimization","supply chain","logistics","vendor management","procurement","quality management","lean","six sigma","project management","stakeholder management","reporting","mis","data entry","team management","sop","compliance","budget management","cost reduction","escalation management","client servicing",
//   // Soft Skills
//   "leadership","communication","teamwork","problem solving","time management","analytical","critical thinking","presentation","negotiation","decision making","multitasking","attention to detail","adaptability","creativity","interpersonal skills",
//   // Tools
//   "microsoft office","ms office","word","powerpoint","google workspace","slack","zoom","teams","trello","asana","notion","monday.com","freshdesk","zendesk","whatsapp business","canva","adobe","photoshop",
// ];
 
// // ─── Company Detection ────────────────────────────────────────────────────────
 
// const COMPANY_SUFFIX_REGEX =
//   /\b(pvt\.?\s*ltd\.?|private\s+limited|limited|ltd\.?|inc\.?|corp\.?|corporation|llc|llp|technologies|technology|tech|solutions|systems|services|consulting|consultants|group|infotech|software|labs|international|enterprises|ventures|associates|partners|agency|media|networks|global|india|worldwide)\b/i;
 
// const JOB_TITLE_HINT_REGEX =
//   /\b(engineer|developer|manager|executive|specialist|analyst|consultant|associate|lead|architect|administrator|coordinator|recruiter|designer|producer|director|officer|supervisor|head|intern|trainee|assistant|deputy|senior|junior|vp|president)\b/i;
 
// const isContactLine = (line) =>
//   /@|linkedin|github|portfolio|www\.|https?:|phone|mobile|contact|\+91|\+1/i.test(line);
 
// const looksLikeCompany = (line) => {
//   if (!line || line.length > 120 || line.length < 3) return false;
//   if (isContactLine(line)) return false;
//   // Has a company suffix keyword
//   return COMPANY_SUFFIX_REGEX.test(line);
// };
 
// const looksLikeGenericCompany = (line) => {
//   if (!line || line.length > 80 || isContactLine(line) || looksLikeJobTitle(line)) return false;
//   const words = line.split(/\s+/).filter(Boolean);
//   if (!words.length || words.length > 7) return false;
//   // All words start with uppercase (proper noun pattern)
//   return words.filter((w) => w.length > 1).every((w) => /^[A-Z]/.test(w));
// };
 
// const looksLikeJobTitle = (line) => {
//   if (!line || line.length > 100) return false;
//   if (isContactLine(line)) return false;
//   return JOB_TITLE_HINT_REGEX.test(line) || JOB_TITLES.some((t) => line.toLowerCase().includes(t));
// };
 
// // ─── Experience Extraction ────────────────────────────────────────────────────
 
// const extractExperienceYears = (fullText, sections) => {
//   // 1. Explicit statement — most reliable
//   const patterns = [
//     /(\d+(?:\.\d+)?)\s*\+?\s*years?\s+(?:of\s+)?(?:total\s+)?(?:work\s+)?(?:professional\s+)?experience/i,
//     /(?:total\s+)?(?:work\s+)?experience\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*\+?\s*years?/i,
//     /(\d+(?:\.\d+)?)\s*\+?\s*years?\s+(?:in|of|with)\s+/i,
//     /(\d+(?:\.\d+)?)\s*\+?\s*yrs?\s*(?:of\s+)?(?:exp|experience)/i,
//     /experience\s*[:\-]\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/i,
//     /(\d+(?:\.\d+)?)\s*years?\s+(?:and\s+\d+\s*months?\s+)?(?:of\s+)?(?:overall|total|combined)/i,
//     /overall\s+(?:work\s+)?experience\s*[:\-]?\s*(\d+(?:\.\d+)?)/i,
//   ];
 
//   for (const pattern of patterns) {
//     const match = fullText.match(pattern);
//     if (match) {
//       const val = parseFloat(match[1]);
//       if (val > 0 && val < 60) return val;
//     }
//   }
 
//   // 2. Calculate from date ranges in experience section
//   const expText = (sections.experience || []).join("\n");
//   if (expText.trim()) {
//     const ranges = extractDateRanges(expText);
//     if (ranges.length) {
//       const totalMonths = ranges.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
//       const years = parseFloat((totalMonths / 12).toFixed(1));
//       if (years > 0 && years < 60) return years;
//     }
//   }
 
//   // 3. Fallback: date ranges from full text (excluding education section which has graduation years)
//   const textWithoutEdu = fullText.replace(
//     /(?:education|qualification|academic)[^\n]*\n[\s\S]{0,800}?(?=\n(?:experience|skills|projects|certifications|\n)|$)/gi,
//     ""
//   );
//   const fullRanges = extractDateRanges(textWithoutEdu || fullText);
//   if (fullRanges.length) {
//     const totalMonths = fullRanges.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
//     const years = parseFloat((totalMonths / 12).toFixed(1));
//     if (years > 0 && years < 60) return years;
//   }
 
//   return null;
// };
 
// // ─── Skills Extraction ────────────────────────────────────────────────────────
 
// const MIN_SKILL_WORD_COUNT = 1;
// const MAX_SKILL_WORD_COUNT = 5;
 
// // Words that are NOT skills even if they appear in text
// const SKILL_BLACKLIST = new Set([
//   "and","the","of","to","in","for","with","on","at","by","from","as","is","are","was","were","be","been","being",
//   "have","has","had","do","does","did","will","would","could","should","may","might","shall","must","can",
//   "that","this","these","those","a","an","it","its","we","our","you","your","they","their","he","she","i","my",
//   "not","no","yes","so","but","if","or","nor","yet","both","either","neither","each","every","all","any","few","more","most",
//   "other","some","such","than","then","there","when","where","which","who","whom","how","what","why",
//   "new","good","great","well","also","just","only","very","much","many","more","less","same","different","various",
//   "including","related","relevant","using","used","skills","skill","experience","knowledge","ability","work",
//   "resume","cv","candidate","position","role","job","company","team","year","month","day","time","date",
// ]);
 
// const isValidSkillEntry = (entry) => {
//   if (!entry || typeof entry !== "string") return false;
//   const cleaned = entry.trim();
//   if (cleaned.length < 2 || cleaned.length > 60) return false;
//   const words = cleaned.toLowerCase().split(/\s+/).filter(Boolean);
//   if (words.length < MIN_SKILL_WORD_COUNT || words.length > MAX_SKILL_WORD_COUNT) return false;
//   // Reject if it's just blacklisted words
//   if (words.every((w) => SKILL_BLACKLIST.has(w))) return false;
//   // Reject lines that look like sentences (has verb indicators)
//   if (/\b(responsible|worked|developed|managed|achieved|led|handled|performed|assisted|supported|ensured|helped|provided|created|designed|implemented|maintained|improved|built|delivered)\b/i.test(cleaned)) return false;
//   // Reject if contains numbers that suggest it's a bullet point or date
//   if (/^\d+[\.\)]/.test(cleaned)) return false;
//   return true;
// };
 
// const extractSkillsFromSections = (sections) => {
//   const entries = [];
//   for (const line of sections.skills || []) {
//     // Strip leading bullet characters or numbers before splitting
//     const stripped = line.replace(/^[\u2022\u25cf\u25aa\u25a0\u2023\u2043\-\*\+\>]\s*/, "").trim();
//     // Split on common delimiters: comma, slash, semicolon, pipe, 2+ spaces, bullet chars
//     const parts = stripped.split(/[,\/;|]|\s{2,}|[\u2022\u25cf\u25aa\u25a0]/).map(cleanLine);
//     for (const part of parts) {
//       // Some resumes list one skill per line with no delimiter
//       const subParts = part.split(/\s*[-–]\s*(?=[A-Z])/).map(cleanLine); // "React - Redux" → two entries
//       for (const sub of subParts) {
//         if (isValidSkillEntry(sub)) entries.push(sub);
//       }
//     }
//   }
//   return unique(entries.filter((e) => e.split(/\s+/).length <= MAX_SKILL_WORD_COUNT));
// };
 
// const extractSkillsFromDB = (text) => {
//   const lowerText = text.toLowerCase();
//   const found = [];
//   for (const skill of SKILLS_DB) {
//     const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
//     const regex = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
//     if (regex.test(lowerText)) found.push(skill);
//   }
//   return unique(found);
// };
 
// // ─── Education ────────────────────────────────────────────────────────────────
 
// const extractEducation = (text, sections) => {
//   const degrees = [];
//   // Prefer education section lines, then scan full text
//   const eduLines = sections.education || [];
//   const allLines = [...eduLines, ...getLines(text)];
 
//   const degreePatterns = [
//     /\b(Ph\.?D\.?|Doctor of Philosophy)\b/gi,
//     /\b(M\.?Tech\.?|Master of Technology)\b/gi,
//     /\b(M\.?E\.?|Master of Engineering)\b/gi,
//     /\b(MBA|Master of Business Administration)\b/gi,
//     /\b(M\.?Sc\.?|Master of Science)\b/gi,
//     /\b(M\.?A\.?|Master of Arts)\b/gi,
//     /\b(PGDM|Post Graduate Diploma in Management)\b/gi,
//     /\b(B\.?Tech\.?|Bachelor of Technology)\b/gi,
//     /\b(B\.?E\.?|Bachelor of Engineering)\b/gi,
//     /\b(B\.?Sc\.?|Bachelor of Science)\b/gi,
//     /\b(B\.?Com\.?|Bachelor of Commerce)\b/gi,
//     /\b(B\.?A\.?|Bachelor of Arts)\b/gi,
//     /\b(BCA|Bachelor of Computer Applications)\b/gi,
//     /\b(MCA|Master of Computer Applications)\b/gi,
//     /\b(BBA|Bachelor of Business Administration)\b/gi,
//     /\b(Diploma)\b/gi,
//     /\b(10th|12th|SSC|HSC|Intermediate|High School|Secondary)\b/gi,
//   ];
 
//   for (const line of allLines) {
//     if (!line || line.length > 200) continue;
//     for (const pattern of degreePatterns) {
//       pattern.lastIndex = 0;
//       if (pattern.test(line)) {
//         // Use just the degree keyword + up to 60 chars of context, not the full bullet
//         const match = line.match(pattern);
//         if (match) {
//           const idx = line.indexOf(match[0]);
//           const snippet = cleanLine(line.substring(0, idx + match[0].length + 40)).slice(0, 80);
//           degrees.push(snippet || cleanLine(line));
//         }
//         break;
//       }
//     }
//   }
 
//   return unique(degrees).slice(0, 3);
// };
 
// // ─── Location Extraction ──────────────────────────────────────────────────────
 
// const extractLocation = (text, sections) => {
//   // Search priority: header section → explicit label anywhere → top 20 lines → full text scan
//   const headerLines = sections.header || [];
//   const allLines = getLines(text);
//   const topLines = allLines.slice(0, 20);
 
//   const tryParseLine = (line) => {
//     if (!line || line.length > 150) return null;
 
//     // Explicit label: "Location: Noida, UP" or "City: Delhi"
//     const explicit = line.match(/(?:location|address|current\s+location|city|residing\s+at|residence)\s*[:\-]\s*(.+)/i);
//     const candidate = cleanLine(explicit ? explicit[1] : line);
//     const lower = candidate.toLowerCase();
 
//     // Use longest matching city name to avoid "noida" beating "greater noida"
//     const cityMatch = CITY_NAMES.filter((c) => lower.includes(c)).sort((a, b) => b.length - a.length)[0] || null;
//     const stateMatch = STATE_NAMES.find((s) => lower.includes(s));
//     const countryMatch = COUNTRY_NAMES.find((c) => lower.includes(c));
 
//     if (cityMatch || stateMatch || countryMatch) {
//       // Split on commas or pipes for structured parts
//       const parts = candidate.split(/[,|]/).map(cleanLine).filter(Boolean);
 
//       // Extract just the city token from parts[0], stripping institution names etc.
//       // e.g. "Chandigarh University Chandigarh" → "Chandigarh"
//       // e.g. "Noida, Uttar Pradesh" → "Noida"
//       let city = parts[0] || cityMatch || null;
//       if (city && cityMatch) {
//         const cityLower = city.toLowerCase();
//         // If the part starts with the city name directly, trim trailing words
//         if (cityLower.startsWith(cityMatch)) {
//           city = city.substring(0, cityMatch.length);
//         } else {
//           // City name appears after some text (e.g. institution name) — find last occurrence
//           // "Chandigarh University Chandigarh" — take the last occurrence of "chandigarh"
//           const lastIdx = cityLower.lastIndexOf(cityMatch);
//           city = lastIdx !== -1
//             ? cleanLine(city.substring(lastIdx, lastIdx + cityMatch.length))
//             : cityMatch;
//         }
//         // Capitalise first letter
//         city = city.charAt(0).toUpperCase() + city.slice(1);
//       }
 
//       // Build clean formatted string
//       const formattedParts = [city, parts[1] || stateMatch, parts[parts.length - 1] || countryMatch || "India"]
//         .filter(Boolean)
//         .filter((v, i, a) => a.indexOf(v) === i); // deduplicate
//       const formatted = formattedParts.join(", ");
 
//       return {
//         formatted,
//         City: city || null,
//         State: parts[1] || stateMatch || null,
//         Country: parts[parts.length - 1] || countryMatch || "India",
//       };
//     }
//     return null;
//   };
 
//   // Pass 1: header section
//   for (const line of headerLines) {
//     if (looksLikeJobTitle(line)) continue;
//     const result = tryParseLine(line);
//     if (result) return result;
//   }
 
//   // Pass 2: top 20 lines
//   for (const line of topLines) {
//     if (looksLikeJobTitle(line)) continue;
//     // Contact lines often contain location ("Mumbai | +91-xxx | email@x.com") — extract city from them too
//     const result = tryParseLine(line);
//     if (result) return result;
//   }
 
//   // Pass 3: scan entire resume for explicit "Location:" label
//   for (const line of allLines) {
//     const explicit = line.match(/(?:location|current\s+location|address)\s*[:\-]\s*(.+)/i);
//     if (explicit) {
//       const result = tryParseLine(line);
//       if (result) return result;
//     }
//   }
 
//   return null;
// };
 
// // ─── Name Extraction ──────────────────────────────────────────────────────────
 
// // Words that should never be treated as a candidate name
// const NAME_BLACKLIST = new Set([
//   "resume","cv","curriculum","vitae","profile","summary","objective","career",
//   "contact","address","email","phone","mobile","linkedin","github","portfolio",
//   "experience","education","skills","projects","certifications","references",
//   "professional","technical","personal","details","information","overview",
//   "fresher","candidate","applicant","dear","hiring","manager","sir","madam",
//   "updated","new","my","the","a","an",
// ]);
 
// const titleCaseLine = (line) =>
//   line.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
 
// const isBlacklistedName = (line) => {
//   const lower = line.toLowerCase().trim();
//   return NAME_BLACKLIST.has(lower) || NAME_BLACKLIST.has(lower.split(/\s+/)[0]);
// };
 
// // Strip contact-info tokens from a line so we can still find the name portion.
// // e.g. "Anchal Arora   Email: foo@bar.com   Mobile: 9999" => "Anchal Arora"
// const stripContactTokens = (line) =>
//   line
//     .replace(/\b(?:email|mobile|phone|tel|contact|linkedin|github|portfolio|www)\s*[:\-].*$/i, "")
//     .replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, "")
//     .replace(/https?:\/\/\S+/gi, "")
//     .replace(/(?:\+\d{1,3}[\s\-]?)?\d[\d\s\-\.]{8,}/g, "")
//     .replace(/\s{2,}/g, " ")
//     .trim();
 
// const isNameLike = (str) => {
//   if (!str || str.length < 3 || str.length > 60) return false;
//   if (isBlacklistedName(str)) return false;
//   const lower = str.toLowerCase();
//   if (CITY_NAMES.some((c) => lower === c) || STATE_NAMES.some((s) => lower === s)) return false;
//   return true;
// };
 
// const extractName = (text, sections) => {
//   const headerLines = sections.header || [];
//   const topLines = getLines(text).slice(0, 10);
//   const candidates = [...headerLines, ...topLines];
 
//   // Pass 1 — Explicit "Name:" label
//   for (const line of candidates) {
//     const m = line.match(/^(?:name|full\s+name|candidate\s+name)\s*[:\-]\s*(.+)/i);
//     if (m) {
//       const val = cleanLine(m[1]);
//       if (isNameLike(val)) return titleCaseLine(val);
//     }
//   }
 
//   // Pass 2 — Strip contact tokens first, then test proper-case pattern.
//   // Handles PDFs that render "Anchal Arora   Email: foo@bar.com" on one line.
//   for (const line of candidates) {
//     if (looksLikeJobTitle(line)) continue;
//     const stripped = cleanLine(stripContactTokens(line));
//     if (!isNameLike(stripped)) continue;
//     if (/^[A-Z][a-zA-Z'\-\.]{0,25}(?:\s+[A-Z][a-zA-Z'\-\.]{0,25}){1,3}$/.test(stripped)) {
//       return stripped;
//     }
//   }
 
//   // Pass 3 — All-caps name (e.g. "RAHUL SHARMA" or "ANCHAL ARORA")
//   for (const line of candidates) {
//     const stripped = cleanLine(stripContactTokens(line));
//     if (/^[A-Z]{2,}(?:\s+[A-Z]{2,}){1,3}$/.test(stripped) && stripped.length < 60) {
//       if (isNameLike(stripped)) return titleCaseLine(stripped);
//     }
//   }
 
//   // Pass 4 — Lenient: at least 2 capitalised words, only alpha chars
//   for (const line of candidates) {
//     if (looksLikeJobTitle(line)) continue;
//     const stripped = cleanLine(stripContactTokens(line));
//     if (!isNameLike(stripped)) continue;
//     const words = stripped.split(/\s+/);
//     if (
//       words.length >= 2 && words.length <= 4 &&
//       words.every((w) => /^[A-Za-z'\-\.]+$/.test(w)) &&
//       words.filter((w) => /^[A-Z]/.test(w)).length >= 2
//     ) {
//       return titleCaseLine(stripped);
//     }
//   }
 
//   return null;
// };
 
// // ─── Job Title Extraction ─────────────────────────────────────────────────────
 
// const extractJobTitlesFromText = (text) => {
//   const lowerText = text.toLowerCase();
//   const found = [];
//   for (const title of JOB_TITLES) {
//     const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
//     const regex = new RegExp(`(?<![a-z])${escaped}(?![a-z])`, "i");
//     if (regex.test(lowerText)) found.push(title);
//   }
//   return unique(found);
// };
 
// // ─── Header Title ─────────────────────────────────────────────────────────────
 
// const extractHeaderTitle = (sections) => {
//   for (const line of (sections.header || []).slice(0, 10)) {
//     if (isContactLine(line)) continue;
//     // Exact match against known titles first
//     if (looksLikeJobTitle(line) && line.length < 80) return line;
//   }
//   // Second pass: any short line after the name that isn't contact info
//   // (e.g. "HR Executive | 3 Years Exp" or "Business Development | Sales")
//   for (const line of (sections.header || []).slice(1, 8)) {
//     if (isContactLine(line)) continue;
//     if (line.length < 80 && line.match(/[A-Za-z]{3,}/) && !line.match(/^\d+/)) {
//       // Contains a pipe or dash separating roles — take first part
//       const firstPart = line.split(/[|•\-–—]|(?:\s{2,})/)[0].trim();
//       if (firstPart && firstPart.length > 3 && firstPart.length < 60) return firstPart;
//     }
//   }
//   return null;
// };
 
// // ─── Experience Entries ───────────────────────────────────────────────────────
 
// const extractExperienceEntries = (sections) => {
//   const expLines = sections.experience || [];
//   const entries = [];
//   const dateRe = new RegExp(DATE_RANGE_REGEX.source, "gi");
 
//   for (let i = 0; i < expLines.length; i++) {
//     const line = expLines[i];
//     dateRe.lastIndex = 0;
//     if (!dateRe.test(line)) continue;
 
//     const prev = cleanLine(expLines[i - 1] || "");
//     const prev2 = cleanLine(expLines[i - 2] || "");
//     const next = cleanLine(expLines[i + 1] || "");
 
//     const parts = line
//       .replace(new RegExp(DATE_RANGE_REGEX.source, "gi"), "")
//       .split(/[\|,\-–—]/)
//       .map(cleanLine)
//       .filter(Boolean);
 
//     const title =
//       parts.find(looksLikeJobTitle) ||
//       (looksLikeJobTitle(prev) ? prev : null) ||
//       (looksLikeJobTitle(prev2) ? prev2 : null) ||
//       (looksLikeJobTitle(next) ? next : null) ||
//       null;
 
//     const company =
//       parts.find((p) => looksLikeCompany(p) || looksLikeGenericCompany(p)) ||
//       (looksLikeCompany(prev) || looksLikeGenericCompany(prev) ? prev : null) ||
//       (looksLikeCompany(prev2) || looksLikeGenericCompany(prev2) ? prev2 : null) ||
//       (looksLikeCompany(next) || looksLikeGenericCompany(next) ? next : null) ||
//       null;
 
//     const isCurrent = /present|current|till\s*date|now/i.test(line);
//     if (title || company) entries.push({ title, company, isCurrentEmployer: isCurrent });
//   }
 
//   // Fallback: look for title+company pairs
//   if (!entries.length) {
//     for (let i = 0; i < expLines.length - 1; i++) {
//       const cur = expLines[i], nxt = expLines[i + 1];
//       if (looksLikeJobTitle(cur) && (looksLikeCompany(nxt) || looksLikeGenericCompany(nxt))) {
//         entries.push({ title: cur, company: nxt, isCurrentEmployer: i < 3 });
//       } else if ((looksLikeCompany(cur) || looksLikeGenericCompany(cur)) && looksLikeJobTitle(nxt)) {
//         entries.push({ title: nxt, company: cur, isCurrentEmployer: i < 3 });
//       }
//     }
//   }
 
//   return entries.filter((e) => e.title || e.company);
// };
 
// // ─── Summary ──────────────────────────────────────────────────────────────────
 
// const extractSummary = (text, sections) => {
//   if ((sections.summary || []).length) {
//     return sanitizeText((sections.summary || []).join(" "));
//   }
//   const firstParagraph = getLines(text)
//     .slice(0, 15)
//     .filter((line) => !isContactLine(line) && !looksLikeJobTitle(line))
//     .slice(1, 5)
//     .join(" ");
//   return sanitizeText(firstParagraph);
// };
 
// // ─── File Download & Text Extraction ─────────────────────────────────────────
 
// const downloadFile = async (fileUrl) => {
//   const response = await fetch(fileUrl);
//   if (!response.ok) throw new Error(`Failed to download resume: HTTP ${response.status}`);
//   const contentType = response.headers.get("content-type") || "";
//   const buffer = Buffer.from(await response.arrayBuffer());
//   return { buffer, contentType };
// };
 
// const extractText = async (buffer, contentType) => {
//   const isPdf =
//     contentType.includes("pdf") ||
//     (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46); // %PDF magic
 
//   // DOCX: ZIP magic bytes (PK) — also used for .docx
//   const isDocx =
//     contentType.includes("wordprocessingml") ||
//     contentType.includes("docx") ||
//     (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04);
 
//   // Legacy .doc: OLE2 Compound Document magic (D0 CF 11 E0)
//   const isLegacyDoc =
//     contentType.includes("msword") ||
//     contentType.includes("application/doc") ||
//     (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0);
 
//   if (isPdf) {
//     const r = await pdfParse(buffer);
//     return r?.text || "";
//   }
//   if (isDocx) {
//     const r = await mammoth.extractRawText({ buffer });
//     return r.value || "";
//   }
//   if (isLegacyDoc) {
//     // mammoth can sometimes handle legacy .doc — try it, fall back to raw text
//     try {
//       const r = await mammoth.extractRawText({ buffer });
//       if (r.value && r.value.trim().length > 30) return r.value;
//     } catch (_) { /* fall through */ }
//     // Last resort: extract printable ASCII strings (like `strings` command)
//     const raw = buffer.toString("binary");
//     const strings = raw.match(/[\x20-\x7e\r\n\t]{4,}/g) || [];
//     return strings.join("\n");
//   }
//   return buffer.toString("utf-8");
// };
 
// // ─── Build Payload ────────────────────────────────────────────────────────────
 
// const buildPayload = (rawText) => {
//   const sections = buildSections(rawText);
//   const name = extractName(rawText, sections);
//   const email = rawText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/)?.[0] || null;
 
//   // Phone: prefer 10-digit Indian numbers, then international formats
//   const phonePatterns = [
//     // Indian mobile with optional +91/0 prefix
//     /(?:\+91|0)?[\s\-]?(?:[6-9]\d{9})\b/,
//     // Generic international: +<cc> <number>
//     /\+\d{1,3}[\s\-.]?\(?\d{2,5}\)?[\s\-.]?\d{3,5}[\s\-.]?\d{4,6}/,
//     // 10-digit plain number
//     /\b[6-9]\d{9}\b/,
//     // Fallback: at least 10 digits in a row with separators
//     /\b\d[\d\s\-\.]{8,14}\d\b/,
//   ];
 
//   let phone = null;
//   for (const pattern of phonePatterns) {
//     const m = rawText.match(pattern);
//     if (m) {
//       const cleaned = m[0].replace(/[\s\-\.]/g, "").trim();
//       // Reject if it looks like a year range or very short
//       if (cleaned.replace(/\D/g, "").length >= 10) {
//         phone = m[0].trim();
//         break;
//       }
//     }
//   }
//   const location = extractLocation(rawText, sections);
//   const sectionSkills = extractSkillsFromSections(sections);
//   const dbSkills = extractSkillsFromDB(rawText);
//   const skills = unique([...sectionSkills, ...dbSkills]);
//   const education = extractEducation(rawText, sections);
//   const expEntries = extractExperienceEntries(sections);
//   const dbTitles = extractJobTitlesFromText(rawText);
//   const jobTitles = unique([
//     extractHeaderTitle(sections),
//     ...expEntries.map((e) => e.title).filter(Boolean),
//     ...dbTitles,
//   ]).filter(Boolean);
//   const companies = unique([
//     ...expEntries.map((e) => e.company).filter(Boolean),
//     ...(sections.experience || []).filter((l) => looksLikeCompany(l)),
//     // Also scan for lines that are clearly organisation names (proper nouns, 2-5 words, no verbs)
//     ...(sections.experience || []).filter((l) => {
//       if (!l || l.length > 80 || l.length < 4) return false;
//       if (isContactLine(l) || looksLikeJobTitle(l)) return false;
//       if (new RegExp(DATE_RANGE_REGEX.source, "gi").test(l)) return false;
//       const words = l.split(/\s+/).filter(Boolean);
//       return words.length >= 1 && words.length <= 6 &&
//         words.filter((w) => w.length > 1).every((w) => /^[A-Z]/.test(w));
//     }),
//   ]).slice(0, 5);
//   const experienceYears = extractExperienceYears(rawText, sections);
//   const summary = extractSummary(rawText, sections);
//   const currentEntry = expEntries.find((e) => e.isCurrentEmployer) || expEntries[0] || null;
 
//   return {
//     ResumeParserData: {
//       Name: { FullName: name, FormattedName: name },
//       Email: email ? [{ EmailAddress: email }] : [],
//       PhoneNumber: phone ? [{ FormattedNumber: phone, Number: phone, OriginalNumber: phone }] : [],
//       Address: location ? [{ City: location.City, State: location.State, Country: location.Country }] : [],
//       CurrentLocation: location ? [{ City: location.City, State: location.State, Country: location.Country }] : [],
//       CurrentEmployer: currentEntry?.company || companies[0] || null,
//       JobProfile: currentEntry?.title || jobTitles[0] || null,
//       WorkedPeriod: {
//         TotalExperienceInYear: experienceYears != null ? String(experienceYears) : null,
//         TotalExperienceInMonths: experienceYears != null ? String(Math.round(experienceYears * 12)) : null,
//       },
//       ExecutiveSummary: summary,
//       Summary: summary,
//       Objectives: null,
//       WorkAuthorization: null,
//       VisaStatus: null,
//       Skill: skills.map((s) => ({ Skill: s, FormattedName: s, Alias: s })),
//       SegregatedSkill: skills.map((s) => ({ FormattedName: s, Skill: s })),
//       SkillKeywords: skills.join(", "),
//       SegregatedExperience: (
//         expEntries.length
//           ? expEntries
//           : companies.map((c, i) => ({ title: jobTitles[i] || jobTitles[0] || null, company: c, isCurrentEmployer: i === 0 }))
//       ).map((e, i) => ({
//         IsCurrentEmployer: e.isCurrentEmployer ? "true" : "false",
//         JobProfile: {
//           FormattedName: e.title || jobTitles[i] || jobTitles[0] || null,
//           Title: e.title || jobTitles[i] || jobTitles[0] || null,
//           Alias: null,
//         },
//         Employer: {
//           EmployerName: e.company || companies[i] || null,
//           FormattedName: e.company || companies[i] || null,
//         },
//         Location: { City: location?.City || null, State: location?.State || null, Country: location?.Country || null },
//         StartDate: null,
//         EndDate: null,
//       })),
//       SegregatedQualification: education.map((d) => ({
//         Degree: { DegreeName: d, NormalizeDegree: d },
//         Institution: { Name: null },
//         StartDate: null,
//         EndDate: null,
//       })),
//       DetailResume: rawText,
//       ResumeCountry: { Country: location?.Country || "India" },
//       ApiInfo: { BuildVersion: "free-parser-2.0.0" },
//     },
//   };
// };
 
// // ─── Public Exports ───────────────────────────────────────────────────────────
 
// export const parseResumeWithRChilli = async (fileUrl) => {
//   const { buffer, contentType } = await downloadFile(fileUrl);
//   const rawText = await extractText(buffer, contentType);
//   if (!rawText || rawText.trim().length < 30) {
//     throw new Error("Could not extract readable text. File may be scanned or corrupted.");
//   }
//   return buildPayload(rawText);
// };
 
// // ─── Normalizer (unchanged interface) ────────────────────────────────────────
 
// const pickCurrentExperience = (experiences = []) => {
//   const arr = toArray(experiences);
//   return arr.find((e) => e?.IsCurrentEmployer === "true") || arr[0] || null;
// };
 
// const extractJobTitlesFromParsed = (parsed) => {
//   const titles = [];
//   const direct = sanitizeText(parsed?.JobProfile);
//   if (direct) titles.push(direct);
//   for (const exp of toArray(parsed?.SegregatedExperience)) {
//     const t = sanitizeText(exp?.JobProfile?.FormattedName) || sanitizeText(exp?.JobProfile?.Title) || sanitizeText(exp?.JobProfile?.Alias);
//     if (t) titles.push(t);
//   }
//   return unique(titles);
// };
 
// const extractCompaniesFromParsed = (parsed) => {
//   const companies = [];
//   const cur = sanitizeText(parsed?.CurrentEmployer);
//   if (cur) companies.push(cur);
//   for (const exp of toArray(parsed?.SegregatedExperience)) {
//     const c = sanitizeText(exp?.Employer?.EmployerName) || sanitizeText(exp?.Employer?.FormattedName);
//     if (c) companies.push(c);
//   }
//   return unique(companies);
// };
 
// const extractLocationsFromParsed = (parsed) => {
//   const locs = [];
//   const addLoc = (locObj) => {
//     // Prefer the pre-built "formatted" string if present (set by our own buildPayload)
//     if (locObj?.formatted) { locs.push(locObj.formatted); return; }
//     const l = buildLocation(locObj);
//     if (l) locs.push(l);
//   };
//   for (const a of toArray(parsed?.Address)) addLoc(a);
//   for (const a of toArray(parsed?.CurrentLocation)) addLoc(a);
//   for (const e of toArray(parsed?.SegregatedExperience)) {
//     const l = buildLocation(e?.Location);
//     // Only push experience locations if they contain a known city (not just "India")
//     if (l && l.toLowerCase() !== "india" && CITY_NAMES.some((c) => l.toLowerCase().includes(c))) {
//       locs.push(l);
//     }
//   }
//   const rc = sanitizeText(parsed?.ResumeCountry?.Country);
//   if (rc && rc.toLowerCase() !== "india") locs.push(rc);
//   // If nothing found yet, still try country
//   if (!locs.length && rc) locs.push(rc);
//   return unique(locs);
// };
 
// const extractEducationFromParsed = (parsed) => {
//   const edu = [];
//   for (const q of toArray(parsed?.SegregatedQualification)) {
//     const d = sanitizeText(q?.Degree?.DegreeName) || sanitizeText(q?.Degree?.NormalizeDegree) || sanitizeText(q?.Institution?.Name);
//     if (d) edu.push(d);
//   }
//   for (const e of toArray(parsed?.Education)) {
//     const d = sanitizeText(e?.Degree) || sanitizeText(e?.DegreeName) || sanitizeText(e?.Qualification);
//     if (d) edu.push(d);
//   }
//   if (!edu.length) { const q = sanitizeText(parsed?.Qualification); if (q) edu.push(q); }
//   return unique(edu);
// };
 
// const extractSkillsFromParsed = (parsed) => {
//   const skills = [];
//   for (const s of toArray(parsed?.Skill)) {
//     const sk = sanitizeText(s?.Skill) || sanitizeText(s?.FormattedName) || sanitizeText(s?.Alias);
//     if (sk) skills.push(sk);
//   }
//   for (const s of toArray(parsed?.SegregatedSkill)) {
//     const sk = sanitizeText(s?.FormattedName) || sanitizeText(s?.Skill);
//     if (sk) skills.push(sk);
//   }
//   skills.push(...splitSkillText(parsed?.SkillKeywords));
//   skills.push(...splitSkillText(parsed?.SkillBlock));
//   return unique(skills);
// };
 
// const extractExperienceYearsFromParsed = (parsed) => {
//   const wp = parsed?.WorkedPeriod || {};
//   const candidates = [
//     wp?.TotalExperienceInYear,
//     wp?.TotalExperienceInYears,
//     wp?.TotalExperienceInMonths ? Number(wp.TotalExperienceInMonths) / 12 : null,
//     parsed?.YearOfExperience?.Years,
//     parsed?.TotalExperienceInYears,
//     parsed?.ExperienceSummary?.TotalExperienceInYears,
//   ];
//   for (const v of candidates) {
//     if (v === null || v === undefined || v === "" || v === "null") continue;
//     const n = parseFloat(String(v));
//     if (Number.isFinite(n) && n > 0) return n;
//   }
//   return null;
// };
 
// const extractResumeText = (parsed) =>
//   sanitizeText(parsed?.DetailResume) ||
//   sanitizeText(parsed?.ResumeText) ||
//   sanitizeText(parsed?.Summary) ||
//   sanitizeText(parsed?.ExecutiveSummary) ||
//   null;
 
// export const normalizeRChilliResumeData = (payload) => {
//   const parsed = payload?.ResumeParserData || {};
//   const emailEntry = getFirstValue(parsed.Email);
//   const phoneEntry = getFirstValue(parsed.PhoneNumber);
//   const parsedSkills = extractSkillsFromParsed(parsed);
//   const parsedJobTitles = extractJobTitlesFromParsed(parsed);
//   const parsedLocations = extractLocationsFromParsed(parsed);
//   const parsedEducation = extractEducationFromParsed(parsed);
//   const parsedCompanies = extractCompaniesFromParsed(parsed);
//   const currentExperience = pickCurrentExperience(parsed?.SegregatedExperience);
 
//   const normalizedSkills = unique(parsedSkills.map(toSlug).filter(Boolean));
//   const normalizedJobTitles = unique(parsedJobTitles.map(toSlug).filter(Boolean));
//   const normalizedLocations = unique(parsedLocations.map(toSlug).filter(Boolean));
//   const normalizedEducation = unique(parsedEducation.map(toSlug).filter(Boolean));
 
//   const currentLocation = parsedLocations[0] || null;
//   const currentJobTitle =
//     sanitizeText(currentExperience?.JobProfile?.FormattedName) ||
//     sanitizeText(currentExperience?.JobProfile?.Title) ||
//     sanitizeText(parsed?.JobProfile) ||
//     parsedJobTitles[0] ||
//     null;
//   const currentCompany =
//     sanitizeText(currentExperience?.Employer?.EmployerName) ||
//     sanitizeText(parsed?.CurrentEmployer) ||
//     parsedCompanies[0] ||
//     null;
//   const highestEducation = parsedEducation[0] || null;
//   const totalExperienceRaw = extractExperienceYearsFromParsed(parsed);
//   // Always store as a proper number for Supabase numeric column
//   const totalExperience = totalExperienceRaw != null ? Number(totalExperienceRaw) : null;
//   const extractedText = extractResumeText(parsed);
 
//   // Last-resort name: derive from email address (e.g. "rahul.sharma@gmail.com" → "Rahul Sharma")
//   const deriveNameFromEmail = (email) => {
//     if (!email) return null;
//     const local = email.split("@")[0];
//     // Strip trailing digits (e.g. "rahul123" → "rahul")
//     const cleaned = local.replace(/[\d_\-\.]+$/, "");
//     // Split on dots/underscores/hyphens
//     const parts = cleaned.split(/[.\-_]+/).filter((p) => p.length > 1);
//     if (parts.length >= 2) {
//       return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
//     }
//     return null;
//   };
 
//   const rawName = sanitizeText(parsed?.Name?.FullName) || sanitizeText(parsed?.Name?.FormattedName) || null;
//   const resolvedEmail = sanitizeText(emailEntry?.EmailAddress);
//   const fullName = rawName || deriveNameFromEmail(resolvedEmail) || null;
 
//   return {
//     candidate: {
//       full_name: fullName,
//       email: resolvedEmail,
//       phone: sanitizeText(phoneEntry?.FormattedNumber) || sanitizeText(phoneEntry?.Number) || sanitizeText(phoneEntry?.OriginalNumber) || null,
//       location: currentLocation,
//       current_company: currentCompany,
//       current_job_title: currentJobTitle,
//       total_experience: totalExperience,
//       highest_education: highestEducation,
//       work_authorization: sanitizeText(parsed?.WorkAuthorization) || sanitizeText(parsed?.VisaStatus),
//       profile_summary: sanitizeText(parsed?.ExecutiveSummary) || sanitizeText(parsed?.Summary) || sanitizeText(parsed?.Objectives) || null,
//     },
//     parsedData: {
//       parser_name: "FreeParser",
//       parser_version: parsed?.ApiInfo?.BuildVersion || "free-parser-2.0.0",
//       raw_parser_response: payload,
//       extracted_text: extractedText,
//       parsed_job_titles: parsedJobTitles,
//       parsed_skills: parsedSkills,
//       parsed_locations: parsedLocations,
//       parsed_education: parsedEducation,
//       parsed_companies: parsedCompanies,
//       normalized_job_titles: normalizedJobTitles,
//       normalized_skills: normalizedSkills,
//       normalized_locations: normalizedLocations,
//       normalized_education: normalizedEducation,
//     },
//   };
// };


