import { Link } from 'react-router-dom';

const variants = {
  primary: 'bg-accent text-accent-ink hover:opacity-90',
  secondary: 'border border-line bg-transparent text-fg hover:border-accent hover:text-accent',
};

export default function Button({
  children,
  variant = 'primary',
  to,
  href,
  className = '',
  type = 'button',
  ...props
}) {
  const classes = [
    'inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors duration-200',
    variants[variant] ?? variants.primary,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    );
  }

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}
