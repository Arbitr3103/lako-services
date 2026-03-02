import { useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { InvoiceData } from './types';
import { computeTotals } from './types';

interface Props {
  data: InvoiceData;
  locale: string;
}

const fmtPrice = (n: number) =>
  new Intl.NumberFormat('sr-Latn-RS', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const fmtDate = (d: string) => {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
};

const SIG_LABELS: Record<string, { issued: string; received: string; approved: string }> = {
  sr: { issued: 'Fakturisao:', received: 'Primio:', approved: 'Odobrio:' },
  en: { issued: 'Issued by:', received: 'Received by:', approved: 'Approved by:' },
  ru: { issued: 'Выставил:', received: 'Получил:', approved: 'Утвердил:' },
};

const SIG_LABELS_OTP: Record<string, { handedOver: string; received: string }> = {
  sr: { handedOver: 'Predao:', received: 'Primio:' },
  en: { handedOver: 'Handed over:', received: 'Received:' },
  ru: { handedOver: 'Передал:', received: 'Получил:' },
};

export default function InvoicePreview({ data, locale }: Props) {
  const { lineItems, subtotal, totalVat, grandTotal, vatSummary } = useMemo(
    () => computeTotals(data),
    [data]
  );

  const isOtpremnica = data.documentType === 'otpremnica';

  const qrData = useMemo(() => {
    const parts: string[] = [];
    const docLabel = isOtpremnica ? 'OTPREMNICA' : 'FAKTURA';
    parts.push(`${docLabel}: ${data.invoiceNumber || '---'}`);
    if (data.seller.pib) parts.push(`PIB: ${data.seller.pib}`);
    if (data.buyer.pib) parts.push(`KUPAC PIB: ${data.buyer.pib}`);
    if (data.issueDate) parts.push(`DATUM: ${fmtDate(data.issueDate)}`);
    parts.push(`UKUPNO: ${fmtPrice(grandTotal)} ${data.currency}`);
    if (isOtpremnica && data.vehicleRegistration) parts.push(`REG: ${data.vehicleRegistration}`);
    return parts.join('\n');
  }, [data, isOtpremnica, grandTotal]);

  const fmtDateTime = (dt: string) => {
    if (!dt) return '';
    const [date, time] = dt.split('T');
    return `${fmtDate(date)}${time ? ' ' + time : ''}`;
  };

  return (
    <div className="bg-white text-gray-900 p-8 font-serif text-[11px] leading-tight min-h-[297mm] w-full relative"
         style={{ fontFamily: "'Roboto', 'Helvetica', sans-serif" }}>
      {/* PREVIEW watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 select-none">
        <span className="text-[120px] font-bold text-gray-400 -rotate-45">PREVIEW</span>
      </div>

      {/* Header + QR */}
      <div className="relative mb-4">
        <h1 className="text-center text-xl font-bold mb-1">{isOtpremnica ? 'OTPREMNICA' : 'FAKTURA'}</h1>
        <p className="text-center text-sm font-bold">Br. {data.invoiceNumber || '___'}</p>
        {/* QR Code — right-aligned */}
        <div className="absolute top-0 right-0 flex flex-col items-center">
          <QRCodeSVG value={qrData} size={80} level="M" bgColor="#ffffff" fgColor="#000000" />
          <span className="text-[7px] text-gray-500 mt-0.5">
            {isOtpremnica ? 'PROVERA DOKUMENTA' : 'QR KOD'}
          </span>
        </div>
      </div>

      {/* Seller / Buyer */}
      <div className="flex gap-4 mb-3">
        <div className="flex-1">
          <p className="font-bold text-xs mb-1">PRODAVAC:</p>
          <p>{data.seller.name || '\u2014'}</p>
          <p>{data.seller.address || ''}</p>
          <p>PIB: {data.seller.pib || '\u2014'}</p>
          {data.seller.mb && <p>Mat. broj: {data.seller.mb}</p>}
          {!isOtpremnica && data.seller.bankAccount && <p>Ra\u010dun: {data.seller.bankAccount}</p>}
          {!isOtpremnica && data.seller.bankName && <p>Banka: {data.seller.bankName}</p>}
          {!data.seller.vatRegistered && <p className="text-gray-500 italic">Pau\u0161alac \u2014 nije u sistemu PDV</p>}
        </div>
        <div className="flex-1">
          <p className="font-bold text-xs mb-1">KUPAC:</p>
          <p>{data.buyer.name || '\u2014'}</p>
          <p>{data.buyer.address || ''}</p>
          {data.buyer.pib && <p>PIB: {data.buyer.pib}</p>}
        </div>
      </div>

      {/* Dates + Transport info */}
      {isOtpremnica ? (
        <div className="mb-3 text-[10px] space-y-0.5">
          <p>Datum izdavanja: {fmtDate(data.issueDate)}</p>
          {data.deliveryDate && <p>Datum isporuke: {fmtDate(data.deliveryDate)}</p>}
          {data.vehicleRegistration && <p className="font-bold">Reg. vozila: {data.vehicleRegistration}</p>}
          {data.transportInfo && <p>Transport: {data.transportInfo}</p>}
          {data.warehouseFrom && <p>Skladi{'\u0161'}te: {data.warehouseFrom}</p>}
          {data.loadingPlace && <p>Mesto utovara: {data.loadingPlace}</p>}
          {data.unloadingPlace && <p>Mesto istovara: {data.unloadingPlace}</p>}
          {data.loadingDateTime && <p>Datum utovara: {fmtDateTime(data.loadingDateTime)}</p>}
          {data.transportPurpose && <p>Svrha prevoza: {data.transportPurpose}</p>}
        </div>
      ) : (
        <>
          <div className="flex gap-4 mb-3 text-[10px]">
            <span>Datum fakture: {fmtDate(data.issueDate)}</span>
            {data.dueDate && <span>Datum valute: {fmtDate(data.dueDate)}</span>}
            {data.deliveryDate && <span>Datum isporuke: {fmtDate(data.deliveryDate)}</span>}
          </div>
          {data.paymentReference && (
            <p className="text-[10px] mb-3">Poziv na broj: {data.paymentReference}</p>
          )}
        </>
      )}

      {/* Items table */}
      <table className="w-full border-collapse mb-3">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-gray-300 px-1 py-0.5 text-center w-6">{'\u2116'}</th>
            <th className="border border-gray-300 px-1 py-0.5 text-left">Opis</th>
            <th className="border border-gray-300 px-1 py-0.5 text-right w-10">Kol.</th>
            <th className="border border-gray-300 px-1 py-0.5 text-center w-8">Jed.</th>
            <th className="border border-gray-300 px-1 py-0.5 text-right w-14">Cena</th>
            <th className="border border-gray-300 px-1 py-0.5 text-right w-10">PDV%</th>
            <th className="border border-gray-300 px-1 py-0.5 text-right w-14">PDV</th>
            <th className="border border-gray-300 px-1 py-0.5 text-right w-16">Ukupno</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, i) => (
            <tr key={item.id} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
              <td className="border border-gray-200 px-1 py-0.5 text-center">{i + 1}</td>
              <td className="border border-gray-200 px-1 py-0.5">{item.description || '\u2014'}</td>
              <td className="border border-gray-200 px-1 py-0.5 text-right">{fmtPrice(item.quantity)}</td>
              <td className="border border-gray-200 px-1 py-0.5 text-center">{item.unit}</td>
              <td className="border border-gray-200 px-1 py-0.5 text-right">{fmtPrice(item.unitPrice)}</td>
              <td className="border border-gray-200 px-1 py-0.5 text-right">{item.vatRate}%</td>
              <td className="border border-gray-200 px-1 py-0.5 text-right">{fmtPrice(item.vatAmount)}</td>
              <td className="border border-gray-200 px-1 py-0.5 text-right">{fmtPrice(item.totalAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* VAT Summary */}
      {data.seller.vatRegistered && vatSummary.length > 0 && (
        <div className="mb-2">
          <p className="font-bold text-[10px] mb-1">Rekapitulacija PDV:</p>
          {vatSummary.map(vs => (
            <p key={vs.rate} className="text-[10px]">
              PDV {vs.rate}%: osnovica {fmtPrice(vs.base)} {data.currency}, PDV {fmtPrice(vs.amount)} {data.currency}
            </p>
          ))}
        </div>
      )}

      {/* Totals */}
      <div className="text-right mb-3">
        <p>Osnovica: {fmtPrice(subtotal)} {data.currency}</p>
        {data.seller.vatRegistered && <p>PDV: {fmtPrice(totalVat)} {data.currency}</p>}
        <p className="text-base font-bold">UKUPNO: {fmtPrice(grandTotal)} {data.currency}</p>
      </div>

      {!data.seller.vatRegistered && (
        <p className="text-[9px] text-gray-500 mb-3">
          PDV nije obra\u010dunat \u2014 obveznik nije u sistemu PDV (pau\u0161alno oporezivanje).
        </p>
      )}

      {/* Notes */}
      {data.notes && (
        <div className="mb-3">
          <p className="font-bold text-[10px]">Napomena:</p>
          <p className="text-[10px]">{data.notes}</p>
        </div>
      )}

      {/* Signatures */}
      <div className="absolute bottom-8 left-8 right-8 flex justify-between text-[9px] text-center">
        {isOtpremnica ? (
          <>
            <div className="w-1/2">
              <p className="mb-1">{(SIG_LABELS_OTP[locale] || SIG_LABELS_OTP.sr).handedOver}</p>
              {data.handoverName && <p className="text-[8px] text-gray-500 mb-4">{data.handoverName}</p>}
              {!data.handoverName && <div className="mb-5" />}
              <div className="border-t border-gray-400 mx-4"></div>
            </div>
            <div className="w-1/2">
              <p className="mb-1">{(SIG_LABELS_OTP[locale] || SIG_LABELS_OTP.sr).received}</p>
              {data.receiverName && <p className="text-[8px] text-gray-500 mb-4">{data.receiverName}</p>}
              {!data.receiverName && <div className="mb-5" />}
              <div className="border-t border-gray-400 mx-4"></div>
            </div>
          </>
        ) : (
          <>
            <div className="w-1/3">
              <p className="mb-6">{(SIG_LABELS[locale] || SIG_LABELS.sr).issued}</p>
              <div className="border-t border-gray-400 mx-4"></div>
            </div>
            <div className="w-1/3">
              <p className="mb-6">{(SIG_LABELS[locale] || SIG_LABELS.sr).received}</p>
              <div className="border-t border-gray-400 mx-4"></div>
            </div>
            <div className="w-1/3">
              <p className="mb-6">{(SIG_LABELS[locale] || SIG_LABELS.sr).approved}</p>
              <div className="border-t border-gray-400 mx-4"></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
