import {
  Smartphone,
  Palette,
  PlugZap,
  Rocket,
} from 'lucide-react';

export const services = [
  {
    id: 'mobile-app-development',
    title: 'PLACEHOLDER: Mobile App Development',
    description:
      'PLACEHOLDER: Design and build cross-platform mobile apps with Flutter and Dart, from first prototype to App Store / Play Store release.',
    icon: Smartphone,
  },
  {
    id: 'ui-ux-design',
    title: 'PLACEHOLDER: UI/UX Design',
    description:
      'PLACEHOLDER: Turn rough ideas into clean, easy-to-use interfaces in Figma, with reusable components and design tokens.',
    icon: Palette,
  },
  {
    id: 'backend-and-apis',
    title: 'PLACEHOLDER: Backend & API Integration',
    description:
      'PLACEHOLDER: Wire your product to auth, storage, and third-party APIs on Firebase, Supabase, or your existing services.',
    icon: PlugZap,
  },
  {
    id: 'publishing-and-maintenance',
    title: 'PLACEHOLDER: App Publishing & Maintenance',
    description:
      'PLACEHOLDER: Handle store listings, CI/CD, OTA updates, and ongoing fixes so the app keeps shipping reliably.',
    icon: Rocket,
  },
];

export default services;