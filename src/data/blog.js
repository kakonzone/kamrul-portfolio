import flutterImg from '../assets/blog/flutter-state-management-in-2026.svg';
import supabaseImg from '../assets/blog/supabase-auth-the-honest-version.svg';
import releaseImg from '../assets/blog/a-release-checklist-i-actually-use.svg';
import testingImg from '../assets/blog/the-mobile-testing-pyramid.svg';

export const posts = [
  {
    id: 'post-1',
    slug: 'flutter-state-management-in-2026',
    title: 'PLACEHOLDER: Flutter state management in 2026',
    excerpt:
      'PLACEHOLDER: A short comparison of the most common state-management options in Flutter and how to pick one for your project.',
    date: '2026-08-23',
    readTime: '7 min',
    tags: ['Flutter', 'Architecture'],
    image: flutterImg,
    body: [
      { type: 'p', text: 'PLACEHOLDER: Opening paragraph introducing the topic and why it matters today.' },
      { type: 'h2', text: 'PLACEHOLDER: The usual suspects' },
      { type: 'p', text: 'PLACEHOLDER: A paragraph covering the major options such as Provider, Riverpod, Bloc, and GetX.' },
      { type: 'ul', items: [
        'PLACEHOLDER: Provider — small, well-known, easy to start.',
        'PLACEHOLDER: Riverpod — modern, testable, more opinionated.',
        'PLACEHOLDER: Bloc — event-driven, scales well, verbose at first.',
        'PLACEHOLDER: GetX — batteries-included, mixed opinions in the community.',
      ] },
      { type: 'h2', text: 'PLACEHOLDER: How to pick' },
      { type: 'p', text: 'PLACEHOLDER: A paragraph that suggests matching the choice to team size, app size, and testing needs.' },
      { type: 'code', lang: 'dart', text: 'final counterProvider = StateProvider<int>((ref) => 0);' },
      { type: 'p', text: 'PLACEHOLDER: Closing paragraph with your own opinion and what you actually use.' },
    ],
  },
  {
    id: 'post-2',
    slug: 'supabase-auth-the-honest-version',
    title: 'PLACEHOLDER: Supabase auth, the honest version',
    excerpt:
      'PLACEHOLDER: Lessons from shipping Supabase authentication in a real Flutter app — the parts the docs skip.',
    date: '2026-07-10',
    readTime: '9 min',
    tags: ['Supabase', 'Auth', 'Flutter'],
    image: supabaseImg,
    body: [
      { type: 'p', text: 'PLACEHOLDER: Opening paragraph on why Supabase is appealing for a small Flutter team.' },
      { type: 'h2', text: 'PLACEHOLDER: Magic links, refresh tokens, and the rest' },
      { type: 'p', text: 'PLACEHOLDER: A paragraph walking through the parts of the Supabase auth flow that surprised you.' },
      { type: 'ul', items: [
        'PLACEHOLDER: Magic link flows that survive app restarts.',
        'PLACEHOLDER: When the access token quietly expires.',
        'PLACEHOLDER: How to wire sign-out without leaving orphan sessions.',
      ] },
      { type: 'code', lang: 'dart', text: "await supabase.auth.signInWithOtp(email: email);" },
      { type: 'p', text: 'PLACEHOLDER: Closing thoughts on the trade-offs vs. rolling your own auth.' },
    ],
  },
  {
    id: 'post-3',
    slug: 'a-release-checklist-i-actually-use',
    title: 'PLACEHOLDER: A release checklist I actually use',
    excerpt:
      'PLACEHOLDER: A practical, opinionated pre-release checklist for Flutter apps shipping to the App Store and Play Store.',
    date: '2026-06-02',
    readTime: '5 min',
    tags: ['Release', 'Process'],
    image: releaseImg,
    body: [
      { type: 'p', text: 'PLACEHOLDER: Opening paragraph about why checklists beat willpower on release day.' },
      { type: 'h2', text: 'PLACEHOLDER: The list' },
      { type: 'ul', items: [
        'PLACEHOLDER: Bump the version code and version name.',
        'PLACEHOLDER: Lock the changelog and tag the release in git.',
        'PLACEHOLDER: Confirm all feature flags for the rollout audience.',
        'PLACEHOLDER: Build the release artifact and verify the bundle ID.',
        'PLACEHOLDER: Run a final smoke test on a fresh install.',
      ] },
      { type: 'p', text: 'PLACEHOLDER: Closing paragraph on what to skip and what to never skip.' },
    ],
  },
  {
    id: 'post-4',
    slug: 'the-mobile-testing-pyramid',
    title: 'PLACEHOLDER: The mobile testing pyramid',
    excerpt:
      'PLACEHOLDER: A friendly tour of unit, widget, integration, and golden tests in Flutter, with real examples.',
    date: '2026-04-18',
    readTime: '11 min',
    tags: ['Testing', 'Flutter'],
    image: testingImg,
    body: [
      { type: 'p', text: 'PLACEHOLDER: Opening paragraph on why a layered testing strategy saves time on mobile.' },
      { type: 'h2', text: 'PLACEHOLDER: Unit tests' },
      { type: 'p', text: 'PLACEHOLDER: When and how to write fast, focused unit tests for your business logic.' },
      { type: 'h2', text: 'PLACEHOLDER: Widget tests' },
      { type: 'p', text: 'PLACEHOLDER: Widget tests as the most useful default for Flutter apps.' },
      { type: 'h2', text: 'PLACEHOLDER: Integration and golden tests' },
      { type: 'p', text: 'PLACEHOLDER: A short paragraph on when the extra cost of integration and golden tests is worth it.' },
      { type: 'code', lang: 'dart', text: "testWidgets('renders title', (tester) async { await tester.pumpWidget(MyApp()); expect(find.text('Hi'), findsOneWidget); });" },
      { type: 'p', text: 'PLACEHOLDER: Closing thoughts on the team habits that keep a test suite healthy.' },
    ],
  },
];

export function postBySlug(slug) {
  return posts.find((p) => p.slug === slug) ?? null;
}

export function nextPostAfter(currentPost) {
  const i = posts.findIndex((p) => p.id === currentPost.id);
  if (i === -1) return posts[0];
  return posts[(i + 1) % posts.length];
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

export function allTags() {
  const set = new Set();
  for (const p of posts) for (const t of p.tags ?? []) set.add(t);
  return Array.from(set).sort();
}

export default posts;