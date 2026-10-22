// Renders the body block array from a blog post. Whitelist of block types so
// we never have to reach for dangerouslySetInnerHTML.

export default function BlogBody({ blocks = [] }) {
  return (
    <div className="space-y-6 text-base leading-relaxed text-fg">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'h2':
            return (
              <h2
                key={i}
                className="mt-10 text-2xl font-bold tracking-tight text-fg first:mt-0"
              >
                {block.text}
              </h2>
            );
          case 'h3': {
            // Never skip a level. The page heading is an h1, so an h3 with no
            // preceding h2 in this body would jump h1 -> h3. Until an h2 has
            // appeared, render the block as an h2.
            const hasH2Before = blocks.slice(0, i).some((b) => b?.type === 'h2');
            const Heading = hasH2Before ? 'h3' : 'h2';
            return (
              <Heading key={i} className="mt-8 text-lg font-semibold text-fg">
                {block.text}
              </Heading>
            );
          }
          case 'ul':
            return (
              <ul key={i} className="list-disc space-y-2 pl-6 text-muted">
                {(block.items ?? []).map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className="list-decimal space-y-2 pl-6 text-muted">
                {(block.items ?? []).map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ol>
            );
          case 'code':
            return (
              <pre
                key={i}
                className="overflow-x-auto rounded-xl border border-line bg-bg-alt p-4 text-sm leading-relaxed text-fg"
              >
                <code>{block.text}</code>
              </pre>
            );
          case 'p':
          default:
            return (
              <p key={i} className="text-muted">
                {block.text}
              </p>
            );
        }
      })}
    </div>
  );
}