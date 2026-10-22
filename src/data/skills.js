import {
  SiFlutter,
  SiDart,
  SiFirebase,
  SiAppwrite,
  SiAndroid,
  SiApple,
  SiPython,
  SiC,
  SiCplusplus,
  SiJavascript,
  SiHtml5,
  SiCss,
  SiBootstrap,
  SiGit,
  SiGithub,
} from 'react-icons/si';
import {
  Code2,
  Monitor,
  Server,
  Network,
  Database,
  GitBranch,
  Plug,
  Boxes,
  Cpu,
} from 'lucide-react';

// Brand icon registry: each skill points to an icon component AND the brand's
// official color (Simple Icons hex). The Skills section uses these colors.
// Brands that are pure black or white (github, apple, git…) get a
// `themeAware: true` flag so the chip falls back to the foreground color in
// the current theme and stays legible. Skills with no recognizable brand icon
// use a lucide fallback in the current theme's muted color.

const SKILL_META = {
  flutter:      { icon: SiFlutter,     color: '#02569B' },
  dart:         { icon: SiDart,        color: '#0175C2' },
  android:      { icon: SiAndroid,     color: '#3DDC84' },
  ios:          { icon: SiApple,       color: '#000000', themeAware: true },
  desktop:      { icon: Monitor,       color: '#8fa8b8' },
  'rest-apis':  { icon: Plug,          color: '#8fa8b8' },
  firebase:     { icon: SiFirebase,    color: '#FFCA28' },
  appwrite:     { icon: SiAppwrite,    color: '#FD1E53' },
  'dart-shelf': { icon: Server,        color: '#8fa8b8' },
  flask:        { icon: Server,        color: '#8fa8b8' },
  python:       { icon: SiPython,      color: '#3776AB' },
  c:            { icon: SiC,           color: '#A8B9CC' },
  'c++':        { icon: SiCplusplus,   color: '#00599C' },
  javascript:   { icon: SiJavascript,  color: '#F7DF1E' },
  html5:        { icon: SiHtml5,       color: '#E34F26' },
  css3:         { icon: SiCss,        color: '#1572B6' },
  bootstrap:    { icon: SiBootstrap,   color: '#7952B3' },
  dsa:          { icon: Network,       color: '#8fa8b8' },
  oop:          { icon: Boxes,         color: '#8fa8b8' },
  dbms:         { icon: Database,      color: '#8fa8b8' },
  networks:     { icon: Network,       color: '#8fa8b8' },
  os:           { icon: Cpu,           color: '#8fa8b8' },
  git:          { icon: SiGit,         color: '#F05032' },
  github:       { icon: SiGithub,      color: '#181717', themeAware: true },
  'api-integration': { icon: Plug,      color: '#8fa8b8' },
  'database-integration': { icon: Database, color: '#8fa8b8' },
  agile:        { icon: GitBranch,     color: '#8fa8b8' },
  default:      { icon: Code2,         color: '#8fa8b8' },
};

export function iconFor(slug) {
  return SKILL_META[slug]?.icon ?? SKILL_META.default.icon;
}

export function brandColor(slug) {
  return SKILL_META[slug]?.color ?? SKILL_META.default.color;
}

export function isThemeAware(slug) {
  return Boolean(SKILL_META[slug]?.themeAware);
}

// Skill groups, in display order. One chip per bullet.
export const skillGroups = [
  {
    id: 'mobile-cross-platform',
    title: 'Mobile & Cross-Platform Development',
    skills: [
      { id: 'flutter', name: 'Flutter' },
      { id: 'dart', name: 'Dart' },
      { id: 'android', name: 'Android' },
      { id: 'ios', name: 'iOS' },
      { id: 'desktop', name: 'Desktop' },
    ],
  },
  {
    id: 'backend-apis',
    title: 'Backend & APIs',
    skills: [
      { id: 'rest-apis', name: 'REST APIs' },
      { id: 'firebase', name: 'Firebase' },
      { id: 'appwrite', name: 'Appwrite' },
      { id: 'dart-shelf', name: 'Dart Shelf' },
      { id: 'flask', name: 'Python Flask' },
    ],
  },
  {
    id: 'programming-languages',
    title: 'Programming Languages',
    skills: [
      { id: 'python', name: 'Python' },
      { id: 'c', name: 'C' },
      { id: 'c++', name: 'C++' },
      { id: 'dart', name: 'Dart' },
      { id: 'javascript', name: 'JavaScript' },
    ],
  },
  {
    id: 'web-development',
    title: 'Web Development',
    skills: [
      { id: 'html5', name: 'HTML5' },
      { id: 'css3', name: 'CSS3' },
      { id: 'bootstrap', name: 'Bootstrap' },
    ],
  },
  {
    id: 'cs-fundamentals',
    title: 'Computer Science Fundamentals',
    skills: [
      { id: 'dsa', name: 'Data Structures & Algorithms' },
      { id: 'oop', name: 'Object-Oriented Programming (OOP)' },
      { id: 'dbms', name: 'Database Management Systems (DBMS)' },
      { id: 'networks', name: 'Computer Networks' },
      { id: 'os', name: 'Operating Systems' },
    ],
  },
  {
    id: 'software-development',
    title: 'Software Development',
    skills: [
      { id: 'git', name: 'Git & GitHub' },
      { id: 'api-integration', name: 'API Integration' },
      { id: 'database-integration', name: 'Database Integration' },
      { id: 'agile', name: 'Agile & SDLC' },
    ],
  },
];

// Back-compat alias: the Skills section reads `skillCategories`.
export const skillCategories = skillGroups;

export default skillGroups;