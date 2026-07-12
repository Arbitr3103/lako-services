import type { RefObject } from 'react';
import type { InvoiceItem } from '../types';
import type { SavedItem } from '../storage';
import { inputClass, labelClass, sectionClass, type StudioT, type StudioDispatch } from './shared';

interface Props {
  t: StudioT;
  items: InvoiceItem[];
  itemSuggestions: Record<number, SavedItem[]>;
  autocompleteRefs: RefObject<Record<number, HTMLDivElement | null>>;
  dispatch: StudioDispatch;
  onDescriptionChange: (idx: number, val: string) => void;
  onDescriptionFocus: (idx: number) => void;
  applyItemSuggestion: (idx: number, suggestion: SavedItem) => void;
}

export default function ItemsSection({
  t, items, itemSuggestions, autocompleteRefs, dispatch,
  onDescriptionChange, onDescriptionFocus, applyItemSuggestion,
}: Props) {
  return (
    <div className={sectionClass}>
      <h2 className="text-text font-semibold mb-3">{t.items}</h2>
      <div className="space-y-3">
        {items.map((item, idx) => (
          <div key={item.id} className="bg-bg-alt rounded-lg p-3 relative">
            {items.length > 1 && (
              <button
                onClick={() => dispatch({ type: 'REMOVE_ITEM', index: idx })}
                className="absolute top-2 right-2 text-red-400 hover:text-red-300 text-xs"
              >
                ✕
              </button>
            )}
            {/* Description with autocomplete */}
            <div className="mb-2 relative" ref={el => { autocompleteRefs.current[idx] = el; }}>
              <input
                className={inputClass}
                placeholder={t.description}
                value={item.description}
                maxLength={500}
                onChange={e => onDescriptionChange(idx, e.target.value)}
                onFocus={() => onDescriptionFocus(idx)}
                autoComplete="off"
              />
              {itemSuggestions[idx] && itemSuggestions[idx].length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-bg-card border border-border-light rounded-lg shadow-lg z-20 overflow-hidden">
                  {itemSuggestions[idx].map((s, si) => (
                    <button
                      key={si}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-bg-alt transition-colors flex items-center justify-between gap-2"
                      onMouseDown={e => { e.preventDefault(); applyItemSuggestion(idx, s); }}
                    >
                      <span className="text-text truncate">{s.description}</span>
                      <span className="text-text-muted text-xs whitespace-nowrap shrink-0">
                        {s.unitPrice.toLocaleString('sr-Latn-RS')} RSD / {s.unit}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className={labelClass}>{t.quantity}</label>
                <input type="number" step="0.01" min="0" className={inputClass}
                  value={item.quantity || ''}
                  placeholder="1"
                  onChange={e => dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'quantity', value: parseFloat(e.target.value) || 0 })}
                  onBlur={e => { if (!e.target.value) dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'quantity', value: 1 }); }} />
              </div>
              <div>
                <label className={labelClass}>{t.unit}</label>
                <select className={inputClass} value={item.unit}
                  onChange={e => dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'unit', value: e.target.value })}>
                  <option value="kom">kom</option>
                  <option value="kg">kg</option>
                  <option value="m">m</option>
                  <option value="l">l</option>
                  <option value="h">h</option>
                  <option value="dan">dan</option>
                  <option value="km">km</option>
                  <option value="paket">paket</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t.unitPrice}</label>
                <input type="number" step="0.01" min="0" className={inputClass}
                  value={item.unitPrice || ''}
                  placeholder="0.00"
                  onChange={e => dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'unitPrice', value: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className={labelClass}>{t.vatRate}</label>
                <select className={inputClass} value={item.vatRate}
                  onChange={e => dispatch({ type: 'SET_ITEM_FIELD', index: idx, field: 'vatRate', value: parseInt(e.target.value) })}>
                  <option value="20">20%</option>
                  <option value="10">10%</option>
                  <option value="0">0%</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => dispatch({ type: 'ADD_ITEM' })}
        className="mt-3 text-primary text-sm hover:underline"
      >
        {t.addItem}
      </button>
    </div>
  );
}
