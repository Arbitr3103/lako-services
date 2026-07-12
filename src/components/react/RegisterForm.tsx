import { useState } from 'react';

// Type-only references to the dictionary shape — no runtime JSON import,
// so the island does not bundle the full site translations.
export type RegisterFormT = typeof import('../../i18n/sr.json')['registerBusiness']['form'];
export type ConsentT = typeof import('../../i18n/sr.json')['consent'];

interface Props {
  locale: 'sr' | 'en' | 'ru';
  /** `registerBusiness.form` slice, resolved server-side in the .astro page. */
  form: RegisterFormT;
  /** `consent` slice, resolved server-side in the .astro page. */
  consent: ConsentT;
}

interface FormSubmitEvent {
  preventDefault(): void;
  currentTarget: HTMLFormElement;
}

export default function RegisterForm({ locale, form, consent }: Props) {
  const categories = form.categories;
  const cities = form.cities;
  const privacyPolicyPath = locale === 'sr' ? '/privacy-policy/' : `/${locale}/privacy-policy/`;

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function handleSubmit(e: FormSubmitEvent) {
    e.preventDefault();
    setStatus('loading');

    // React nulls e.currentTarget after the synchronous part of the handler
    const formEl = e.currentTarget;
    const formData = new FormData(formEl);
    const data = {
      businessName: formData.get('businessName'),
      category: formData.get('category'),
      city: formData.get('city'),
      address: formData.get('address'),
      phone: formData.get('phone'),
      instagram: formData.get('instagram'),
      website: formData.get('website'),
      contactName: formData.get('contactName'),
      email: formData.get('email'),
      // consent intentionally excluded
    };

    try {
      const res = await fetch('/api/register-business', {
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

  const inputClass = 'w-full border border-border-light rounded-lg p-3 bg-bg-card text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Business Name */}
      <div>
        <label htmlFor="businessName" className="block font-medium mb-1 text-text">
          {form.businessName} *
        </label>
        <input type="text" id="businessName" name="businessName" required maxLength={200} autoComplete="organization" className={inputClass} />
      </div>

      {/* Category */}
      <div>
        <label htmlFor="category" className="block font-medium mb-1 text-text">
          {form.category} *
        </label>
        <select id="category" name="category" required className={inputClass}>
          <option value="">{form.selectPlaceholder}</option>
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
          <option value="">{form.selectPlaceholder}</option>
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
        <input type="text" id="address" name="address" required maxLength={300} autoComplete="street-address" className={inputClass} />
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block font-medium mb-1 text-text">
          {form.phone} *
        </label>
        <input type="tel" id="phone" name="phone" required maxLength={30} autoComplete="tel" className={inputClass} />
      </div>

      {/* Instagram */}
      <div>
        <label htmlFor="instagram" className="block font-medium mb-1 text-text">
          {form.instagram}
        </label>
        <input type="text" id="instagram" name="instagram" maxLength={100} className={inputClass} />
      </div>

      {/* Website */}
      <div>
        <label htmlFor="website" className="block font-medium mb-1 text-text">
          {form.website}
        </label>
        <input type="url" id="website" name="website" maxLength={300} autoComplete="url" className={inputClass} />
      </div>

      {/* Contact Name */}
      <div>
        <label htmlFor="contactName" className="block font-medium mb-1 text-text">
          {form.contactName} *
        </label>
        <input type="text" id="contactName" name="contactName" required maxLength={200} autoComplete="name" className={inputClass} />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block font-medium mb-1 text-text">
          {form.email} *
        </label>
        <input type="email" id="email" name="email" required maxLength={254} autoComplete="email" className={inputClass} />
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
