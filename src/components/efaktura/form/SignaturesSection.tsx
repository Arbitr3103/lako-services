import type { InvoiceData } from '../types';
import { inputClass, labelClass, sectionClass, type StudioT, type StudioDispatch } from './shared';

interface Props {
  t: StudioT;
  invoice: InvoiceData;
  dispatch: StudioDispatch;
}

export default function SignaturesSection({ t, invoice, dispatch }: Props) {
  return (
    <div className={sectionClass}>
      <h2 className="text-text font-semibold mb-3">{t.signatures}</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t.handoverName}</label>
          <input className={inputClass} value={invoice.handoverName || ''} maxLength={200}
            placeholder={t.handoverName}
            onChange={e => dispatch({ type: 'SET_FIELD', path: 'handoverName', value: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>{t.receiverName}</label>
          <input className={inputClass} value={invoice.receiverName || ''} maxLength={200}
            placeholder={t.receiverName}
            onChange={e => dispatch({ type: 'SET_FIELD', path: 'receiverName', value: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
