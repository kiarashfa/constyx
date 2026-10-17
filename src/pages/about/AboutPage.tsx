import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Panel } from '../../components/Panel';
import { SITE } from '../../site/config';
import { SECTIONS } from '../../site/routes';
import { CoffeeMark, PayPalMark } from './marks';

const CONTACT = [
  { label: 'Personal site', href: 'https://kiarashfa.github.io/website/', note: 'kiarashfa.github.io' },
  { label: 'Email', href: 'mailto:kiarashfa@gmail.com', note: 'kiarashfa@gmail.com' },
  { label: 'GitHub', href: 'https://github.com/kiarashfa', note: 'github.com/kiarashfa' },
];

const SUPPORT = [
  {
    label: 'Donate · PayPal',
    href: 'https://www.paypal.com/donate/?hosted_button_id=S3BD5XFBMMWSJ',
    Mark: PayPalMark,
  },
  { label: 'Buy Me a Coffee', href: 'https://www.buymeacoffee.com/kiarashfa', Mark: CoffeeMark },
];

const prose = 'space-y-3 text-sm leading-relaxed text-phosphor/75';
const inlineLink = 'text-phosphor underline decoration-phosphor/40 underline-offset-2 hover:text-phosphor-bright';

function External({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener" className={inlineLink}>
      {children}
    </a>
  );
}

/** What the console is, who runs it, what it keeps, and how to support it. */
export function AboutPage() {
  return (
    <>
      <header className="mb-6">
        <p className="text-xs tracking-widest text-phosphor-dim">/// SYSTEM :: WHOAMI</p>
        <h1 className="glow mt-1 text-2xl tracking-[0.35em] sm:text-3xl">ABOUT</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-phosphor/70">
          {SITE.name} (Construct + Styx) is named for the river that marks the boundary
          between worlds: the crossing point between reality and the Construct. A focus
          terminal disguised as a digital rain cascade.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <Panel title="WHAT THIS IS">
            <div className={prose}>
              <p>
                {SITE.name} is an unofficial fan tribute to <em>The Matrix</em> trilogy: your
                browser, reimagined as the operator station of a hovercraft. Every section is a
                program registered to that console:{' '}
                {SECTIONS.map((section, i) => (
                  <span key={section.path}>
                    <Link to={section.path} className={inlineLink}>
                      {section.title}
                    </Link>
                    {i < SECTIONS.length - 2 ? ', ' : i === SECTIONS.length - 2 ? ', and ' : '.'}
                  </span>
                ))}
              </p>
              <p>
                The places are recreated from the films as faithfully as practical (staging,
                light, sound, and the late-90s analog look) rather than reinvented. New
                programs and scene refinements land over time.
              </p>
              <p>
                It is free, with no accounts, no memberships, no ads, and nothing to buy. The
                whole ship runs as static files in your browser.
              </p>
            </div>
          </Panel>

          <Panel title="DATA & PRIVACY">
            <div className={prose}>
              <p>
                <span className="text-phosphor">Your progress stays on this device.</span>{' '}
                Operator career stats, Construct download records, and whether you have seen
                the Armory load in are kept in your browser&apos;s localStorage. None of it is
                sent anywhere; clearing this site&apos;s data wipes it.
              </p>
              <p>
                <span className="text-phosphor">Visitor statistics.</span> The site uses
                Google Analytics to count visits: which pages are opened, roughly from where,
                and on what kind of device. Google sets its own cookies to do this. It does not
                receive your scores, your lessons, or anything you type. Blocking it in your
                browser breaks nothing here.
              </p>
              <p>
                <span className="text-phosphor">Your camera.</span> Code Vision processes the
                feed entirely on your device, in the browser&apos;s graphics pipeline. Nothing
                is uploaded, recorded, or stored, and the camera is released when you close
                the feed or leave the page.
              </p>
              <p>
                <span className="text-phosphor">Embedded video.</span> The television in the
                White Room plays a YouTube video (privacy-enhanced mode), only once you switch
                it on.
              </p>
            </div>
          </Panel>

          <Panel title="SOURCE & CREDITS">
            <div className={prose}>
              <p>
                The source code is public on <External href={SITE.repoUrl}>GitHub</External>,
                published under the KFA Source-Available License 1.0, and you are welcome to
                read and study how any of it works. See the{' '}
                <External href={`${SITE.repoUrl}/blob/main/LICENSE`}>license</External> for
                exactly what it permits.
              </p>
              <p>
                Real-world textures come from Poly Haven (CC0). Every third-party asset and
                technique is credited in{' '}
                <External href={`${SITE.repoUrl}/blob/main/ATTRIBUTION.md`}>ATTRIBUTION.md</External>.
              </p>
              <p className="text-phosphor/55">
                <em>The Matrix</em> and all related characters, names, and imagery are ©
                Warner Bros. Entertainment Inc.; the films were created by the Wachowskis.
                {` ${SITE.name}`} is non-commercial and is not affiliated with, sponsored by,
                or endorsed by Warner Bros.
              </p>
            </div>
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel title="OPERATOR ON DUTY">
            <p className="text-base tracking-wider text-phosphor-bright">{SITE.author}</p>
            <p className="mt-0.5 text-[11px] tracking-[0.2em] text-phosphor/60">
              SCIENTIST · DEVELOPER · DESIGNER
            </p>
            <p className="mt-3 text-sm leading-relaxed text-phosphor/75">
              {SITE.name} is built and maintained by one person, in the open. If something
              here is broken, wrong, or unfaithful to the films, I would genuinely like to
              hear about it.
            </p>
          </Panel>

          <Panel title="CONTACT">
            <ul className="space-y-2 text-sm">
              {CONTACT.map(({ label, href, note }) => (
                <li key={label}>
                  <a
                    href={href}
                    {...(href.startsWith('mailto:') ? {} : { target: '_blank', rel: 'noopener' })}
                    className="group block py-0.5"
                  >
                    <span className="text-phosphor group-hover:text-phosphor-bright">
                      &gt; {label}
                    </span>
                    <span className="block text-[11px] tracking-wider text-phosphor/50">
                      {note}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="SUPPORT">
            <p className="text-sm leading-relaxed text-phosphor/75">
              {SITE.name} is free, ad-free, and login-free, and stays that way. If it earned a
              place on your screen, you can help keep the ship flying.
            </p>
            <div className="mt-4 space-y-2">
              {SUPPORT.map(({ label, href, Mark }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener"
                  className="glow flex items-center gap-3 border border-phosphor/60 bg-phosphor/10 px-4 py-2.5 text-xs tracking-[0.2em] text-phosphor-bright transition-colors hover:bg-phosphor/20"
                >
                  <Mark />
                  <span>{label}</span>
                </a>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </>
  );
}
