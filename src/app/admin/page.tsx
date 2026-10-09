'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Ticket,
  CheckCircle,
  Clock,
  Search,
  Download,
  Upload,
  LogOut,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  FileSpreadsheet,
  Check,
  X
} from 'lucide-react';

interface Stats {
  totalAttendees: number;
  totalVouchers: number;
  claimedVouchers: number;
  remainingVouchers: number;
  eligibleUnclaimedAttendees: number;
}

interface ClaimRecord {
  claim_id: string;
  claimed_at: string;
  ip_address: string;
  attendee_id: string;
  attendee_name: string;
  whatsapp_number: string;
  voucher_id: string;
  redeem_url: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [revokingClaim, setRevokingClaim] = useState<ClaimRecord | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeLoading, setRevokeLoading] = useState(false);

  // CSV Import States
  const [importType, setImportType] = useState<'attendees' | 'vouchers' | null>(null);
  const [csvText, setCsvText] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importSummary, setImportSummary] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const queryParam = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/admin/stats${queryParam}`);
      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setClaims(data.claims);
      }
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    } finally {
      setLoading(false);
    }
  }, [search, router]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  const handleExportCSV = () => {
    window.open('/api/admin/export-claims', '_blank');
  };

  const handleRevokeSubmit = async () => {
    if (!revokingClaim) return;
    setRevokeLoading(true);
    try {
      const res = await fetch('/api/admin/revoke-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId: revokingClaim.claim_id,
          reason: revokeReason || 'Organizer manual revocation',
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRevokingClaim(null);
        setRevokeReason('');
        fetchStats();
      } else {
        alert(data.message || 'Failed to revoke claim.');
      }
    } catch (e) {
      alert('Error connecting to server.');
    } finally {
      setRevokeLoading(false);
    }
  };

  const handleCsvImportSubmit = async () => {
    if (!csvText.trim() || !importType) return;
    setImportLoading(true);
    setImportError(null);
    setImportSummary(null);

    const endpoint = importType === 'attendees' ? '/api/admin/import-attendees' : '/api/admin/import-vouchers';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText }),
      });

      const data = await res.json();
      if (!res.ok) {
        setImportError(data.message || 'Import failed.');
        if (data.summary) setImportSummary(data.summary);
      } else {
        setImportSummary(data.summary);
        fetchStats();
      }
    } catch (e) {
      setImportError('Network error during import.');
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-gray-100 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
      {/* Dashboard Top Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Hacktoberfest Islamabad 2026</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Organizer Dashboard</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchStats()}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-gray-200 px-3.5 py-2 rounded-xl text-xs font-medium border border-slate-700 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 bg-red-950/80 hover:bg-red-900/80 text-red-200 px-3.5 py-2 rounded-xl text-xs font-medium border border-red-500/30 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 py-6">
        <div className="glass-panel rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-2">
            <span>Registered Attendees</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats?.totalAttendees ?? '-'}</div>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-2">
            <span>Imported Vouchers</span>
            <Ticket className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white">{stats?.totalVouchers ?? '-'}</div>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-2">
            <span>Claimed Vouchers</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">{stats?.claimedVouchers ?? '-'}</div>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-slate-800">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-2">
            <span>Remaining Vouchers</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">{stats?.remainingVouchers ?? '-'}</div>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-slate-800 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-gray-400 text-xs font-medium mb-2">
            <span>Unclaimed Eligible</span>
            <Users className="w-4 h-4 text-gray-400" />
          </div>
          <div className="text-2xl font-bold text-gray-200">{stats?.eligibleUnclaimedAttendees ?? '-'}</div>
        </div>
      </div>

      {/* CSV Import Toolbar */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800 mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white mb-1">Spreadsheet Data Import</h2>
          <p className="text-xs text-gray-400">Import attendee registrations or Kiro voucher redemption links via UTF-8 CSV.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setImportType('attendees');
              setCsvText('');
              setImportSummary(null);
              setImportError(null);
            }}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Import Attendees CSV</span>
          </button>

          <button
            onClick={() => {
              setImportType('vouchers');
              setCsvText('');
              setImportSummary(null);
              setImportError(null);
            }}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Import Vouchers CSV</span>
          </button>
        </div>
      </div>

      {/* Claim History Section */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex-1 flex flex-col">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-white">Voucher Claim History</h2>
            <p className="text-xs text-gray-400">Live records of all claimed Kiro vouchers and attendee allocations.</p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or phone..."
                className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl pl-9 pr-3 py-2 text-white text-xs outline-none"
              />
            </div>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/30 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Claims CSV</span>
            </button>
          </div>
        </div>

        {/* Claims Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-slate-900/90 text-gray-400 uppercase font-mono border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Attendee Name</th>
                <th className="px-4 py-3">WhatsApp Number</th>
                <th className="px-4 py-3">Assigned Voucher Link</th>
                <th className="px-4 py-3">Claimed At (UTC)</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400 font-sans">
                    Loading claim records...
                  </td>
                </tr>
              ) : claims.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500 font-sans">
                    No claim records found.
                  </td>
                </tr>
              ) : (
                claims.map((claim) => (
                  <tr key={claim.claim_id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-sans font-medium text-white">{claim.attendee_name}</td>
                    <td className="px-4 py-3 text-cyan-300">+{claim.whatsapp_number}</td>
                    <td className="px-4 py-3 text-gray-300 truncate max-w-xs" title={claim.redeem_url}>
                      <a href={claim.redeem_url} target="_blank" rel="noopener noreferrer" className="hover:underline text-amber-400">
                        {claim.redeem_url}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(claim.claimed_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setRevokingClaim(claim)}
                        className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 bg-red-950/50 hover:bg-red-900/50 px-2.5 py-1 rounded border border-red-500/20 text-xs cursor-pointer font-sans"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Revoke</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV IMPORT MODAL */}
      {importType && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel rounded-2xl p-6 max-w-2xl w-full border border-slate-700 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-amber-400" />
                <span>Import {importType === 'attendees' ? 'Attendees' : 'Kiro Vouchers'} CSV</span>
              </h3>
              <button onClick={() => setImportType(null)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-gray-300">
                Paste raw UTF-8 CSV content below (including header line).
              </p>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs font-mono text-gray-400">
                {importType === 'attendees'
                  ? 'Format: name,whatsapp_number\nExample:\nAli Khan,03001234567\nSara Ahmed,+923011234567'
                  : 'Format: redeem_url\nExample:\nhttps://kiro.dev/redeem/abc123\nhttps://kiro.dev/redeem/xyz789'}
              </div>

              <textarea
                rows={8}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="Paste CSV text here..."
                className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-xl p-3 text-xs font-mono text-white outline-none"
              />

              {importError && (
                <div className="bg-red-950/80 border border-red-500/40 p-3 rounded-xl text-xs text-red-200">
                  {importError}
                </div>
              )}

              {importSummary && (
                <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-2 text-xs">
                  <div className="font-bold text-white flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Import Completed</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center py-2 bg-slate-950 rounded-lg font-mono">
                    <div>
                      <div className="text-gray-400">Total Rows</div>
                      <div className="text-base font-bold text-white">{importSummary.totalRows}</div>
                    </div>
                    <div>
                      <div className="text-emerald-400">Imported</div>
                      <div className="text-base font-bold text-emerald-400">{importSummary.importedCount}</div>
                    </div>
                    <div>
                      <div className="text-amber-400">Skipped</div>
                      <div className="text-base font-bold text-amber-400">{importSummary.skippedCount}</div>
                    </div>
                  </div>

                  {importSummary.validationErrors?.length > 0 && (
                    <div className="pt-2">
                      <div className="text-red-400 font-semibold mb-1">Validation Errors ({importSummary.validationErrors.length}):</div>
                      <div className="max-h-32 overflow-y-auto space-y-1 font-mono text-[11px] bg-slate-950 p-2 rounded">
                        {importSummary.validationErrors.map((err: any, idx: number) => (
                          <div key={idx} className="text-red-300">
                            Row {err.rowNumber}: {err.error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setImportType(null)}
                className="bg-slate-800 hover:bg-slate-700 text-gray-300 px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleCsvImportSubmit}
                disabled={importLoading || !csvText.trim()}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs disabled:opacity-50 cursor-pointer"
              >
                {importLoading ? 'Processing Import...' : 'Execute CSV Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVOKE CLAIM MODAL */}
      {revokingClaim && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel rounded-2xl p-6 max-w-md w-full border border-red-500/40 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-white">Revoke Voucher Claim</h3>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to revoke the claim for{' '}
              <strong className="text-white">{revokingClaim.attendee_name}</strong> (+{revokingClaim.whatsapp_number})?
            </p>
            <p className="text-xs text-amber-400 bg-amber-950/50 p-2.5 rounded-lg border border-amber-500/30">
              Warning: Revoking this claim will return the voucher link back to the available inventory pool. An audit event will be recorded.
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Reason for Revocation</label>
              <input
                type="text"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g. Assigned to incorrect number"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRevokingClaim(null)}
                className="bg-slate-800 hover:bg-slate-700 text-gray-300 px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRevokeSubmit}
                disabled={revokeLoading}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 rounded-xl text-xs disabled:opacity-50 cursor-pointer"
              >
                {revokeLoading ? 'Revoking...' : 'Confirm Revocation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
