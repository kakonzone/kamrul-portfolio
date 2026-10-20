export default function SectionHeading({ label, title, align = 'left', className = '' }) {
  const alignment = align === 'center' ? 'text-center' : 'text-left';

  return (
    <div className={`${alignment} ${className}`.trim()}>
      {label ? (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          {label}
        </p>
      ) : null}
      {title ? (
        <h2 className="text-3xl font-bold tracking-tight text-fg md:text-4xl">{title}</h2>
      ) : null}
    </div>
  );
}