import { useState } from 'react';

// Type-only references to the dictionary shape — no runtime JSON import,
// so the island does not bundle the full site translations.
export type ContactFormT = typeof import('../../i18n/sr.json')['contact']['form'];
export type ConsentT = typeof import('../../i18n/sr.json')['consent'];

interface Props {
  locale: 'sr' | 'en' | 'ru';
  /** `contact.form` slice, resolved server-side in the .astro page. */
  form: ContactFormT;
  /** `consent` slice, resolved server-side in the .astro page. */
  consent: ConsentT;
}

interface FormSubmitEvent {
  preventDefault(): void;
  currentTarget: HTMLFormElement;
}

export default function ContactForm({ locale, form, consent }: Props) {
  const businessTypes = form.businessTypes;
  const privacyPolicyPath = locale === 'sr' ? '/privacy-policy/' : `/${locale}/privacy-policy/`;

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function handleSubmit(e: FormSubmitEvent) {
    e.preventDefault();
    setStatus('loading');

    // React nulls e.currentTarget after the synchronous part of the handler
    const formEl = e.currentTarget;
    const formData = new FormData(formEl);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      businessType: formData.get('businessType'),
      message: formData.get('message'),
      // consent intentionally excluded
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setStatus('success');
        formEl.reset();
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div>
        <label htmlFor="name" className="block font-medium mb-1 text-text">
          {form.name} *
        </label>
        <input
          type="text"
          id="name"
          name="name"
          required
          maxLength={200}
          autoComplete="name"
          className="w-full border border-border-light rounded-lg p-3 bg-bg-card text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block font-medium mb-1 text-text">
          {form.email} *
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          maxLength={254}
          autoComplete="email"
          className="w-full border border-border-light rounded-lg p-3 bg-bg-card text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
        />
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block font-medium mb-1 text-text">
          {form.phone}
        </label>
        <input
          type="tel"
          id="phone"
          name="phone"
          maxLength={30}
          autoComplete="tel"
          className="w-full border border-border-light rounded-lg p-3 bg-bg-card text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
        />
      </div>

      {/* Business Type */}
      <div>
        <label htmlFor="businessType" className="block font-medium mb-1 text-text">
          {form.businessType} *
        </label>
        <select
          id="businessType"
          name="businessType"
          required
          className="w-full border border-border-light rounded-lg p-3 bg-bg-card text-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
        >
          <option value="">{form.selectPlaceholder}</option>
          <option value="logistics">{businessTypes.logistics}</option>
          <option value="salon">{businessTypes.salon}</option>
          <option value="dental">{businessTypes.dental}</option>
          <option value="auto">{businessTypes.auto}</option>
          <option value="other">{businessTypes.other}</option>
        </select>
      </div>

      {/* Message */}
      <div>
        <label htmlFor="message" className="block font-medium mb-1 text-text">
          {form.message} *
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          maxLength={5000}
          className="w-full border border-border-light rounded-lg p-3 bg-bg-card text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow resize-y"
        />
      </div>

      {/* Consent */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="consent"
          name="consent"
          required
          className="mt-1 h-4 w-4 rounded border-border-light text-primary focus:ring-primary"
        />
        <label htmlFor="consent" className="text-sm text-text-muted">
          {consent.text}{' '}
          <a
            href={privacyPolicyPath}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {consent.linkText}
          </a>
        </label>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full bg-accent text-white font-semibold rounded-lg px-6 py-3 hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? form.loading : form.submit}
      </button>

      {/* Success message */}
      {status === 'success' && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 p-4 text-sm">
          {form.success}
        </div>
      )}

      {/* Error message */}
      {status === 'error' && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 p-4 text-sm">
          {form.error}
        </div>
      )}
    </form>
  );
}
