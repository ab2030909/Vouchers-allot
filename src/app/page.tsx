'use client';

import { useState } from 'react';
import { Sparkles, Ticket, CheckCircle2, AlertCircle, Copy, ExternalLink, Loader2, ArrowRight } from 'lucide-react';

export default function ClaimPage() {
  const [name, setName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    alreadyClaimed?: boolean;
    redeemUrl?: string;
    message?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !whatsappNumber.trim()) {
      setError('Please fill in both your Name and registered WhatsApp number.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, whatsappNumber }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Unable to process voucher claim. Please verify your details.');
      } else {
        setResult({
          alreadyClaimed: data.alreadyClaimed,
          redeemUrl: data.redeemUrl,
          message: data.message,
        });
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (result?.redeemUrl) {
      navigator.clipboard.writeText(result.redeemUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto w-full">
      {/* Header Branding */}
      <div className="text-center mb-8 w-full">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-amber-500/30 text-amber-400 text-xs font-semibold tracking-wide uppercase mb-4 shadow-glow">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Hacktoberfest Islamabad 2026</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
          Kiro Voucher Claim Portal
        </h1>
        <p className="text-sm sm:text-base text-gray-300 max-w-md mx-auto leading-relaxed">
          Distributing exclusive Kiro voucher redemption links to registered Hacktoberfest Islamabad attendees.
        </p>
      </div>

      {/* Main Container */}
      <div className="w-full glass-panel rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-800 relative overflow-hidden">
        {/* Glow Accent Lines */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-cyan-400 to-purple-600" />

        {result ? (
          /* SUCCESS STATE */
          <div className="text-center py-4 space-y-6">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center mx-auto animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {result.alreadyClaimed ? 'Voucher Already Claimed' : 'Voucher Claimed Successfully!'}
              </h2>
              <p className="text-sm text-gray-300">
                {result.message || 'Here is your unique Kiro redemption link:'}
              </p>
            </div>

            {/* Voucher Card */}
            <div className="bg-slate-900/90 border border-cyan-500/30 rounded-xl p-5 text-left space-y-3 glow-cyan">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span className="flex items-center gap-1 text-cyan-400 font-medium">
                  <Ticket className="w-4 h-4" /> Kiro Redemption Link
                </span>
                <span className="text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  Assigned & Reserved
                </span>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 font-mono text-xs text-cyan-300 break-all select-all">
                {result.redeemUrl}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  onClick={handleCopyLink}
                  className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium px-4 py-2.5 rounded-lg text-sm border border-slate-700 cursor-pointer"
                >
                  <Copy className="w-4 h-4 text-cyan-400" />
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy Link'}</span>
                </button>

                <a
                  href={result.redeemUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-sm shadow-md cursor-pointer"
                >
                  <span>Redeem Now</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="text-xs text-gray-400 pt-2">
              Note: This voucher is bound to your registered phone number and cannot be reassigned.
            </div>
          </div>
        ) : (
          /* FORM STATE */
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-950/70 border border-red-500/40 rounded-xl p-4 flex items-start gap-3 text-sm text-red-200">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">{error}</div>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                Full Name (As registered)
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ali Khan"
                required
                className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm outline-none"
              />
            </div>

            <div>
              <label htmlFor="whatsapp" className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                WhatsApp Phone Number
              </label>
              <input
                id="whatsapp"
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="e.g. 03001234567 or +923001234567"
                required
                className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm outline-none font-mono"
              />
              <p className="text-xs text-gray-400 mt-1.5">
                Must match the WhatsApp number used during event registration.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-slate-950 font-bold py-3.5 px-6 rounded-xl text-base shadow-glow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-4"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Verifying & Allocating Voucher...</span>
                </>
              ) : (
                <>
                  <span>Claim My Voucher</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Organizer Login Link */}
      <footer className="mt-8 text-center text-xs text-gray-400">
        <a href="/admin/login" className="hover:text-amber-400 transition-colors">
          Organizer Login Portal
        </a>
      </footer>
    </main>
  );
}
