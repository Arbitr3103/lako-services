import { useState } from 'react';

import sr from '../../i18n/sr.json';
import en from '../../i18n/en.json';
import ru from '../../i18n/ru.json';

interface Props {
  locale: 'sr' | 'en' | 'ru';
}

export default function SavingsCalculator({ locale }: Props) {
  const t = { sr, en, ru }[locale].logistics.calculator;
  const [vehicles, setVehicles] = useState(10);
  const [dispatchers, setDispatchers] = useState(2);

  const hoursSaved = dispatchers * 15;
  const costReduction = 40;
  const capacityIncrease = Math.round((vehicles * 60) / 100);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Sliders */}
      <div className="space-y-8 mb-10">
        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-text font-medium">{t.vehicles}</label>
            <span className="text-2xl font-bold text-primary tabular-nums">{vehicles}</span>
          </div>
          <input
            type="range"
            min={1}
            max={50}
            value={vehicles}
            onChange={(e) => setVehicles(Number(e.target.value))}
            className="w-full h-2 bg-bg-card rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-xs text-text-muted mt-1">
            <span>1</span>
            <span>50</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-3">
            <label className="text-text font-medium">{t.dispatchers}</label>
            <span className="text-2xl font-bold text-primary tabular-nums">{dispatchers}</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={dispatchers}
            onChange={(e) => setDispatchers(Number(e.target.value))}
            className="w-full h-2 bg-bg-card rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <div className="flex justify-between text-xs text-text-muted mt-1">
            <span>1</span>
            <span>10</span>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="bg-bg-card border border-border rounded-2xl p-8">
        <h3 className="text-xl font-semibold text-text mb-6 text-center">{t.results.title}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-bold text-accent mb-1 tabular-nums">
              {hoursSaved}
            </div>
            <div className="text-sm text-text-light">{t.results.hoursWeek}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-bold text-accent mb-1 tabular-nums">
              {costReduction}%
            </div>
            <div className="text-sm text-text-light">{t.results.costReduction}</div>
          </div>
          <div className="text-center">
            <div className="text-3xl sm:text-4xl font-bold text-accent mb-1 tabular-nums">
              {capacityIncrease}%
            </div>
            <div className="text-sm text-text-light">{t.results.capacityIncrease}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
