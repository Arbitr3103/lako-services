import type { BuyerData } from '../types';
import {
  inputClass, inputValid, labelClass, sectionClass, pibClass,
  type StudioT, type StudioDispatch,
} from './shared';

interface Props {
  t: StudioT;
  buyer: BuyerData;
  buyerFlash: boolean;
  onBuyerPibChange: (val: string) => void;
  dispatch: StudioDispatch;
}

export default function BuyerSection({ t, buyer, buyerFlash, onBuyerPibChange, dispatch }: Props) {
  return (
    <div className={`${sectionClass} transition-all duration-300 ${buyerFlash ? 'ring-2 ring-green-500 ring-opacity-60' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-text font-semibold">{t.buyer}</h2>
        {buyerFlash && (
          <span className="text-green-400 text-xs font-medium animate-pulse">
            ✓ {t.buyerAutoFilled}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t.pib} <span className="text-text-muted/60">({t.pibHint})</span></label>
          <input
            className={buyerFlash ? inputValid : pibClass(buyer.pib)}
            value={buyer.pib || ''}
            maxLength={9}
            placeholder="123456789"
            onChange={e => onBuyerPibChange(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <div>
          <label className={labelClass}>{t.companyName} *</label>
          <input className={inputClass} value={buyer.name} maxLength={200}
            onChange={e => dispatch({ type: 'SET_BUYER_FIELD', field: 'name', value: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>{t.address}</label>
          <input className={inputClass} value={buyer.address} maxLength={500}
            onChange={e => dispatch({ type: 'SET_BUYER_FIELD', field: 'address', value: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>{t.city}</label>
          <input className={inputClass} value={buyer.city} maxLength={200}
            onChange={e => dispatch({ type: 'SET_BUYER_FIELD', field: 'city', value: e.target.value })} />
        </div>
      </div>
    </div>
  );
}
