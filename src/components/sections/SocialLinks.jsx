import { Github, Linkedin, Mail } from 'lucide-react';

// Map a social id from data to the lucide-react icon component.
const ICONS = {
  github: Github,
  linkedin: Linkedin,
  email: Mail,
};

export default function SocialLinks({ items, className = '' }) {
  // Hide any entry whose url is still a PLACEHOLDER so the row never renders a
  // dead link. Entries you fill in later appear automatically.
  const visible = (items ?? []).filter(
    (item) =>
      item?.url &&
      !/placeholder/i.test(item.url) &&
      item.url !== 'mailto:placeholder@email.com',
  );

  if (!visible.length) return null;
  return (
    <ul className={`flex items-center gap-5 ${className}`.trim()}>
      {visible.map((item) => {
        const Icon = ICONS[item.id];
        return (
          <li key={item.id}>
            <a
              href={item.url}
              target={item.url.startsWith('http') ? '_blank' : undefined}
              rel={item.url.startsWith('http') ? 'noreferrer noopener' : undefined}
              aria-label={item.label}
              className="inline-flex items-center justify-center text-muted transition-colors hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
            >
              {Icon ? <Icon size={20} /> : null}
            </a>
          </li>
        );
      })}
    </ul>
  );
}