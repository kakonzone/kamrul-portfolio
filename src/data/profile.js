// The hero photo is served from public/ (responsive WebP + PNG fallback),
// not bundled, so the original PNG never enters the JS bundle. See
// scripts/optimize-images.mjs and the <picture> element in HeroPhoto.jsx.
const photo = {
  webp: [
    { src: '/profile-442.webp', w: 442 },
    { src: '/profile-884.webp', w: 884 },
  ],
  png: [
    { src: '/profile-442.png', w: 442 },
    { src: '/profile-884.png', w: 884 },
  ],
  width: 442,
  height: 564,
  alt: 'Portrait of Kamrul',
};

// Single source of truth for the resume file. Both the hero "Download Resume"
// button and the Resume section button read this constant. Drop your PDF at
// public/resume.pdf — `npm run check:content` warns while it is missing.
export const RESUME_URL = '/resume.pdf';

export const profile = {
  name: 'Kamrul',
  firstName: 'Kamrul',
  eyebrow: 'Software Engineer & App Developer',
  photo,
  resumeUrl: RESUME_URL,

  // Real links only. Any entry whose url still contains PLACEHOLDER is hidden
  // by SocialLinks so it never renders as a dead link.
  githubUrl: 'https://github.com/kakonzone',
  linkedinUrl: 'https://www.linkedin.com/in/kakonzone',

  // Section toggle flags. Set to false to remove a section from the Home page,
  // the Navbar link list, the Footer link list, and the sitemap.
  sections: {
    testimonials: false,
    blog: false,
    services: false,
  },

  aboutHeading: 'About me',
  tagline:
    'I build practical, user-focused applications with Flutter, Dart, and Python. I focus on cross-platform app development, API integration, backend services, and building software that solves real-world problems.',
  location: 'Cumilla, Bangladesh',
  email: 'kakonzone@gmail.com',

  // The icon rows (hero, contact, footer) read this list.
  social: [
    { id: 'github', label: 'GitHub', url: 'https://github.com/kakonzone' },
    { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/kakonzone' },
    { id: 'email', label: 'Email', url: 'mailto:kakonzone@gmail.com' },
  ],

  meta: [
    { id: 'based-in', label: 'Based in', value: 'Cumilla, Bangladesh' },
    { id: 'focus', label: 'Focus', value: 'Flutter & Cross-Platform Apps' },
    { id: 'available-for', label: 'Available for', value: 'Internships, Full-time & Freelance' },
  ],

  // Stat cards are NOT stored here — they are derived at runtime from the
  // real data files in src/data/stats.js so they stay correct when you edit
  // education.js, training.js, projects.js or skills.js.
  about: [
    "I'm a Software Engineer with a strong focus on cross-platform application development using Flutter and Dart. I enjoy turning ideas into functional applications, from designing user interfaces to implementing application logic, integrating APIs, and connecting backend services.",
    'Alongside mobile development, I work with Python to build tools and automation solutions, and use web technologies to create responsive interfaces. I’m continuously improving my problem-solving skills and exploring better ways to build reliable, maintainable software.',
  ],
};

export default profile;