import lumioImg from '../assets/projects/lumio.png';
import unitrackImg from '../assets/projects/unitrack.png';
import factCheckImg from '../assets/projects/fact-check-bd.png';
import cryptoImg from '../assets/projects/crypto-coin-screener.png';

// Real projects. Category pills in the Projects section are DERIVED from this
// list, so a category only renders once at least one project uses it — there
// is no hand-maintained category array to fall out of sync.
//
// Project images: the `image` fields below point at clean gradient
// placeholders. When you add a real screenshot, drop it at
// src/assets/projects/<slug>.webp, run `npm run optimize:images` (it mirrors
// responsive WebP/PNG variants into public/projects/), then point the matching
// `image` field at the generated path — e.g. '/projects/lumio-800.webp'.

export const projects = [
  {
    id: 'lumio',
    slug: 'lumio',
    title: 'Lumio',
    category: 'Mobile Apps',
    image: lumioImg,
    shortDescription: 'A Flutter IPTV and sports streaming app.',
    longDescription:
      'Lumio is a Flutter IPTV and sports streaming app. I built it end to end: the app itself, a Cloudflare Worker that serves the channel list, an in-app update system, and a GitHub Actions pipeline that builds and publishes release APKs. It started as LumioTV (Lumio Sports TV) and grew into a full project with its own backend and release process.',
    tech: ['Flutter', 'Dart', 'Clouflare', "CICD"],
    repoUrl: 'https://github.com/kakonzone/lumio',
    liveUrl: 'lumio.kakonzone.me',
    features: [
      'Live IPTV and sports channel streaming',
      'Channel list served from a Cloudflare Worker, so channels can be updated without releasing a new app version',
      'In-app update notifications for new releases',
      'Release APKs built and published automatically with GitHub Actions',
      'Chunked APK uploads to Appwrite Storage',
      'APK size optimization for GitHub releases',
      'Ad monetization integration',
],
    gallery: [lumioImg],
  },
  {
    id: 'unitrack',
    slug: 'unitrack',
    title: 'UniTrack',
    category: 'Mobile Apps',
    image: unitrackImg,
    shortDescription:
      'A real-time university bus tracking app built with Flutter as my final-year project.',
    longDescription:
      'UniTrack is a real-time university bus tracking app that I built as my final-year project. It shows students where the university buses are on a live map, with separate experiences for three types of users. The live location data is synced through Firebase Realtime Database, and the map is built with flutter_map and OpenStreetMap. A major focus was making location tracking reliable in the background and keeping the battery usage low on drivers phones.',
    tech: ['Flutter', 'Dart', 'Firebase Realtime Database', 'Riverpod', 'flutter_map', 'OpenStreetMap'],
    repoUrl: '',
    liveUrl: '',
    features: [
      'Real-time bus location tracking on a live map',
      'Three user roles with separate screens',
      'Adaptive power management with Active, Low Power and Sleep modes to save battery',
      'Background GPS tracking that keeps running through a foreground service, including on Xiaomi (MIUI) devices',
      'Built on Riverpod state management with a modular code structure',
    ],
    gallery: [unitrackImg],
  },
  {
    id: 'fact-check-bd',
    slug: 'fact-check-bd',
    title: 'Fact Check BD',
    category: 'Mobile Apps',
    image: factCheckImg,
    shortDescription:
      'A Bengali news fact-checking app built with Flutter, backed by a Dart Shelf server with an ML model.',
    longDescription:
      'PLACEHOLDER: Overview for Fact Check BD — describe what the app does and the problem it solves.',
    tech: ['Flutter', 'Dart', 'Dart Shelf'],
    repoUrl: '',
    liveUrl: '',
    features: [
      'PLACEHOLDER: Key feature 1 for Fact Check BD.',
      'PLACEHOLDER: Key feature 2 for Fact Check BD.',
      'PLACEHOLDER: Key feature 3 for Fact Check BD.',
    ],
    gallery: [factCheckImg],
  },
  {
    id: 'cryptic-riddles',
    slug: 'cryptic-riddles',
    title: 'Cryptic Riddles',
    category: 'Mobile Apps',
    image: cryptoImg,
    shortDescription:
      'A Flutter desktop app for crypto market analysis, with an embedded Dart Shelf server that aggregates data from multiple exchanges.',
    longDescription:
      'Cryptic Riddles is a personal crypto trading and analysis app that I built with Flutter for desktop. It runs an embedded Dart Shelf server that collects market data from several exchanges and public APIs, so the app can show technical analysis, liquidation maps, on-chain activity and macro context in one place. I built it to support my own trading analysis and to practice designing a larger Flutter application with its own backend layer.',
    tech: ['Flutter', 'Dart', 'Dart Shelf', 'REST APIs', 'Binance API', 'Bybit API'],
    repoUrl: '',
    liveUrl: '',
    features: [
      'Technical analysis with EMA, RSI, ADX, VWAP, OBV and divergence detection',
      'Liquidation map screen with leverage-tier bars and long/short cumulative curves',
      'Fundamental analysis with macro indicators and a Bitcoin cycle analysis screen',
      'On-chain analysis with ETH burn tracking and whale activity monitoring',
      'Dashboard with price chart, funding rate and open interest context',
    ],
    gallery: [cryptoImg],
  },
];

export function projectBySlug(slug) {
  return projects.find((p) => p.slug === slug) ?? null;
}

export function nextProjectAfter(currentProject) {
  const i = projects.findIndex((p) => p.id === currentProject.id);
  if (i === -1) return projects[0];
  return projects[(i + 1) % projects.length];
}

// Derived from the data so the pill list can never drift from reality.
export function deriveProjectCategories(items = projects) {
  const seen = new Set();
  const out = [];
  for (const p of items) {
    if (!p.category || seen.has(p.category)) continue;
    seen.add(p.category);
    out.push(p.category);
  }
  return out;
}

export default projects;