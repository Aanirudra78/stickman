/**
 * Script understanding for the stickman explainer.
 *
 * One file, two consumers:
 *   - `studio/split.mjs` (local Studio + the GitHub Actions render)
 *   - anything else that wants the same guesses
 *
 * Given a narration line it answers three questions:
 *   who    -> a guest name that should appear on screen
 *   what   -> which action clip the character should perform
 *   with   -> which props should be visible
 *
 * The detection never returns "nothing": a scene always gets at least one
 * action, so the character is never frozen (3-level fallback).
 *
 * Everything here is plain data + regex. Keep it side-effect free.
 */

/* ------------------------------------------------------------------ utils --- */

/**
 * Word-ish matcher: works for Latin and Devanagari and never matches inside a
 * longer word (`bhaag` must not match `bhaagte`'s neighbour text, but the
 * pattern itself allows a stem with any trailing letters).
 */
const wordRe = (parts) =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${parts.join("|")})(?![\\p{L}\\p{N}])`, "iu");

/** Stem helper: `bhaag` also matches `bhaagta`, `bhaagkar`, `bhaago`... */
const stem = (base) => `${base}[\\p{L}]*`;

/* ----------------------------------------------------------------- actions --- */

/**
 * Priority order matters: the first rule that matches wins. Physical verbs are
 * listed before emotions so "gussa hoke paisa diya" reads as `give`, not
 * `angry`.
 */
const ACTION_RULES = [
  // ---- locomotion -------------------------------------------------------
  ["run", ["run", "running", "ran", "runs", "sprint", "racing", "race", stem("bhaag"), stem("daud"), "दौड़", "भाग"]],
  ["dash", ["dash", "turant", "foran", "fauran", "immediately", "instantly", "jhatpat", "jaldi", "fast", "speed", "तेज़", "तुरंत"]],
  ["walk", ["walk", "walking", "walked", "stroll", "paidal", "chalo", stem("chal"), "पैदल", "चल"]],
  ["jump", ["jump", "jumping", "jumped", "leap", stem("kood"), stem("uchhal"), "kud", "छलांग", "कूद", "उछल"]],
  ["hop", ["hop", "hopping", "bounce", "bouncing", "chhota jump"]],
  ["fall", ["fall", "falling", "fell", "drop", "dropped", "collapse", stem("gir"), "गिर"]],
  ["spin", ["spin", "spinning", "rotate", "turn around", stem("ghum"), "palat", "घूम"]],
  ["dance", ["dance", "dancing", "danced", stem("naach"), stem("nach"), "nritya", "नाच"]],
  ["crouch", ["crouch", "crouching", "bend down", stem("jhuk"), "झुक"]],
  ["sit", ["sit", "sitting", "sat", stem("baith"), "बैठ"]],
  ["stand", ["stand", "standing", "stood", "khada", "khade", "khadi", stem("uth"), "खड़ा"]],
  ["cross_arms", ["cross arms", "crossed arms", "arms crossed", "strict", "firm"]],
  ["hands_hips", ["hands on hips", "confident", "confidence", "boss", "authority", "control"]],
  ["lean_in", ["lean in", "leaning", "listen", "listening", "dhyan", "dhyaan", "suno", "sunna", "suni", "sunte", "sunke", "ध्यान", "सुन"]],
  ["shrug", ["shrug", "shrugging", "no idea", "pata nahi", "maybe", "idk", "not sure", "पता नहीं"]],

  // ---- hands / work -----------------------------------------------------
  ["give", ["give", "gave", "given", "hand over", "handed", "transfer", "donate", "de do", "diya", "deta", "dega", "दिया", "दे"]],
  ["take", ["take", "took", "taken", "receive", "collect", "grab", "loot", "liya", "lega", "लिया", "ले"]],
  ["throw", ["throw", "threw", "thrown", "toss", stem("phenk"), stem("fek"), "फेंक"]],
  ["catch", ["catch", "caught", stem("pakad"), "पकड़"]],
  ["open", ["open", "opened", stem("khol"), "unlock", "खोल"]],
  ["close", ["close", "closed", "band", "bandh", "shut", "lock", "बंद"]],
  ["push", ["push", "pushed", "dhakka", stem("dhakel"), "धक्का"]],
  ["pull", ["pull", "pulled", stem("kheench"), stem("khinch"), "खींच"]],
  ["fight", ["fight", "fighting", "fought", "ladai", "lada", "jhagda", "marpeet", "attack", "लड़ाई", "झगड़ा"]],
  ["write", ["write", "wrote", "writing", "note down", "sign", stem("likh"), "लिख"]],
  ["type", ["type", "typing", "laptop", "computer", "keyboard", "टाइप"]],
  ["count", ["count", "counting", "ginti", stem("gin"), "number", "numbers", "गिनती"]],
  ["build", ["build", "built", "building", "banao", stem("bana"), "construct", "create", "बना"]],
  ["search", ["search", "searching", stem("dhoond"), "dhundo", "find", stem("khoj"), "look for", "ढूंढ", "खोज"]],
  ["point_up", ["point up", "upar", "upward", "growth", "increase", stem("badh"), "high", "top", "start", "begin", "shuru", "result", "results", "ऊपर"]],
  ["point_aside", ["wahan", "udhar", "that side", "there", "side", "us taraf", "वहां", "उधर"]],
  ["wave", ["wave", "waving", "hello", "bye", "namaste", "welcome", "नमस्ते"]],

  // ---- money / business -------------------------------------------------
  ["pay", ["pay", "paid", "payment", "bill", "fees", "charge", "kharch", "kharcha", "bhugtan", "भुगतान", "खर्च"]],
  ["earn", ["earn", "earned", "earning", "kamai", stem("kamay"), "income", "salary", "revenue", "कमाई", "कमाया"]],
  ["save", ["save", "saved", "saving", "savings", "bachat", stem("bacha"), "deposit", "emergency fund", "बचत"]],
  ["invest", ["invest", "invested", "investing", "investment", "sip", "mutual fund", "stock", "share", "crypto", "compounding", "निवेश"]],
  ["lose", ["lose", "lost", "loss", "nuksan", "barbaad", "doob", "duba", "dubi", "नुकसान", "डूब"]],
  ["hold_money", ["money", "paisa", "paise", "rupee", "rupaye", "dollar", "cash", "note", "notes", "currency", "पैसा", "पैसे", "रुपये"]],

  // ---- daily life -------------------------------------------------------
  ["eat", ["eat", "eating", "ate", "khao", "khaya", "khana", "khane", "khata", "khate", "khati", "khai", "food", "lunch", "dinner", "breakfast", "खाना", "खा"]],
  ["drink", ["drink", "drinking", "drank", "pee", "piya", "pina", "chai", "coffee", "juice", "पीया", "पी"]],
  ["sleep", ["sleep", "sleeping", "slept", "soya", "sona", "raat", "night", "rest", "सोया", "सो"]],
  ["cook", ["cook", "cooking", "cooked", "pakao", "pakaya", "rasoi", "kitchen", "recipe", "पकाया"]],
  ["wash", ["wash", "washing", stem("dhul"), "dhona", "clean", "saaf", "धो"]],
  ["drive", ["drive", "driving", "drove", "car", "gaadi", "gadi", "bike", "scooter", "travel", "गाड़ी"]],

  // ---- emotion ----------------------------------------------------------
  ["shock", ["shock", "shocked", "omg", "unbelievable", "achanak", "surprise", "surprised", "kya hua", "kya baat", "सकते"]],
  ["happy", ["happy", "khush", "great", "awesome", "win", "won", "success", "jeet", "badhiya", "maza", "amazing", "good news", "खुश"]],
  ["sad", ["sad", "dukh", "unfortunately", "disappointed", "hurt", "nirash", "dukhi", "दुखी"]],
  ["cry", ["cry", "crying", "cried", "roya", "rona", "tears", "aansu", "रोया", "आंसू"]],
  ["laugh", ["laugh", "laughing", "lol", "funny", "hasi", "hasna", "hansa", "hans", "mazak", "joke", "हंसी"]],
  ["angry", ["angry", "gussa", "furious", "fraud", "scam", "cheat", "thagi", "dhokha", "गुस्सा", "धोखा", "ठगी"]],
  ["scared", ["scared", "afraid", "darr", "dar", "fear", "risk", "danger", "tension", "ghabra", "dara", "डर"]],
  ["confused", ["confused", "confusing", "samajh nahi", "doubt", "unclear", "puzzle", "uljhan", "उलझन"]],
  ["think", ["think", "thinking", "thought", "idea", stem("soch"), stem("samajh"), "plan", "lagta", "सोच"]],
  ["facepalm", ["facepalm", "mistake", "galti", "oops", "bhool", "stupid", "गलती"]],
  ["proud", ["proud", "kamaal", "shabash", "shabaash", "well done", "achievement", "garv", "गर्व"]],
  ["sigh", ["sigh", "tired", stem("thak"), "frustration", "uff", "bore", "boring", "hmm"]],

  // ---- interaction (only meaningful when a guest is on screen) ----------
  ["talk_to_guest", ["talk to", "baat kar", "bola", "said", "says", "kaha", "kehta", "कहा"]],
  ["listen", ["sunna", "suno", "sun raha", "सुनो"]],
  ["nod", ["nod", "nodded", "haan", "yes", "bilkul", "sahi", "agree", "हां"]],
  ["explain_to_guest", ["explain", "samjhao", "samjhaya", "bataya", "batata", "बताया"]],
].map(([id, parts]) => ({ id, re: wordRe(parts) }));

export const ACTION_IDS = ACTION_RULES.map((rule) => rule.id);

const ACTION_BY_ID = new Map(ACTION_RULES.map((rule) => [rule.id, rule]));

/** Actions that keep looping for the rest of the scene (don't auto-interrupt). */
export const LOOP_ACTIONS = new Set([
  "run", "walk", "dash", "spin", "sleep", "type", "write", "search",
  "cook", "wash", "drive", "laugh", "cry", "scared", "talk_to_guest", "listen",
  "hold_money", "hold", "count", "wave", "dance", "fight", "explain_to_guest",
  "nod",
]);

/** Actions that imply money is involved, even without the word "paisa". */
const MONEY_ACTIONS = new Set([
  "hold_money", "pay", "earn", "save", "invest", "lose",
]);

/** Interaction clips fall back to a solo gesture when nobody is on screen. */
const GUEST_ACTION_FALLBACK = {
  talk_to_guest: "point_aside",
  listen: "lean_in",
  nod: "hands_hips",
  explain_to_guest: "point_aside",
};

/* ------------------------------------------------------------------- props --- */

/**
 * Ordered by "how much does seeing this help the viewer". The first two
 * distinct matches are shown.
 */
const PROP_RULES = [
  ["money", ["money", "paisa", "paise", "rupee", "rupaye", "dollar", "cash", "currency", "salary", "kamai", "income", "lakh", "crore", "पैसा", "पैसे", "रुपये", "₹"]],
  ["coin", ["coin", "coins", "sikka", "sikke", "change", "chutta"]],
  ["wallet", ["wallet", "purse", "batua"]],
  ["phone", ["phone", "mobile", "smartphone", "whatsapp", "instagram", "recharge", "फोन", "मोबाइल"]],
  ["laptop", ["laptop", "computer", "desktop", "keyboard", "screen"]],
  ["chart_up", ["profit", "growth", "grow", "increase", "double", "returns", "compounding", "बढ़"]],
  ["chart_down", ["loss", "decline", "crash", "nuksan", "गिरावट"]],
  ["clock", ["minute", "minutes", "hour", "hours", "second", "seconds", "ghanta", "time", "din", "day", "days", "week", "month", "saal", "year", "मिनट", "घंटा", "समय"]],
  ["calendar", ["date", "calendar", "deadline", "tarikh", "mahina", "mahine"]],
  ["house", ["house", "home", "ghar", "property", "flat", "rent", "makan", "घर"]],
  ["car", ["car", "gaadi", "gadi", "bike", "scooter", "vehicle", "गाड़ी"]],
  ["lock", ["lock", "password", "private", "pin", "locked", "ताला"]],
  ["shield", ["safe", "secure", "protection", "insurance", "shield", "safety"]],
  ["warning", ["warning", "danger", "risk", "alert", "careful", "savdhan", "खतरा"]],
  ["question", ["why", "how", "what", "kya", "kaise", "kyu", "kyun", "question", "doubt", "sawal"]],
  ["bulb", ["idea", "solution", "trick", "smart", "brain"]],
  ["arrow", ["next", "towards", "taraf", "direction", "aage", "forward", "arrow"]],
  ["check", ["done", "success", "correct", "approved", "ready", "pass", "ho gaya"]],
  ["cross", ["wrong", "fail", "cancel", "stop", "never", "गलत"]],
  ["magnifier", ["search", "find", "dhoond", "khoj", "investigate"]],
  ["hammer", ["build", "create", "banao", "banaya", "construct", "fix"]],
  ["food", ["food", "khana", "eat", "lunch", "dinner", "breakfast", "recipe", "खाना"]],
].map(([id, parts]) => ({ id, re: wordRe(parts) }));

export const PROP_IDS = PROP_RULES.map((rule) => rule.id);

/* ------------------------------------------------------------------ guests --- */

/** Capitalised words that are never a person's name. */
const NAME_STOPWORDS = new Set(
  (
    "the this that these those a an and but or so if then when while after before because since as at in on of for to from with without by it its he she they we you i me him her them us my your his our their is are was were be been being not no yes do does did can could will would should must may might have has had there here what why how who which whose money paisa paise rupee rupaye india indian hindi english january february march april june july august september october november december monday tuesday wednesday thursday friday saturday sunday one two three four five six seven eight nine ten first second third last next now today tomorrow yesterday once also even only just very more most some any every all both each other another same new old good bad big small great real true false best worst scam fraud fund stock share market bank credit debit loan emi sip gst upi atm app video script scene example friend dost log people person aadmi ladka ladki bhai didi uncle aunty sir madam doctor teacher police government sarkar company business job salary note phone mobile laptop car gaadi ghar house home time minute hour day week month year life cash gold sona chai coffee food khana water lekin phir aur sab wo woh yeh ye hum tum aap koi kuch har ab tab jab kyunki isliye waise matlab bas bhi sirf pura poora saara sara dusra doosra naya purana aaj kal parso abhi pehle baad beech andar bahar upar neeche jaisa waisa itna utna kitna sach galat sahi raha rahi rahe karta karte karti hai hain tha theek bahut zyada kam agar toh fir warna jaise tabhi kaha kehta kehti kehte bola boli bole bataya batata batati samjhao samjhaya suno suna lagta lagti lage hua hui hue kiya kiye karo kar diya liya gaya gayi aaya aayi aaye jaata jaati jaate hota hoti hote pati patni doston key points point heading summary conclusion intro ending end start scene title chapter part lesson lessons tip tips note notes today tonight morning evening afternoon week weekend money-minded however finally during each many secret story point step way thing things part line case plan problem solution reason answer question idea rule number percent tax saving savings investment return risk growth startup office boss team client customer product service price cost value profit loss court law scheme policy news social media online offline website channel subscribe like share comment reel short episode bharat desh"
  ).split(/\s+/),
);

const HINDI_POST = "ne|ka|ki|ke|ko|se|se hi|ne bhi";

/** Lowercase token + Hindi postposition is a strong "this is a person" signal. */
const postpositionRe = new RegExp(
  `(?<![\\p{L}\\p{N}])([\\p{L}]{3,})\\s+(?:${HINDI_POST})(?![\\p{L}\\p{N}])`,
  "giu",
);

const explicitNameRe =
  /(?<![\p{L}\p{N}])(?:naam|name|named|called)\s+(?:hai\s+|tha\s+|is\s+)?([\p{L}]{3,})/giu;

const capitalisedRe = /(?<![\p{L}\p{N}])([\p{Lu}][\p{L}]{2,})(?:\s+([\p{Lu}][\p{L}]{2,}))?/gu;

const listOf = (value) => (Array.isArray(value) ? value : value ? [value] : []);

const titleCase = (word) =>
  word.length === 0 ? word : word[0].toUpperCase() + word.slice(1);

const isCommonWord = (word, capitalized = false) => {
  const lower = word.toLowerCase();
  if (NAME_STOPWORDS.has(lower)) return true;
  if (ACTION_BY_ID.has(lower)) return true;
  if (PROP_RULES.some((rule) => rule.id === lower)) return true;
  // Verb-ish endings only disqualify lowercase tokens: "Sita", "Kavita" are
  // names, "banata" / "karta" are narration.
  if (capitalized) return false;
  return /(?:ta|te|ti|kar|na|ne|hai|hua|kiya|gaya|gayi|diya|liya|raha|rahi)$/i.test(
    lower,
  );
};

/**
 * Finds the people named in a line. Deliberately conservative: capitalised
 * tokens are only accepted when they are not common words, and lowercase
 * tokens only with a Hindi postposition (e.g. "rahul ne").
 *
 * `options.known` is the set of names the whole script already agreed on, so a
 * name that opens a sentence ("Rahul ghabra kar roya") still counts while a
 * random sentence-opening noun ("Mehnat karo") does not.
 *
 * `options.strongOnly` skips sentence-opening capitalised words entirely; it is
 * used for the first pass that builds `known`.
 */
export const detectGuestNames = (text, options = {}) => {
  const source = String(text ?? "");
  const exclude = new Set(
    listOf(options.exclude)
      .flatMap((value) => String(value).toLowerCase().split(/\s+/))
      .filter(Boolean),
  );
  const known = new Set(
    listOf(options.known)
      .map((value) => String(value).toLowerCase())
      .filter(Boolean),
  );
  const strongOnly = Boolean(options.strongOnly);
  const scores = new Map();

  const bump = (word, weight, capitalized = false) => {
    const clean = String(word ?? "").replace(/[^\p{L}\p{N}]/gu, "");
    if (clean.length < 3) return;
    if (exclude.has(clean.toLowerCase())) return;
    if (isCommonWord(clean, capitalized)) return;
    const key = clean.toLowerCase();
    const entry = scores.get(key) ?? { word: titleCase(clean), score: 0 };
    entry.score += weight;
    entry.word = entry.word || titleCase(clean);
    scores.set(key, entry);
  };

  for (const match of source.matchAll(explicitNameRe)) bump(match[1], 4, true);

  for (const match of source.matchAll(postpositionRe)) {
    const word = match[1];
    if (word.toLowerCase() === "us" || word.toLowerCase() === "is") continue;
    bump(word, 3, /^\p{Lu}/u.test(word));
  }

  for (const match of source.matchAll(capitalisedRe)) {
    const words = [match[1], match[2]].filter(Boolean);
    for (const word of words) {
      const index = source.indexOf(word, match.index ?? 0);
      const before = source.slice(0, index).trimEnd();
      // A word that starts a sentence is capitalised by grammar, not because
      // it is a name - accept it only if the rest of the script already used
      // it as a name.
      const opensSentence = before.length === 0 || /[.!?\n]$/.test(before);
      if (opensSentence && (strongOnly || !known.has(word.toLowerCase()))) {
        continue;
      }
      bump(word, 2, true);
    }
  }

  return [...scores.values()]
    .filter((entry) => entry.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((entry) => entry.word);
};

/** Picks how a guest should arrive, from the tone of the line. */
const entranceFor = (text) => {
  if (/[!]{1,}/.test(text)) return "jump";
  if (/\b(magic|magically|achanak|suddenly|shock|surprise|unbelievable)\b/i.test(text)) {
    return "magic";
  }
  return "walk";
};

/** Seconds into the line when the name is actually spoken. */
const guestTiming = (text, name) => {
  const needle = String(name ?? "").toLowerCase();
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const clean = words[i].replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
    if (clean === needle) {
      return Math.round(Math.min(2.6, Math.max(0.2, i / WPS)) * 10) / 10;
    }
  }
  return 0.25;
};

/* ---------------------------------------------------------------- fallbacks --- */

const POSITIVE_RE =
  /\b(good|great|best|win|won|profit|success|easy|simple|happy|khush|badhiya|maza|amazing|jeet|kamaal)\b/i;
const NEGATIVE_RE =
  /\b(bad|worst|loss|lost|scam|fraud|problem|difficult|hard|sad|dukh|galti|risk|danger|nuksan|barbaad)\b/i;

/**
 * Level 2/3: when no verb matched, infer something from the shape of the line
 * so a scene is never static.
 */
const fallbackAction = (text, props) => {
  if (/\?/.test(text) || /\b(kya|kaise|kyu|kyun|why|how|what)\b/i.test(text)) {
    return "think";
  }
  if (/[!]{1,}/.test(text)) {
    return NEGATIVE_RE.test(text) ? "shock" : "happy";
  }
  if (/(\d|%|₹|\$)/.test(text)) return "count";
  if (props.length > 0) return "hold";
  if (POSITIVE_RE.test(text)) return "happy";
  if (NEGATIVE_RE.test(text)) return "sad";
  return "point_aside";
};

/* ------------------------------------------------------------------ public --- */

/** All matching action ids, highest priority first. */
export const detectActionIds = (text) => {
  const source = String(text ?? "");
  return ACTION_RULES.filter((rule) => rule.re.test(source)).map((rule) => rule.id);
};

/** First matching action, or null. */
export const detectAction = (text) => detectActionIds(text)[0] ?? null;

/** Distinct props mentioned in the line, best two. */
export const detectProps = (text) => {
  const source = String(text ?? "");
  const ids = PROP_RULES.filter((rule) => rule.re.test(source)).map((rule) => rule.id);
  return [...new Set(ids)].slice(0, 2);
};

/** Word index of the first rule hit, so an action lands on the spoken word. */
const firstHitWordIndex = (words, rule) => {
  for (let i = 0; i < words.length; i++) {
    if (rule.re.test(words[i])) return i;
  }
  return -1;
};

const WPS = 2.6;

/**
 * Full analysis of one narration line.
 *
 * Returns `{ actions, props, guest }` where `actions` is already scheduled in
 * seconds from the start of the scene.
 */
export const detectLine = (text, options = {}) => {
  const source = String(text ?? "");
  const words = source.split(/\s+/).filter(Boolean);
  const props = options.props ?? detectProps(source);
  const guestNames = options.guest ? [] : detectGuestNames(source, options);
  const hasGuest = Boolean(options.guest) || guestNames.length > 0;

  const matched = detectActionIds(source).filter(
    (id) => hasGuest || !GUEST_ACTION_FALLBACK[id],
  );
  const ids = matched.map((id) => (hasGuest ? id : GUEST_ACTION_FALLBACK[id] ?? id));

  let id = ids[0];
  if (!id) {
    if (options.guest) id = "explain_to_guest";
    else id = fallbackAction(source, props);
  }
  if (!hasGuest && GUEST_ACTION_FALLBACK[id]) id = GUEST_ACTION_FALLBACK[id];

  // Beat the action to the word that triggered it (approx. from the WPS rate).
  const rule = ACTION_BY_ID.get(id);
  const hitIndex = rule ? firstHitWordIndex(words, rule) : -1;
  const at = hitIndex >= 0 ? Math.min(2.4, hitIndex / WPS) : 0;

  // Money props are inferred from the action and from amount patterns, so
  // "50,000 kamaye" shows notes even though it never says "paisa".
  const finalProps = props.slice(0, 2);
  const moneyMentioned =
    MONEY_ACTIONS.has(id) ||
    /(?:₹|rs\.?|rupees?)\s*\d|\b\d[\d,]*\s*(?:rupees?|rs|lakh|lac|crore|k)\b/i.test(source);
  if (moneyMentioned && !finalProps.includes("money")) {
    if (finalProps.length < 2) finalProps.unshift("money");
    else finalProps[1] = "money";
  }

  return {
    actions: [{ at: Math.round(at * 10) / 10, id }],
    alternate: ids[1] ?? null,
    props: [...new Set(finalProps)],
    guest: guestNames.length > 0
      ? {
          name: guestNames[0],
          at: guestTiming(source, guestNames[0]),
          enter: entranceFor(source),
        }
      : null,
  };
};

/**
 * Auto beats: a long scene with one short gesture gets a second, safe gesture
 * halfway through, so nothing feels frozen.
 */
const AUTO_BEATS = ["count", "point_aside", "hands_hips", "shrug", "point_up", "wave"];
const BUSY_ACTIONS = new Set([
  "run", "walk", "dash", "spin", "jump", "hop", "fall", "crouch", "sleep",
  "cook", "wash", "drive", "search", "type", "write", "laugh", "cry",
  "scared", "talk_to_guest", "listen", "hold_money", "hold", "build",
]);

/**
 * Writes `actions`, `props` and `guest` onto every scene (in place).
 *
 * `scenes` is the array produced by `splitScript`, so each scene has
 * `voiceover`, `items`, `duration` and `scene_type`.
 */
export const applyDetection = (scenes, options = {}) => {
  const { title } = options;
  let previousAction = null;

  // First pass: names the script is unambiguous about (postposition, "naam X",
  // or capitalised mid-sentence). A sentence-opening word only counts later
  // when it is one of these.
  const knownNames = new Set();
  scenes.forEach((scene) => {
    const texts = [
      scene.voiceover,
      scene.text,
      ...(Array.isArray(scene.items) ? scene.items : []),
    ];
    texts.forEach((value) => {
      detectGuestNames(value, { exclude: [title], strongOnly: true }).forEach(
        (name) => knownNames.add(name.toLowerCase()),
      );
    });
  });

  scenes.forEach((scene, index) => {
    const text = String(scene.voiceover ?? scene.text ?? "");
    const isTitle = index === 0 && title && scene.text === title;

    if (isTitle) {
      scene.actions = Array.isArray(scene.actions) ? scene.actions : [];
      scene.props = Array.isArray(scene.props) ? scene.props : [];
      return;
    }

    const props = Array.isArray(scene.props) && scene.props.length > 0
      ? scene.props
      : detectProps(text);

    const guest = scene.guest ?? detectGuestNames(text, {
      exclude: [title],
      known: [...knownNames],
    })
      .slice(0, 1)
      .map((name) => ({
        name,
        at: guestTiming(text, name),
        enter: entranceFor(text),
      }))[0] ?? null;

    if (!Array.isArray(scene.actions) || scene.actions.length === 0) {
      if (scene.scene_type === "points" && Array.isArray(scene.items) && scene.items.length > 0) {
        // One action per bullet, placed at the estimated spoken time of the
        // bullet. The renderer stretches scenes to the real narration, so this
        // is a good approximation that lands within a word or two.
        const actions = [];
        let spokenWords = String(scene.text ?? "").split(/\s+/).filter(Boolean).length;
        scene.items.forEach((item) => {
          const line = detectLine(item, { props: [], guest });
          actions.push({
            at: Math.round(Math.min(scene.duration - 0.4, spokenWords / WPS) * 10) / 10,
            id: line.actions[0].id,
          });
          spokenWords += String(item).split(/\s+/).filter(Boolean).length + 1;
        });
        scene.actions = actions;
      } else {
        const line = detectLine(text, { props, guest });
        let id = line.actions[0].id;

        // Avoid the exact same gesture two scenes in a row.
        if (id === previousAction && line.alternate) id = line.alternate;
        if (id === previousAction && props.length > 0) id = "hold";
        if (id === previousAction) id = "point_aside";

        const actions = [{ at: line.actions[0].at, id }];
        const clipSeconds = scene.duration ?? 0;

        // Two verbs in one line ("earn... then invest") deserve two beats.
        const alternate = line.alternate;
        if (alternate && alternate !== id && clipSeconds >= 3.4) {
          const alternateId = guest
            ? alternate
            : GUEST_ACTION_FALLBACK[alternate] ?? alternate;
          if (alternateId !== id) {
            actions.push({
              at:
                Math.round(
                  Math.max(line.actions[0].at + 1.1, clipSeconds * 0.56) * 10,
                ) / 10,
              id: alternateId,
            });
          }
        }

        const isBusy = BUSY_ACTIONS.has(id);
        if (!isBusy && clipSeconds >= 5.5 && actions.length === 1) {
          const beat = AUTO_BEATS[index % AUTO_BEATS.length];
          actions.push({
            at: Math.round(clipSeconds * 0.58 * 10) / 10,
            id: beat,
          });
        }
        scene.actions = actions;
      }
    }

    scene.props = props;
    if (guest) scene.guest = guest;
    previousAction = scene.actions[scene.actions.length - 1]?.id ?? previousAction;
  });

  return scenes;
};

export { entranceFor, GUEST_ACTION_FALLBACK, WPS };
