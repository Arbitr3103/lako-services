import { useState, type FormEvent } from 'react';

import sr from '../../i18n/sr.json';
import en from '../../i18n/en.json';

interface Props {
  locale: 'sr' | 'en';
}

export default function RegisterForm({ locale }: Props) {
  const translations = locale === 'sr' ? sr : en;
  const form = translations.registerBusiness.form;
  const categories = form.categories;
  const cities = form.cities;

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('loading');

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData);

    try {
      const res = await fetch('/api/register-business', {
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

  const inputClass = 'w-full border border-border-light rounded-lg p-3 bg-bg-card text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Business Name */}
      <div>
        <label htmlFor="businessName" className="block font-medium mb-1 text-text">
          {form.businessName} *
        </label>
        <input type="text" id="businessName" name="businessName" required className={inputClass} />
      </div>

      {/* Category */}
      <div>
        <label htmlFor="category" className="block font-medium mb-1 text-text">
          {form.category} *
        </label>
        <select id="category" name="category" required className={inputClass}>
          <option value="">{locale === 'sr' ? 'Izaberite...' : 'Select...'}</option>
          <option value="salon">{categories.salon}</option>
          <option value="nails">{categories.nails}</option>
          <option value="dental">{categories.dental}</option>
          <option value="auto">{categories.auto}</option>
          <option value="dryclean">{categories.dryclean}</option>
          <option value="massage">{categories.massage}</option>
          <option value="other">{categories.other}</option>
        </select>
      </div>

      {/* City */}
      <div>
        <label htmlFor="city" className="block font-medium mb-1 text-text">
          {form.city} *
        </label>
        <select id="city" name="city" required className={inputClass}>
          <option value="">{locale === 'sr' ? 'Izaberite...' : 'Select...'}</option>
          <option value="belgrade">{cities.belgrade}</option>
          <option value="noviSad">{cities.noviSad}</option>
          <option value="other">{cities.other}</option>
        </select>
      </div>

      {/* Address */}
      <div>
        <label htmlFor="address" className="block font-medium mb-1 text-text">
          {form.address} *
        </label>
        <input type="text" id="address" name="address" required className={inputClass} />
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block font-medium mb-1 text-text">
          {form.phone} *
        </label>
        <input type="tel" id="phone" name="phone" required className={inputClass} />
      </div>

      {/* Instagram */}
      <div>
        <label htmlFor="instagram" className="block font-medium mb-1 text-text">
          {form.instagram}
        </label>
        <input type="text" id="instagram" name="instagram" className={inputClass} />
      </div>

      {/* Website */}
      <div>
        <label htmlFor="website" className="block font-medium mb-1 text-text">
          {form.website}
        </label>
        <input type="url" id="website" name="website" className={inputClass} />
      </div>

      {/* Contact Name */}
      <div>
        <label htmlFor="contactName" className="block font-medium mb-1 text-text">
          {form.contactName} *
        </label>
        <input type="text" id="contactName" name="contactName" required className={inputClass} />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block font-medium mb-1 text-text">
          {form.email} *
        </label>
        <input type="email" id="email" name="email" required className={inputClass} />
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

      {status === 'success' && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 p-4 text-sm">
          {form.success}
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 p-4 text-sm">
          {form.error}
        </div>
      )}
    </form>
  );
}
