import Wordmark from "@/components/Wordmark";
import WaitlistForm from "@/components/WaitlistForm";
import AppPreview from "@/components/AppPreview";
import SiteHeader from "@/components/SiteHeader";
import Reveal from "@/components/Reveal";
import WordReveal from "@/components/WordReveal";
import TiltCard from "@/components/TiltCard";
import CompareBar from "@/components/CompareBar";
import { signupCount } from "@/lib/waitlist";
import { getDict, getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// Live receipts. Sourced from the consumer Track Record (export_consumer.py
// headline) — refresh after each meeting.
// TODO(post-Tuesday): wire to the live performance feed instead of constants.
const PROOF = {
  topPick: 63,
  favourite: 67,
  random: 26,
  races: 27,
  meetings: 3,
  range: "13 May – 3 Jun 2026",
  rangeZh: "2026年5月13日至6月3日",
};

// Day Pass — the default offering quoted in CTAs.
const PRICE = "HK$12";

// Feature-card icons (not localised) — paired by index with t.does.cards.
const FEATURE_ICONS = [
  "M4 5h16M4 12h10M4 19h7",
  "M12 3l2.2 5.6L20 9l-4.4 3.6L17 18l-5-3-5 3 1.4-5.4L4 9l5.8-.4z",
  "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
];

// ── Small presentational helpers ────────────────────────────────────
function Eyebrow({ children, tone = "dark" }: { children: React.ReactNode; tone?: "dark" | "light" }) {
  return (
    <div
      className={`text-micro font-semibold uppercase tracking-eyebrow ${
        tone === "light" ? "text-accent-yellow/80" : "text-accent-gold"
      }`}
    >
      {children}
    </div>
  );
}

function IconBadge({ path }: { path: string }) {
  return (
    <div className="grid h-11 w-11 place-items-center rounded-tile bg-white/10 text-accent-yellow">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="glass glass-lift h-full rounded-card p-5">
      <IconBadge path={icon} />
      <h3 className="mt-3.5 text-headline font-bold text-ink-50">{title}</h3>
      <p className="mt-1.5 text-callout leading-relaxed text-ink-60">{body}</p>
    </div>
  );
}

function Check({ onButter = false }: { onButter?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`mt-0.5 h-4 w-4 shrink-0 ${onButter ? "text-[#121212]" : "text-accent-green"}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/* `highlight` swaps the smoked glass for the signature butter panel — pale
   yellow surface, coal type — reserved for the default (Day Pass) plan. */
function PlanCard({
  name,
  price,
  cadence,
  tagline,
  features,
  highlight = false,
  badge,
}: {
  name: string;
  price: string;
  cadence?: string;
  tagline: string;
  features: readonly string[];
  highlight?: boolean;
  badge?: string;
}) {
  return (
    <div
      className={`glass-lift relative flex h-full flex-col rounded-card p-6 ${
        highlight ? "butter-panel" : "glass"
      }`}
    >
      {badge && (
        <span className="absolute -top-2.5 right-5 rounded-pill bg-[#121212] px-2.5 py-0.5 text-micro2 font-bold uppercase tracking-wide text-accent-yellow shadow-glass-2">
          {badge}
        </span>
      )}
      <div className={`text-caption font-semibold uppercase tracking-eyebrow ${highlight ? "text-[#121212]/60" : "text-ink-70"}`}>
        {name}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className={`num text-stat font-bold ${highlight ? "text-[#121212]" : "text-ink-50"}`}>{price}</span>
        {cadence && <span className={`text-callout ${highlight ? "text-[#121212]/65" : "text-ink-70"}`}>{cadence}</span>}
      </div>
      <p className={`mt-1.5 text-callout leading-relaxed ${highlight ? "text-[#121212]/80" : "text-ink-60"}`}>{tagline}</p>
      <ul className="mt-4 space-y-2.5">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <Check onButter={highlight} />
            <span className={`text-callout leading-snug ${highlight ? "text-[#121212]/90" : "text-ink-50"}`}>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────
export default async function LandingPage() {
  const locale = getLocale();
  const t = getDict(locale);
  const count = await signupCount();
  const social = count >= 25 ? t.hero.social(count) : null;

  return (
    <div className="relative z-10">
      {/* Top bar — sticky, frosts into glass on scroll */}
      <SiteHeader locale={locale} reserveLabel={t.nav.reserve} />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-2 sm:px-6">
        <div className="hero-grad overflow-hidden rounded-squircle px-6 py-10 sm:px-10 sm:py-12">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <Reveal>
                <Eyebrow tone="light">{t.hero.eyebrow}</Eyebrow>
              </Reveal>
              <h1 className="mt-3 text-[2.2rem] font-medium leading-[1.05] tracking-tight text-mint sm:text-[2.8rem] lg:text-[3.15rem]">
                <WordReveal text={t.hero.h1} />
              </h1>
              <Reveal delay={140}>
                <p className="mt-2 text-headline font-medium text-mint/70">{t.hero.tagline}</p>
              </Reveal>
              <Reveal delay={200}>
                <p className="mt-4 max-w-xl text-body leading-relaxed text-mint/80">{t.hero.sub}</p>
              </Reveal>

              <Reveal delay={280}>
                <div id="join" className="mt-7 max-w-lg scroll-mt-24">
                  <WaitlistForm labels={t.form} source="hero" note={t.hero.note} />
                  {social && (
                    <p className="num mt-3 text-caption font-medium text-mint/70">
                      <span className="pulse-dot mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent-green align-middle" />
                      {social}
                    </p>
                  )}
                </div>
              </Reveal>
            </div>

            <div className="lg:pl-4">
              <Reveal delay={180}>
                <TiltCard className="mx-auto w-fit">
                  <AppPreview t={t.preview} />
                </TiltCard>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="max-w-3xl">
          <Reveal>
            <Eyebrow>{t.problem.eyebrow}</Eyebrow>
            <h2 className="mt-3 text-title font-medium leading-tight text-ink-50 sm:text-display">{t.problem.h}</h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-4 text-body leading-relaxed text-ink-60">{t.problem.body}</p>
          </Reveal>
        </div>
      </section>

      <div className="section-divider mx-auto max-w-5xl" />

      {/* What Zokki does */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <Reveal>
          <Eyebrow>{t.does.eyebrow}</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-title font-medium leading-tight text-ink-50 sm:text-display">{t.does.h}</h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {t.does.cards.map((c, i) => (
            <Reveal key={c.title} delay={i * 90}>
              <FeatureCard icon={FEATURE_ICONS[i]} title={c.title} body={c.body} />
            </Reveal>
          ))}
        </div>
      </section>

      <div className="section-divider mx-auto max-w-5xl" />

      {/* Proof / receipts */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <Reveal>
              <Eyebrow>{t.receipts.eyebrow}</Eyebrow>
              <h2 className="mt-3 text-title font-medium leading-tight text-ink-50 sm:text-display">{t.receipts.h}</h2>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-4 text-body leading-relaxed text-ink-60">
                {t.receipts.body({
                  races: PROOF.races,
                  range: locale === "zh" ? PROOF.rangeZh : PROOF.range,
                  topPick: PROOF.topPick,
                })}
              </p>
              <p className="mt-3 text-caption text-ink-70">{t.receipts.note({ races: PROOF.races })}</p>
            </Reveal>
          </div>
          <Reveal delay={120}>
            <div className="glass rounded-card p-6">
              <div className="space-y-5">
                <CompareBar label={t.receipts.ours} value={PROOF.topPick} strong />
                <CompareBar label={t.receipts.fav} value={PROOF.favourite} />
                <CompareBar label={t.receipts.rand} value={PROOF.random} />
              </div>
              <p className="mt-5 text-caption leading-relaxed text-ink-70">
                {t.receipts.cardNote({ meetings: PROOF.meetings })}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="section-divider mx-auto max-w-5xl" />

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <Reveal>
          <Eyebrow>{t.pricing.eyebrow}</Eyebrow>
          <h2 className="mt-3 max-w-2xl text-title font-medium leading-tight text-ink-50 sm:text-display">{t.pricing.h}</h2>
        </Reveal>
        <div className="mt-8 grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal>
            <PlanCard
              name={t.pricing.free.name}
              price={t.pricing.free.price}
              tagline={t.pricing.free.tagline}
              features={t.pricing.free.features}
            />
          </Reveal>
          <Reveal delay={90}>
            <PlanCard
              name={t.pricing.dayPass.name}
              price={t.pricing.dayPass.price}
              cadence={t.pricing.perDay}
              tagline={t.pricing.dayPass.tagline}
              highlight
              badge={t.pricing.popular}
              features={t.pricing.dayPass.features}
            />
          </Reveal>
          <Reveal delay={180}>
            <PlanCard
              name={t.pricing.starter.name}
              price={t.pricing.starter.price}
              cadence={t.pricing.perMo}
              tagline={t.pricing.starter.tagline}
              badge={t.pricing.beta}
              features={t.pricing.starter.features}
            />
          </Reveal>
          <Reveal delay={270}>
            <PlanCard
              name={t.pricing.pro.name}
              price={t.pricing.pro.price}
              tagline={t.pricing.pro.tagline}
              features={t.pricing.pro.features}
            />
          </Reveal>
        </div>
        <Reveal delay={120}>
          <p className="mt-4 text-caption text-ink-70">{t.pricing.foot}</p>
        </Reveal>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal>
          <div className="hero-grad overflow-hidden rounded-squircle px-6 py-12 text-center sm:px-10">
            <h2 className="mx-auto max-w-2xl text-title font-medium leading-tight text-mint sm:text-display">{t.cta.h}</h2>
            <p className="mx-auto mt-3 max-w-xl text-body text-mint/80">{t.cta.body({ price: PRICE })}</p>
            <div className="mx-auto mt-7 max-w-lg">
              <WaitlistForm labels={t.form} source="footer" />
            </div>
          </div>
        </Reveal>
      </section>

      {/* Footer / compliance */}
      <footer className="mx-auto max-w-6xl px-6 pb-16">
        <div className="hairline border-t pt-6">
          <Wordmark tone="dark" />
          <p className="mt-3 max-w-3xl text-caption leading-relaxed text-ink-70">{t.footer.compliance}</p>
          <p className="mt-4 text-caption text-ink-70">{t.footer.copy(new Date().getFullYear())}</p>
        </div>
      </footer>
    </div>
  );
}
