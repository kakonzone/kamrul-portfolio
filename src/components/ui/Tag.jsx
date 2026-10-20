export default function Tag({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-line bg-bg px-3 py-1 text-xs font-medium text-muted ${className}`.trim()}
    >
      {children}
    </span>
  );
}
