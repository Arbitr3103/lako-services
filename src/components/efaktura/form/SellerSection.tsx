import type { SellerData } from '../types';
import {
  inputClass, labelClass, sectionClass, pibClass, bankClass, formatBankAccount,
  type StudioT, type StudioDispatch,
} from './shared';

interface Props {
  t: StudioT;
  seller: SellerData;
  editingSeller: boolean;
  setEditingSeller: (v: boolean) => void;
  dispatch: StudioDispatch;
}

export default function SellerSection({ t, seller, editingSeller, setEditingSeller, dispatch }: Props) {
  return (
    <div className={sectionClass}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-text font-semibold">{t.seller}</h2>
        <button
          onClick={() => setEditingSeller(!editingSeller)}
          className="text-primary text-xs hover:underline"
        >
          {t.editCompany}
        </button>
      </div>
      {editingSeller ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>{t.companyName} *</label>
            <input className={inputClass} value={seller.name} maxLength={200}
              onChange={e => dispatch({ type: 'SET_SELLER_FIELD', field: 'name', value: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{t.pib} * <span className="text-text-muted/60">({t.pibHint})</span></label>
            <input className={pibClass(seller.pib)} value={seller.pib} maxLength={9}
              placeholder="123456789"
              onChange={e => dispatch({ type: 'SET_SELLER_FIELD', field: 'pib', value: e.target.value.replace(/\D/g, '') })} />
          </div>
          <div>
            <label className={labelClass}>{t.address}</label>
            <input className={inputClass} value={seller.address} maxLength={500}
              onChange={e => dispatch({ type: 'SET_SELLER_FIELD', field: 'address', value: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{t.city}</label>
            <input className={inputClass} value={seller.city} maxLength={200}
              onChange={e => dispatch({ type: 'SET_SELLER_FIELD', field: 'city', value: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{t.mb}</label>
            <input className={inputClass} value={seller.mb || ''} maxLength={50}
              onChange={e => dispatch({ type: 'SET_SELLER_FIELD', field: 'mb', value: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>{t.bankAccount} <span className="text-text-muted/60">({t.bankAccountHint})</span></label>
            <input className={bankClass(seller.bankAccount)} value={seller.bankAccount || ''}
              placeholder="160-0000000000000-00" maxLength={20}
              onChange={e => dispatch({ type: 'SET_SELLER_FIELD', field: 'bankAccount', value: formatBankAccount(e.target.value) })} />
          </div>
          <div>
            <label className={labelClass}>{t.bankName}</label>
            <input className={inputClass} value={seller.bankName || ''} maxLength={200}
              onChange={e => dispatch({ type: 'SET_SELLER_FIELD', field: 'bankName', value: e.target.value })} />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-text text-sm cursor-pointer">
              <input type="checkbox" checked={seller.vatRegistered}
                onChange={e => dispatch({ type: 'SET_SELLER_FIELD', field: 'vatRegistered', value: e.target.checked })}
                className="rounded" />
              {t.vatRegistered}
            </label>
          </div>
        </div>
      ) : (
        <div className="text-text-light text-sm">
          {seller.name ? (
            <>
              <p className="font-medium text-text">{seller.name}</p>
              {seller.address && <p>{seller.address}, {seller.city}</p>}
              {seller.pib && <p>PIB: {seller.pib}</p>}
              {seller.bankAccount && <p>Račun: {seller.bankAccount}</p>}
            </>
          ) : (
            <p className="text-text-muted italic">{t.editCompany}</p>
          )}
        </div>
      )}
    </div>
  );
}
