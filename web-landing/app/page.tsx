import Wordmark from "@/components/Wordmark";
import WaitlistForm from "@/components/WaitlistForm";
import SiteHeader from "@/components/SiteHeader";
import Reveal from "@/components/Reveal";
import Hero from "@/components/Hero";
import Showcase from "@/components/Showcase";
import CompareBar from "@/components/CompareBar";
import MagneticButton from "@/components/MagneticButton";
import { signupCount } from "@/lib/waitlist";
import { getDict, getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// Live receipts. Sourced from the consumer Track Record (export_consumer.py
// headline) — refresh after each meeting.
// TODO: wire to the live performance feed instead of constants.
const PROOF = {
  topPick: 51,
  favourite: 61,
  random: 25,
  races: 67,
  meetings: 7,
  range: "13 May – 24 Jun 2026",
  rangeZh: "2026年5月13日至6月24日",
};

// Day Pass — the default offering quoted in CTAs.
const PRICE = "HK$12";

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

      {/* Hero — full-viewport, 3D floodlit oval behind the headline */}
      <Hero
        copy={{
          eyebrow: t.hero.eyebrow,
          h1: t.hero.h1,
          tagline: t.hero.tagline,
          sub: t.hero.sub,
          proofs: t.hero.proofs,
          ctaPrimary: t.hero.ctaPrimary,
          ctaSecondary: t.hero.ctaSecondary,
          note: t.hero.note,
          scrollCue: t.hero.scrollCue,
          social,
        }}
      />

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

      {/* The pinned showcase — the app's four superpowers, scrubbed by scroll */}
      <Showcase
        copy={t.showcase}
        proof={{ ours: PROOF.topPick, fav: PROOF.favourite, rand: PROOF.random }}
      />

      <div className="section-divider mx-auto mt-16 max-w-5xl sm:mt-20" />

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

      {/* Closing CTA — the conversion moment */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <Reveal>
          <div className="hero-grad relative overflow-hidden rounded-squircle px-6 py-14 text-center sm:px-10">
            {/* butter bloom accents */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(420px 260px at 18% 110%, rgba(107,195,75,0.10), transparent 65%), radial-gradient(520px 300px at 85% -10%, rgba(249,239,152,0.12), transparent 60%)",
              }}
            />
            <div className="relative">
              <Eyebrow tone="light">{t.cta.eyebrow}</Eyebrow>
              <h2 className="mx-auto mt-3 max-w-2xl text-[1.9rem] font-medium leading-tight text-mint sm:text-[2.6rem]">
                {t.cta.h}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-body text-mint/80">{t.cta.body({ price: PRICE })}</p>

              <div className="mx-auto mt-6 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2">
                {t.cta.points.map((p) => (
                  <span key={p} className="flex items-center gap-2 text-caption font-medium text-mint/75">
                    <Check />
                    {p}
                  </span>
                ))}
              </div>

              <div id="join" className="mx-auto mt-8 max-w-lg scroll-mt-28">
                <WaitlistForm labels={t.form} source="footer" note={t.hero.note} />
                {social && (
                  <p className="num mt-3 text-caption font-medium text-mint/70">
                    <span className="pulse-dot mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent-green align-middle" />
                    {social}
                  </p>
                )}
              </div>

              <div className="mt-8">
                <MagneticButton
                  href="#showcase"
                  strength={0.2}
                  className="tap rounded-pill border border-white/20 bg-white/5 px-6 py-3 text-caption font-semibold text-mint/85 backdrop-blur"
                >
                  ↑ {t.hero.ctaSecondary}
                </MagneticButton>
              </div>
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
