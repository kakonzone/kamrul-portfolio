import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import BlogCard from '../ui/BlogCard';
import { posts } from '../../data/blog';

const LATEST_COUNT = 3;

export default function Blog() {
  const latest = posts.slice(0, LATEST_COUNT);

  return (
    <section id="blog" className="bg-bg px-6 py-24">
      <div className="mx-auto max-w-[1100px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">Blog</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-fg md:text-4xl">
              Latest writing
            </h2>
          </div>
          <Link
            to="/blog"
            className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
          >
            All posts
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {latest.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>
      </div>
    </section>
  );
}