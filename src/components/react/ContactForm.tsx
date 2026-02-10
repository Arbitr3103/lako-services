import { useState, type FormEvent } from 'react';

import sr from '../../i18n/sr.json';
import en from '../../i18n/en.json';

interface Props {
  locale: 'sr' | 'en';
}

export default function ContactForm({ locale }: Props) {
  const translations = locale === 'sr' ? sr : en;
  const form = translations.contact.form;
  const businessTypes = form.businessTypes;

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('loading');

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setStatus('success');
        (e.target as HTMLFormElement).reset();
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
          <option value="">{locale === 'sr' ? 'Izaberite...' : 'Select...'}</option>
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
          className="w-full border border-border-light rounded-lg p-3 bg-bg-card text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow resize-y"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full bg-accent text-white font-semibold rounded-lg px-6 py-3 hover:bg-accent-dark focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === 'loading'
          ? (locale === 'sr' ? 'Slanje...' : 'Sending...')
          : form.submit}
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
