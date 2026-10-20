import About from '../components/sections/About';
import Blog from '../components/sections/Blog';
import Contact from '../components/sections/Contact';
import EducationTraining from '../components/sections/EducationTraining';
import Hero from '../components/sections/Hero';
import Projects from '../components/sections/Projects';
import Resume from '../components/sections/Resume';
import Services from '../components/sections/Services';
import Skills from '../components/sections/Skills';
import Testimonials from '../components/sections/Testimonials';
import { profile } from '../data/profile';
import useDocumentMeta from '../hooks/useDocumentMeta';

const flags = profile.sections || {};

/**
 * Home renders every enabled section in one commit.
 *
 * Note: an earlier revision deferred the below-the-fold sections behind a
 * requestIdleCallback mount to cut the initial Style & Layout cost. Measured
 * with Lighthouse on a throttled mobile profile it made things *worse* — the
 * deferred mount still performs the same layout work, just later, and it
 * introduces a visible layout shift. So the sections stay eager.
 */
export default function Home() {
  useDocumentMeta({
    title: profile.name,
    description: profile.tagline,
    canonical: '/',
    ogImage: '/og-image.png',
  });
  return (
    <main id="main-content">
      <Hero />
      <About />
      <Projects />
      <Skills />
      <EducationTraining />
      <Resume />
      <Contact />
      {/* Flagged-off sections. Data and components stay in the repo. */}
      {flags.services ? <Services /> : null}
      {flags.testimonials ? <Testimonials /> : null}
      {flags.blog ? <Blog /> : null}
    </main>
  );
}