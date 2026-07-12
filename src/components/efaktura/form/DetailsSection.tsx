import type { InvoiceData } from '../types';
import { inputClass, labelClass, sectionClass, type StudioT, type StudioDispatch } from './shared';

interface Props {
  t: StudioT;
  invoice: InvoiceData;
  showDetails: boolean;
  setShowDetails: (v: boolean) => void;
  dispatch: StudioDispatch;
}

export default function DetailsSection({ t, invoice, showDetails, setShowDetails, dispatch }: Props) {
  return (
    <div className={sectionClass}>
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="text-text font-semibold w-full text-left flex items-center justify-between"
      >
        <span>{t.details}</span>
        <span className={`transform transition-transform ${showDetails ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {showDetails && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className={labelClass}>{t.issueDate}</label>
            <input type="date" className={inputClass} value={invoice.issueDate}
              onChange={e => dispatch({ type: 'SET_FIELD', path: 'issueDate', value: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{t.deliveryDate}</label>
            <input type="date" className={inputClass} value={invoice.deliveryDate || ''}
              onChange={e => dispatch({ type: 'SET_FIELD', path: 'deliveryDate', value: e.target.value })} />
          </div>
          {invoice.documentType !== 'otpremnica' && (
            <>
              <div>
                <label className={labelClass}>{t.dueDate}</label>
                <input type="date" className={inputClass} value={invoice.dueDate || ''}
                  onChange={e => dispatch({ type: 'SET_FIELD', path: 'dueDate', value: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>{t.quickSelect}</label>
                <div className="flex gap-1">
                  {[7, 15, 30, 60].map(days => (
                    <button key={days}
                      onClick={() => {
                        const d = new Date(invoice.issueDate || Date.now());
                        d.setDate(d.getDate() + days);
                        dispatch({ type: 'SET_FIELD', path: 'dueDate', value: d.toISOString().split('T')[0] });
                      }}
                      className="px-2 py-1 text-xs bg-bg-alt border border-border-light rounded text-text-muted hover:text-primary hover:border-primary transition-colors"
                    >
                      {t[`days${days}`]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>{t.paymentReference} <span className="text-text-muted/60">({t.paymentRefAuto})</span></label>
                <input className={inputClass} value={invoice.paymentReference || ''} maxLength={50}
                  placeholder={t.paymentRefAuto}
                  onChange={e => dispatch({ type: 'SET_FIELD', path: 'paymentReference', value: e.target.value })} />
              </div>
            </>
          )}
          <div className="col-span-2">
            <label className={labelClass}>{t.notes}</label>
            <textarea className={inputClass + ' h-20 resize-none'} value={invoice.notes || ''} maxLength={2000}
              onChange={e => dispatch({ type: 'SET_FIELD', path: 'notes', value: e.target.value })} />
          </div>
        </div>
      )}
    </div>
  );
}
