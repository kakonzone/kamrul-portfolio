export default function Card({ children, className = '', ...rest }) {
  return (
    <div className={`rounded-2xl border border-line bg-card ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
