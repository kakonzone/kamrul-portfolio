import { useState } from 'react';
import { CheckCircle2, Mail, MapPin, Sparkles } from 'lucide-react';
import Button from '../ui/Button';
import Card from '../ui/Card';
import SectionHeading from '../ui/SectionHeading';
import SocialLinks from './SocialLinks';
import { profile } from '../../data/profile';
import { sendMessage, CONTACT_HAS_ENDPOINT } from '../../services/sendMessage';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY = { name: '', email: '', subject: '', message: '', _gotcha: '' };
const EMPTY_ERRORS = { name: '', email: '', subject: '', message: '' };

function validate(values) {
  const errors = { ...EMPTY_ERRORS };
  if (!values.name.trim()) errors.name = 'Please tell me your name.';
  if (!values.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(values.email.trim())) {
    errors.email = 'That email does not look quite right.';
  }
  if (!values.subject.trim()) errors.subject = 'A short subject helps me reply faster.';
  if (!values.message.trim()) {
    errors.message = 'A message is required.';
  } else if (values.message.trim().length < 10) {
    errors.message = 'Please write at least 10 characters.';
  }
  return errors;
}

function MetaRow({ icon: Icon, label, value }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-accent"
        style={{ backgroundColor: 'color-mix(in srgb, var(--color-accent) 14%, transparent)' }}
      >
        <Icon size={18} />
      </span>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">{label}</p>
        <p className="mt-1 text-sm font-semibold text-fg">{value}</p>
      </div>
    </li>
  );
}

export default function Contact() {
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [status, setStatus] = useState('idle'); // idle | sending | success | error
  const [serverError, setServerError] = useState('');

  const update = (field) => (e) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const next = validate(values);
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setStatus('sending');
    setServerError('');

    const res = await sendMessage(values);
    if (res.ok) {
      setStatus('success');
      setValues(EMPTY);
    } else {
      setStatus('error');
      setServerError(
        res.mode === 'http'
          ? `Something went wrong${res.status ? ` (HTTP ${res.status})` : ''}. Your message was kept so you can try again.`
          : 'Could not send your message. Please try again.',
      );
    }
  };

  const resetForm = () => {
    setStatus('idle');
    setServerError('');
  };

  return (
    <section id="contact" className="bg-bg-alt px-6 py-24">
      <div className="mx-auto max-w-[1100px]">
        <SectionHeading label="Contact" title="Let's work together" />

        <div className="mt-12 grid gap-12 md:grid-cols-2">
          {/* Left: intro + meta + social */}
          <div>
            <p className="text-base leading-relaxed text-muted">
              {profile.tagline
                ? profile.tagline
                : 'PLACEHOLDER: A short intro paragraph inviting visitors to get in touch about projects, freelance work, or a quick chat.'}
            </p>

            <ul className="mt-8 space-y-5">
              <MetaRow icon={Mail} label="Email" value={profile.email} />
              <MetaRow icon={MapPin} label="Location" value={profile.location} />
              <MetaRow icon={Sparkles} label="Available for" value={profile.meta?.find((m) => m.id === 'available-for')?.value || 'PLACEHOLDER: Freelance & Contract'} />
            </ul>

            <div className="mt-8">
              <SocialLinks items={profile.social} />
            </div>
          </div>

          {/* Right: form */}
          <Card className="p-8">
            {!CONTACT_HAS_ENDPOINT && status !== 'success' ? (
              <p className="mb-6 rounded-lg border border-line bg-bg-alt p-3 text-xs text-muted">
                No contact endpoint configured — submitting will open your email client with the message prefilled.
              </p>
            ) : null}

            {status === 'success' ? (
              <div className="flex flex-col items-start gap-4">
                <CheckCircle2 size={36} className="text-accent" aria-hidden="true" />
                <h3 className="text-xl font-bold text-fg">Message sent</h3>
                <p className="text-sm text-muted">
                  Thanks for reaching out. I'll get back to you as soon as I can.
                </p>
                <Button variant="secondary" onClick={resetForm}>
                  Send another message
                </Button>
              </div>
            ) : (
              <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
                {/* Honeypot - hidden from real users */}
                <div className="absolute h-0 w-0 overflow-hidden" aria-hidden="true">
                  <label>
                    Don't fill this out
                    <input
                      type="text"
                      name="_gotcha"
                      tabIndex={-1}
                      autoComplete="off"
                      value={values._gotcha}
                      onChange={update('_gotcha')}
                    />
                  </label>
                </div>

                <Field
                  id="contact-name"
                  label="Name"
                  type="text"
                  value={values.name}
                  onChange={update('name')}
                  error={errors.name}
                  autoComplete="name"
                />
                <Field
                  id="contact-email"
                  label="Email"
                  type="email"
                  value={values.email}
                  onChange={update('email')}
                  error={errors.email}
                  autoComplete="email"
                />
                <Field
                  id="contact-subject"
                  label="Subject"
                  type="text"
                  value={values.subject}
                  onChange={update('subject')}
                  error={errors.subject}
                />

                <div>
                  <label htmlFor="contact-message" className="mb-2 block text-sm font-medium text-fg">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    name="message"
                    rows={5}
                    value={values.message}
                    onChange={update('message')}
                    aria-invalid={Boolean(errors.message)}
                    aria-describedby={errors.message ? 'contact-message-error' : undefined}
                    className={`w-full resize-y rounded-lg border bg-bg px-4 py-3 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent ${
                      errors.message ? 'border-red-500' : 'border-line'
                    }`}
                    placeholder="PLACEHOLDER: Tell me a bit about what you have in mind..."
                  />
                  {errors.message ? (
                    <p id="contact-message-error" className="mt-1.5 text-xs text-red-400">
                      {errors.message}
                    </p>
                  ) : null}
                </div>

                {status === 'error' && serverError ? (
                  <p role="alert" className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-300">
                    {serverError}
                  </p>
                ) : null}

                <Button type="submit" variant="primary" disabled={status === 'sending'} className="w-full">
                  {status === 'sending' ? 'Sending...' : 'Send message'}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}

function Field({ id, label, error, type = 'text', ...rest }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-fg">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-lg border bg-bg px-4 py-3 text-sm text-fg placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent ${
          error ? 'border-red-500' : 'border-line'
        }`}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}