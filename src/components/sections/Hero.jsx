import Button from '../ui/Button';
import { profile } from '../../data/profile';
import HeroPhoto from './HeroPhoto';
import SocialLinks from './SocialLinks';

export default function Hero() {
  return (
    <section id="hero" className="hero-bg relative overflow-hidden">
      <div className="mx-auto grid max-w-content items-center gap-12 px-6 py-12 md:grid-cols-2 md:gap-16 md:py-16">
        {/* Mobile: photo first (order-1); Desktop: text first (order-1 here, photo order-2). */}
        <div className="order-2 md:order-1">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            {profile.eyebrow}
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-fg sm:text-5xl md:text-6xl">
            Hi, I&rsquo;m <span className="text-fg">{profile.firstName}</span>
            <span className="text-accent">.</span>
          </h1>
          <p className="mt-5 max-w-[520px] text-base leading-relaxed text-muted md:text-lg">
            {profile.tagline}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Button href="#projects" variant="primary">
              View Projects
            </Button>
            <Button
              href={profile.githubUrl}
              variant="secondary"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub Profile
            </Button>
            <Button href={profile.resumeUrl} variant="secondary" download>
              Download Resume
            </Button>
          </div>

          <SocialLinks items={profile.social} className="mt-8" />
        </div>

        <div className="order-1 md:order-2">
          <HeroPhoto photo={profile.photo} alt={profile.photo.alt || profile.name} />
        </div>
      </div>
    </section>
  );
}