import { cookies } from "next/headers";

export type Locale = "en" | "zh";

export const LANG_COOKIE = "zokki_lang";

/** Read the chosen locale from the cookie (server components). Defaults to en. */
export function getLocale(): Locale {
  return cookies().get(LANG_COOKIE)?.value === "zh" ? "zh" : "en";
}

export type FormLabels = {
  placeholder: string;
  button: string;
  reserving: string;
  successNew: string;
  successDup: string;
  errorInvalid: string;
  errorGeneric: string;
  errorNetwork: string;
  aria: string;
};

const en = {
  htmlLang: "en",
  nav: { reserve: "Reserve access" },
  hero: {
    eyebrow: "Hong Kong Racing · Happy Valley & Sha Tin",
    h1: "Read every race in ten seconds.",
    tagline: "快、清楚、誠實 — 每場賽事，一眼看懂。",
    sub: "Zokki turns the form, the draw, the odds and the jockeys into one clear read per race — a plain-English preview, a model-ranked shortlist, and an honest scorecard you can check. Information and entertainment only. We never tell you to bet.",
    note: "Beta access · HK$12 day pass · HK$48/mo unlimited · cancel anytime · no betting, ever.",
    social: (n: number) => `${n} racing fans already on the list`,
    proofs: ["Every pick on public record", "An AI analyst that shows its work", "Not a tipping service"],
    ctaPrimary: "Reserve beta access",
    ctaSecondary: "See the app",
    scrollCue: "Scroll",
  },
  form: {
    placeholder: "you@email.com",
    button: "Reserve beta access",
    reserving: "Reserving…",
    successNew: "You’re on the list — we’ll be in touch before launch.",
    successDup: "You’re already on the list. See you at the gates.",
    errorInvalid: "That email doesn’t look quite right.",
    errorGeneric: "Something went wrong — please try again.",
    errorNetwork: "Network hiccup — please try again.",
    aria: "Email address",
  } as FormLabels,
  problem: {
    eyebrow: "The problem",
    h: "You have minutes before the gates.",
    body: "Form lines, barrier draws, class changes, jockey and trainer records, shifting odds — the data is all there, and there is never enough time to read it. So most fans fall back on the favourite or whatever tip is loudest in the group chat. Zokki does the reading for you, and keeps an honest record of how it does.",
  },
  does: {
    eyebrow: "What Zokki does",
    h: "One clear read per race.",
    cards: [
      {
        title: "A read, not a tip",
        body: "Every race gets a confidence verdict and a two-to-three sentence preview of how it shapes up — the pick to beat, the danger, and how open it really is.",
      },
      {
        title: "What stands out",
        body: "Plain-English signals — in-form jockey, yard firing, a handy draw — instead of a wall of raw numbers. You see why a horse is ranked where it is.",
      },
      {
        title: "An honest scorecard",
        body: "Every pick we publish is on record — the wins and the misses, with the baselines beside them. We show our work, win or lose.",
      },
    ],
  },
  showcase: {
    eyebrow: "Inside the app",
    titleA: "One night at the races,",
    titleB: "four superpowers.",
    subtitle:
      "Zokki is a race-night companion, not a wall of numbers. Scroll through what it puts in your pocket.",
    stages: [
      {
        eyebrow: "Tonight’s picks",
        title: "The whole card, read for you.",
        desc: "Every race gets a model-ranked podium, win probabilities and a plain-English preview — the pick, the danger, and how open it really is.",
      },
      {
        eyebrow: "Zokki AI · Deep dive",
        title: "An analyst briefing on demand.",
        desc: "One tap and the AI analyst argues the race from our own numbers — the case for the pick, the value angle, and the honest caveat. Tuned to how you play.",
      },
      {
        eyebrow: "Ask Zokki",
        title: "Interrogate the model.",
        desc: "Ask anything about tonight’s card — safest race, value against the market, our recent form. It only answers from the live data, and it never tells you to bet.",
      },
      {
        eyebrow: "Track record",
        title: "Honesty is the feature.",
        desc: "Every published pick stays on the books — wins, misses, and the baselines beside them. Check our score before you trust a word we say.",
      },
    ],
  },
  receipts: {
    eyebrow: "The receipts",
    h: "We keep score in public.",
    body: (p: { races: number; range: string; topPick: number }) =>
      `Across ${p.races} live races (${p.range}), our single top-rated pick finished in the top three ${p.topPick}% of the time — double a random pick. On this sample the market favourite is still ahead of us, and we publish that comparison anyway. We don’t sell a secret edge. We make the smart read fast and clear, and we never hide a result.`,
    note: (p: { races: number }) =>
      `Same ${p.races} races for every line below. Live meetings only; scratched and abandoned races excluded.`,
    ours: "Our top pick",
    fav: "Backing the favourite",
    rand: "A random pick",
    cardNote: (p: { meetings: number }) =>
      `Top-three strike rate. ${p.meetings} live meetings and counting — the record grows with every Happy Valley and Sha Tin card.`,
  },
  pricing: {
    eyebrow: "Pricing",
    h: "Race night for the price of a coffee.",
    perMo: "/mo",
    perDay: "/race day",
    beta: "Beta",
    popular: "Most popular",
    free: {
      name: "Free",
      price: "HK$0",
      tagline: "Get a feel for the read, and check our record any time.",
      features: ["One featured race each meeting", "The full public scorecard", "Happy Valley & Sha Tin"],
    },
    dayPass: {
      name: "Day Pass",
      price: "HK$12",
      tagline: "One meeting, the whole card — buy it on race day, no subscription.",
      features: [
        "Every race on the night’s card",
        "Verdicts, previews & standout signals",
        "Full shortlist & race simulator",
        "Valid for the entire meeting",
      ],
    },
    starter: {
      name: "Starter",
      price: "HK$48",
      tagline: "The whole card, every meeting — the fast, clear race companion.",
      features: [
        "Every race, every meeting",
        "Verdicts, previews & standout signals",
        "Full shortlist & race simulator",
        "Complete track record",
      ],
    },
    pro: {
      name: "Pro",
      price: "Coming",
      tagline: "For serious handicappers who want everything under the hood.",
      features: [
        "Full model internals & factor view",
        "Calibration & value indicators",
        "Betting-return analysis",
        "Exportable history",
      ],
    },
    foot: "Day Pass covers one full meeting at Happy Valley or Sha Tin. Prices in HKD; final tiers confirmed at launch.",
  },
  cta: {
    eyebrow: "The gates are opening",
    h: "Be first through the gates.",
    body: (p: { price: string }) =>
      `Join the beta waitlist and we’ll bring you in before launch — race-day passes from ${p.price}, no subscription needed.`,
    points: ["Full card + AI analyst on race night", "Cancel anytime, no subscription needed", "Your record is our record — public, always"],
  },
  footer: {
    compliance:
      "Zokki is an information and entertainment product. It is not a betting service, does not accept, place or facilitate wagers, and is not affiliated with or endorsed by The Hong Kong Jockey Club. Predictions are not guarantees — racing outcomes are uncertain. 18+ only. If gambling stops being fun, call the Ping Wo Fund counselling line on 1834 633. Please play responsibly.",
    copy: (y: number) => `© ${y} Zokki. Hong Kong.`,
  },
  preview: {
    venue: "Happy Valley",
    date: "Wed 3 Jun",
    meta: "9 races · settled",
    verdict: "Confident",
    raceMeta: "R1 · 1650m · Class 5",
    narrative:
      "Family Fortune is our pick to beat — placed 2 of its last 6. Wah May Wai Wai looks the main danger.",
  },
};

export type Dict = typeof en;

const zh: Dict = {
  htmlLang: "zh-Hant",
  nav: { reserve: "立即預約" },
  hero: {
    eyebrow: "香港賽馬 · 跑馬地 ‧ 沙田",
    h1: "十秒，睇通每場賽事。",
    tagline: "Fast. Clear. Honest.",
    sub: "Zokki 把往績、檔位、賠率和騎練資料，整合成每場賽事的一個清晰解讀 —— 淺白的賽前分析、由模型排名的首選名單，以及一份你可以親自查證的誠實成績單。純粹資訊與娛樂用途，我們從不叫你投注。",
    note: "Beta 搶先體驗 · 即日通行證 HK$12 · 無限暢用每月 HK$48 · 隨時取消 · 絕不涉及投注。",
    social: (n: number) => `已有 ${n} 位馬迷登記預約`,
    proofs: ["每個首選公開記錄", "AI 分析員有數有據", "不是貼士服務"],
    ctaPrimary: "預約 Beta 體驗",
    ctaSecondary: "睇睇個 App",
    scrollCue: "向下滾動",
  },
  form: {
    placeholder: "你的電郵地址",
    button: "預約 Beta 體驗",
    reserving: "預約中…",
    successNew: "已成功登記 —— 我們會在推出前聯絡你。",
    successDup: "你已經登記了，開閘見！",
    errorInvalid: "這個電郵地址好像不正確。",
    errorGeneric: "出了點問題 —— 請再試一次。",
    errorNetwork: "網絡不穩 —— 請再試一次。",
    aria: "電郵地址",
  },
  problem: {
    eyebrow: "痛點",
    h: "開閘前，你只有幾分鐘。",
    body: "往績、檔位、班次升降、騎師與練馬師的狀態、賠率走勢 —— 資料一應俱全，卻永遠不夠時間細看。於是大多數馬迷只能跟熱門，或群組裡叫得最響的那個貼士。Zokki 替你把資料讀通，並誠實記錄每一次的表現。",
  },
  does: {
    eyebrow: "Zokki 為你做的",
    h: "每場賽事，一個清晰解讀。",
    cards: [
      {
        title: "是解讀，不是貼士",
        body: "每場賽事都附上信心評級，以及兩三句淺白的賽前分析 —— 哪匹是首選、哪匹是主要對手、賽事有多開放，一看就懂。",
      },
      {
        title: "亮點一覽",
        body: "以淺白訊號 —— 騎師狀態大勇、馬房當炒、檔位有利 —— 取代一堆原始數字，讓你明白每匹馬為何排在這個位置。",
      },
      {
        title: "誠實的成績單",
        body: "我們公開發佈過的每一個首選 —— 命中與失手都在，並附上對照基準。無論輸贏，都把功課攤出來。",
      },
    ],
  },
  showcase: {
    eyebrow: "App 內乾坤",
    titleA: "一晚賽事，",
    titleB: "四種超能力。",
    subtitle: "Zokki 是你的賽夜好拍檔，不是一堵數字牆。往下滾動，看看它放進你口袋的東西。",
    stages: [
      {
        eyebrow: "今晚首選",
        title: "全晚賽事，替你讀通。",
        desc: "每場賽事都有模型排名的三甲、勝出機率，以及淺白的賽前分析 —— 首選是誰、威脅在哪、賽事有多開放。",
      },
      {
        eyebrow: "Zokki AI · 深度分析",
        title: "隨傳隨到的分析員簡報。",
        desc: "一按之下，AI 分析員就用我們自己的數據拆解賽事 —— 首選的理據、價值所在，以及誠實的風險提示。更會按你的睇馬風格調整。",
      },
      {
        eyebrow: "問 Zokki",
        title: "向模型盤問到底。",
        desc: "今晚賽事任你問 —— 邊場最穩陣、同市場邊度有分歧、我們近況如何。它只依據實時數據回答，而且絕不叫你投注。",
      },
      {
        eyebrow: "往績記錄",
        title: "誠實，本身就是功能。",
        desc: "每個公開發佈的首選都記錄在案 —— 命中與失手，連同對照基準一併展示。信我們之前，先查我們的分數。",
      },
    ],
  },
  receipts: {
    eyebrow: "成績單",
    h: "公開計分，絕不隱藏。",
    body: (p: { races: number; range: string; topPick: number }) =>
      `在 ${p.races} 場真實賽事中（${p.range}），我們的單一首選有 ${p.topPick}% 落入前三名 —— 是亂猜的兩倍。在這個樣本裡，單純跟熱門暫時仍領先我們 —— 但我們照樣把這個對比公開。我們不賣甚麼獨家秘訣，只把聰明的解讀做到又快又清楚，而且從不隱瞞結果。`,
    note: (p: { races: number }) =>
      `以下每一行都用同一批 ${p.races} 場賽事計算。只計真實賽期；退出及取消的賽事不計在內。`,
    ours: "我們的首選",
    fav: "跟熱門",
    rand: "隨機亂選",
    cardNote: (p: { meetings: number }) =>
      `前三名命中率。${p.meetings} 個真實賽期，持續累積 —— 每個跑馬地與沙田賽期都會更新。`,
  },
  pricing: {
    eyebrow: "收費",
    h: "一杯咖啡的價錢，睇通成晚賽事。",
    perMo: "/月",
    perDay: "/賽日",
    beta: "Beta",
    popular: "最受歡迎",
    free: {
      name: "免費",
      price: "HK$0",
      tagline: "先感受解讀，隨時查看我們的成績。",
      features: ["每個賽期一場精選賽事", "完整公開成績單", "跑馬地與沙田"],
    },
    dayPass: {
      name: "即日通行證",
      price: "HK$12",
      tagline: "單一賽期、全晚賽事 —— 賽日即買即用，毋須訂閱。",
      features: ["當晚每一場賽事", "評級、賽前分析與亮點訊號", "完整首選名單與賽事模擬器", "全個賽期有效"],
    },
    starter: {
      name: "入門",
      price: "HK$48",
      tagline: "全場賽事、每個賽期 —— 又快又清的睇馬好夥伴。",
      features: ["每場賽事、每個賽期", "評級、賽前分析與亮點訊號", "完整首選名單與賽事模擬器", "完整往績記錄"],
    },
    pro: {
      name: "專業",
      price: "即將推出",
      tagline: "為認真鑽研的馬迷而設，盡覽引擎內裡乾坤。",
      features: ["完整模型內部與因子檢視", "校準與價值指標", "投注回報分析", "可匯出歷史記錄"],
    },
    foot: "即日通行證適用於跑馬地或沙田的單一賽期。價格以港幣計；最終級別於推出時確認。",
  },
  cta: {
    eyebrow: "閘門即將打開",
    h: "搶先入場。",
    body: (p: { price: string }) =>
      `加入 Beta 候補名單，我們會在推出前邀請你 —— 即日通行證 ${p.price} 起，毋須訂閱。`,
    points: ["賽夜全卡 + AI 分析員", "隨時取消，毋須訂閱", "我們的成績單永遠公開"],
  },
  footer: {
    compliance:
      "Zokki 是資訊與娛樂產品，並非投注服務，不接受、不代下注、亦不促成任何投注，與香港賽馬會並無任何聯繫或獲其認可。預測並非保證 —— 賽果存在不確定性。只限 18 歲或以上。如賭博已不再是娛樂，請致電平和基金輔導熱線 1834 633。請理性娛樂。",
    copy: (y: number) => `© ${y} Zokki ‧ 香港`,
  },
  preview: {
    venue: "跑馬地",
    date: "6月3日 週三",
    meta: "9 場 · 已賽完",
    verdict: "信心之選",
    raceMeta: "第1場 · 1650米 · 第5班",
    narrative: "Family Fortune 是我們的首選 —— 近 6 仗有 2 次入位。Wah May Wai Wai 為主要威脅。",
  },
};

export function getDict(locale: Locale): Dict {
  return locale === "zh" ? zh : en;
}
