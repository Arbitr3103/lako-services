import { useState, useEffect } from 'react';

import sr from '../../i18n/sr.json';
import en from '../../i18n/en.json';
import ru from '../../i18n/ru.json';

interface Props {
  locale: 'sr' | 'en' | 'ru';
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calcTimeLeft(targetDate: string): TimeLeft {
  const diff = new Date(targetDate).getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export default function ExpoCountdown({ locale }: Props) {
  const t = { sr, en, ru }[locale].logistics.countdown;
  const [time, setTime] = useState<TimeLeft>(calcTimeLeft(t.date));

  useEffect(() => {
    const id = setInterval(() => setTime(calcTimeLeft(t.date)), 1000);
    return () => clearInterval(id);
  }, [t.date]);

  const units: { value: number; label: string }[] = [
    { value: time.days, label: t.days },
    { value: time.hours, label: t.hours },
    { value: time.minutes, label: t.minutes },
    { value: time.seconds, label: t.seconds },
  ];

  return (
    <div>
      {/* Countdown timer */}
      <div className="flex justify-center gap-4 sm:gap-6 mb-12">
        {units.map((u) => (
          <div key={u.label} className="flex flex-col items-center">
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-bg-card border border-border rounded-xl flex items-center justify-center overflow-hidden">
              <span
                key={u.value}
                className="text-2xl sm:text-3xl font-bold text-accent tabular-nums countdown-flip"
              >
                {String(u.value).padStart(2, '0')}
              </span>
            </div>
            <span className="text-xs sm:text-sm text-text-light mt-2">{u.label}</span>
          </div>
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
        {t.stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-bg-card border border-border rounded-xl p-6 text-center hover:border-primary transition-colors"
          >
            <div className="text-3xl sm:text-4xl font-bold text-primary mb-2">{stat.value}</div>
            <div className="text-sm text-text-light">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
