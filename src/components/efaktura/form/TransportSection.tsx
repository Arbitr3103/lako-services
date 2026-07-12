import type { InvoiceData } from '../types';
import { inputClass, labelClass, sectionClass, type StudioT, type StudioDispatch } from './shared';

interface Props {
  t: StudioT;
  invoice: InvoiceData;
  dispatch: StudioDispatch;
}

export default function TransportSection({ t, invoice, dispatch }: Props) {
  return (
    <div className={sectionClass}>
      <h2 className="text-text font-semibold mb-3">{t.transportInfo}</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t.vehicleRegistration}</label>
          <input className={inputClass} value={invoice.vehicleRegistration || ''} maxLength={200}
            placeholder={t.vehiclePlaceholder}
            onChange={e => dispatch({ type: 'SET_FIELD', path: 'vehicleRegistration', value: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>{t.transportInfo}</label>
          <input className={inputClass} value={invoice.transportInfo || ''} maxLength={200}
            placeholder={t.transportPlaceholder}
            onChange={e => dispatch({ type: 'SET_FIELD', path: 'transportInfo', value: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className={labelClass}>{t.warehouseFrom}</label>
          <input className={inputClass} value={invoice.warehouseFrom || ''} maxLength={200}
            placeholder={t.warehousePlaceholder}
            onChange={e => dispatch({ type: 'SET_FIELD', path: 'warehouseFrom', value: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>{t.loadingPlace}</label>
          <div className="flex gap-1">
            <input className={inputClass} value={invoice.loadingPlace || ''} maxLength={200}
              placeholder={t.loadingPlaceholder}
              onChange={e => dispatch({ type: 'SET_FIELD', path: 'loadingPlace', value: e.target.value })} />
            <button
              type="button"
              title={t.copyFromSeller}
              onClick={() => dispatch({ type: 'SET_FIELD', path: 'loadingPlace', value: [invoice.seller.address, invoice.seller.city].filter(Boolean).join(', ') })}
              className="px-2 text-text-muted hover:text-primary transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>
            </button>
          </div>
        </div>
        <div>
          <label className={labelClass}>{t.unloadingPlace}</label>
          <div className="flex gap-1">
            <input className={inputClass} value={invoice.unloadingPlace || ''} maxLength={200}
              placeholder={t.unloadingPlaceholder}
              onChange={e => dispatch({ type: 'SET_FIELD', path: 'unloadingPlace', value: e.target.value })} />
            <button
              type="button"
              title={t.copyFromBuyer}
              onClick={() => dispatch({ type: 'SET_FIELD', path: 'unloadingPlace', value: [invoice.buyer.address, invoice.buyer.city].filter(Boolean).join(', ') })}
              className="px-2 text-text-muted hover:text-primary transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" /></svg>
            </button>
          </div>
        </div>
        <div>
          <label className={labelClass}>{t.loadingDateTime}</label>
          <input type="datetime-local" className={inputClass} value={invoice.loadingDateTime || ''}
            onChange={e => dispatch({ type: 'SET_FIELD', path: 'loadingDateTime', value: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className={labelClass}>{t.transportPurpose}</label>
          <input className={inputClass} value={invoice.transportPurpose || ''} maxLength={200}
            placeholder={t.purposePlaceholder}
            onChange={e => dispatch({ type: 'SET_FIELD', path: 'transportPurpose', value: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
