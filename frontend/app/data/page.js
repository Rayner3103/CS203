"use client";
import { useEffect, useState, useCallback } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { colors } from "@/styles/colors";

export default function HeatmapPage() {
        const [tariffs, setTariffs] = useState([]);
        const [loading, setLoading] = useState(false);
        const [error, setError] = useState(null);

        const [origins, setOrigins] = useState([]);
        const [selectedOrigin, setSelectedOrigin] = useState("");
        const [mode, setMode] = useState("export"); // 'export' = tariffs from origin -> dest, 'import' = tariffs where dest == origin
        const [hideExpired, setHideExpired] = useState(false);
    const productCodeVal = (p) => p?.HTS_code ?? p?.hts_code ?? p?.htscode ?? p?.HTSCode ?? p?.code ?? p?.id ?? p?.name ?? "";
    // products list from backend (contains HTS_code and name)
    const [productsList, setProductsList] = useState([]);

    // fetch products from backend so we can show names for HTS codes
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/products`);
                if (!res.ok) return;
                const data = await res.json();
                if (Array.isArray(data)) setProductsList(data);
            } catch (e) {
                console.warn('Failed fetching products', e);
            }
        };
        fetchProducts();
    }, []);
    
    // pagination state: 20 rows per page
    const [currentPage, setCurrentPage] = useState(1);
    const rowsPerPage = 20;

    // reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedOrigin, mode, hideExpired, tariffs]);
        
        // --- caching helpers: try cookie first, fallback to localStorage ---
        const clearTariffsCache = useCallback(() => {
            document.cookie = 'tariffs_cache_v1=; path=/; max-age=0';
            try { localStorage.removeItem('tariffs_cache_v1'); } catch (e) { }
        }, []);

        const getSavedTariffs = useCallback(() => {
            try {
                // cookie name: tariffs_cache_v1
                const match = document.cookie.split('; ').find(r => r.startsWith('tariffs_cache_v1='));
                if (match) {
                    const raw = match.split('=')[1] || '';
                    if (raw) {
                        try { return JSON.parse(decodeURIComponent(raw)); } catch (e) { console.warn('Failed parsing tariffs cookie, clearing cache', e); clearTariffsCache(); }
                    }
                }
                const ls = localStorage.getItem('tariffs_cache_v1');
                if (ls) return JSON.parse(ls);
            } catch (e) {
                console.warn('getSavedTariffs error', e);
            }
            return null;
        }, [clearTariffsCache]);

        const saveTariffsToCookie = useCallback((obj) => {
            try {
                const s = JSON.stringify(obj || []);
                const enc = encodeURIComponent(s);
                // write cookie for 30 days
                document.cookie = `tariffs_cache_v1=${enc}; path=/; max-age=${30 * 24 * 60 * 60}`;
                // verify written value (cookie truncation possible)
                const back = (document.cookie.split('; ').find(r => r.startsWith('tariffs_cache_v1=')) || '').split('=')[1] || '';
                if (back && back === enc) return;
                // fallback to localStorage when cookie cannot hold payload
                localStorage.setItem('tariffs_cache_v1', s);
                console.warn('tariffs saved to localStorage because cookie was too small');
            } catch (e) {
                console.warn('saveTariffsToCookie error, falling back to localStorage', e);
                try { localStorage.setItem('tariffs_cache_v1', JSON.stringify(obj || [])); } catch (e2) { /* ignore */ }
            }
        }, []);

    // allow calling helpers from effect without listing them as deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
            setLoading(true);
            // try cache first
            const cached = getSavedTariffs();
            if (cached && Array.isArray(cached) && cached.length > 0) {
                setTariffs(cached);
                const originNames = Array.from(new Set(cached.map(t => t.originCountry?.name).filter(Boolean))).sort();
                setOrigins(originNames);
                if (originNames.length > 0) setSelectedOrigin(originNames[0]);
                setLoading(false);
                return;
            }

			// fetch from server when no cache
			const fetchFromServer = async () => {
				try {
					setError(null);
					const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tariffs`);
					if (!res.ok) throw new Error(`Status ${res.status}`);
					const data = await res.json();
					const list = data || [];
					setTariffs(list);
					const originNames = Array.from(new Set(list.map(t => t.originCountry?.name).filter(Boolean))).sort();
					setOrigins(originNames);
					if (originNames.length > 0) setSelectedOrigin(originNames[0]);
					saveTariffsToCookie(list);
				} catch (e) {
					setError(e.message || String(e));
				} finally {
					setLoading(false);
				}
			};

			fetchFromServer();
         }, []);
		
		// refresh helper used by the "Refresh cache" button
		const refreshCacheAndFetch = useCallback(async () => {
			clearTariffsCache();
			setLoading(true);
			setError(null);
			try {
				const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tariffs`);
				if (!res.ok) throw new Error(`Status ${res.status}`);
				const data = await res.json();
				const list = data || [];
				setTariffs(list);
				const originNames = Array.from(new Set(list.map(t => t.originCountry?.name).filter(Boolean))).sort();
				setOrigins(originNames);
				if (originNames.length > 0) setSelectedOrigin(originNames[0]);
				saveTariffsToCookie(list);
			} catch (e) {
				setError(e.message || String(e));
			} finally {
				setLoading(false);
			}
		}, [clearTariffsCache, saveTariffsToCookie]);
 
        // Build and download CSV for current filtered view
         const exportFilteredCSV = () => {
             if (!selectedOrigin) return;
            let filtered = tariffs.filter(t => {
                if (mode === 'export') return t.originCountry?.name === selectedOrigin;
                return t.destCountry?.name === selectedOrigin;
            });

            // if user chose to hide expired, filter them out from CSV as well
            if (hideExpired) {
                const now = Date.now();
                filtered = filtered.filter(t => {
                    const expiryRaw = t.expiryDate ?? t.endDate ?? t.validUntil ?? null;
                    if (!expiryRaw) return true; // no expiry -> consider active
                    const d = new Date(expiryRaw);
                    if (isNaN(d)) return true;
                    return d.getTime() >= now;
                });
            }

            // use same sorting as the table: by country column, active before expired, then expiry (most recent first)
            const isExpiredLocal = (t) => {
                const expiryRaw = t.expiryDate ?? t.endDate ?? t.validUntil ?? null;
                if (!expiryRaw) return false;
                const d = new Date(expiryRaw);
                if (isNaN(d)) return false;
                return d.getTime() < Date.now();
            };
            const getCountryNameLocal = (t) => (mode === 'export' ? (t.destCountry?.name ?? '') : (t.originCountry?.name ?? ''));
            const expiryTimeLocal = (t) => {
                const expiryRaw = t.expiryDate ?? t.endDate ?? t.validUntil ?? null;
                if (!expiryRaw) return Infinity;
                const d = new Date(expiryRaw);
                if (isNaN(d)) return Infinity;
                return d.getTime();
            };
            filtered = filtered.slice().sort((a, b) => {
                const aName = (getCountryNameLocal(a) || '').toLowerCase();
                const bName = (getCountryNameLocal(b) || '').toLowerCase();
                if (aName !== bName) return aName.localeCompare(bName);

                const aExp = isExpiredLocal(a);
                const bExp = isExpiredLocal(b);
                if (aExp !== bExp) return aExp ? 1 : -1; // active first

                const aTime = expiryTimeLocal(a);
                const bTime = expiryTimeLocal(b);
                if (isFinite(aTime) && isFinite(bTime)) return bTime - aTime;
                if (!isFinite(aTime) && !isFinite(bTime)) return 0;
                if (!isFinite(aTime)) return -1;
                if (!isFinite(bTime)) return 1;
                return 0;
            });

            if (!filtered.length) return;
            const rows = filtered.map(t => ({
                from: t.originCountry?.name ?? '',
                to: t.destCountry?.name ?? '',
                effectiveDate: t.effectiveDate ?? '',
                expiryDate: t.expiryDate ?? t.endDate ?? t.validUntil ?? '',
                adValoremRate: t.adValoremRate ?? '',
                specificRate: t.specificRate ?? '',
                products: (t.products || []).map(p => productCodeVal(p)).join(';')
            }));
            const header = Object.keys(rows[0]);
            const csv = [header.join(',')].concat(rows.map(r => header.map(h => `"${String(r[h] ?? '') .replace(/"/g, '""')}"`).join(','))).join('\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tariffs_${mode}_${selectedOrigin.replace(/\s+/g,'_')}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        };

		function FilteredTable({ tariffs, origin, mode }) {
            if (!origin) return <div className="text-gray-400">Select an origin country to view tariffs.</div>;
            let filtered = (tariffs || []).filter(t => mode === 'export' ? t.originCountry?.name === origin : t.destCountry?.name === origin);
            
            // helper to determine expiry (treat missing/invalid expiry as active)
            const isExpired = (t) => {
                const expiryRaw = t.expiryDate ?? t.endDate ?? t.validUntil ?? null;
                if (!expiryRaw) return false;
                const d = new Date(expiryRaw);
                if (isNaN(d)) return false;
                return d.getTime() < Date.now();
            };
            // hide expired rows when requested
            if (hideExpired) filtered = filtered.filter(t => !isExpired(t));
            
            const getCountryName = (t) => (mode === 'export' ? (t.destCountry?.name ?? '') : (t.originCountry?.name ?? ''));

            const expiryTime = (t) => {
                const expiryRaw = t.expiryDate ?? t.endDate ?? t.validUntil ?? null;
                if (!expiryRaw) return Infinity; // treat missing/invalid expiry as "far future" so it sorts as most recent
                const d = new Date(expiryRaw);
                if (isNaN(d)) return Infinity;
                return d.getTime();
            };

            // sort: by country, then active before expired, then by expiry (most recent first)
                const sorted = filtered.slice().sort((a, b) => {
                const aName = (getCountryName(a) || '').toLowerCase();
                const bName = (getCountryName(b) || '').toLowerCase();
                if (aName !== bName) return aName.localeCompare(bName);

                const aExp = isExpired(a);
                const bExp = isExpired(b);
                if (aExp !== bExp) return aExp ? 1 : -1; // active (not expired) first

                const aTime = expiryTime(a);
                const bTime = expiryTime(b);
                // both finite
                if (isFinite(aTime) && isFinite(bTime)) return bTime - aTime;
                // both infinite (no expiry) => keep stable
                if (!isFinite(aTime) && !isFinite(bTime)) return 0;
                // treat Infinity (no expiry) as most recent -> should come first
                if (!isFinite(aTime)) return -1;
                if (!isFinite(bTime)) return 1;
                return 0;
            });

            const count = sorted.length;
            const avgAd = (sorted.reduce((s, t) => s + (t.adValoremRate || 0), 0) / Math.max(1, count)).toFixed(4);
            const avgSpec = (sorted.reduce((s, t) => s + (t.specificRate || 0), 0) / Math.max(1, count)).toFixed(2);

            // pagination calculations (use local rp to avoid NaN)
            const rp = Number(rowsPerPage || 20);
            const totalPages = Math.max(1, Math.ceil(count / rp));
            const safePage = Math.min(Math.max(1, Number(currentPage || 1)), totalPages);
            const startIdx = (safePage - 1) * rp;
            const pageItems = sorted.slice(startIdx, startIdx + rp);

            return (
                <div>
                    <div className="mb-2 text-sm text-gray-300">Matches: {count} — Avg ad-valorem: {avgAd} — Avg specific: {avgSpec}</div>
                    <div className="overflow-auto">
                        <table className="min-w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th className="text-left pr-4 pb-2">{mode === 'export' ? 'Destination' : 'Origin'}</th>
                                    <th className="text-left pr-4 pb-2">Effective</th>
                                    <th className="text-left pr-4 pb-2">Expiry</th>
                                    <th className="text-left pr-4 pb-2">Ad Valorem</th>
                                    <th className="text-left pr-4 pb-2">Specific</th>
                                    <th className="text-left pr-4 pb-2">Products (HTS)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageItems.map(t => {
                                    const expiryRaw = t.expiryDate ?? t.endDate ?? t.validUntil ?? null;
                                    const expired = isExpired(t);
                                    const rowStyle = { borderTop: '1px solid rgba(255,255,255,0.05)', ...(expired ? { backgroundColor: 'rgba(255,0,0,0.06)' } : {}) };
                                    return (
                                      <tr key={t.id} style={rowStyle}>
                                        <td className="pr-4 py-2">
                                          {mode === "export"
                                            ? t.destCountry?.name ?? "-"
                                            : t.originCountry?.name ?? "-"}
                                        </td>
                                        <td className="pr-4 py-2">
                                          {t.effectiveDate ?? "-"}
                                        </td>
                                        <td className="pr-4 py-2">
                                          {expiryRaw ?? "-"}
                                        </td>
                                        <td className="pr-4 py-2">
                                          {t.adValoremRate ?? "-"}
                                        </td>
                                        <td className="pr-4 py-2">
                                          {t.specificRate ?? "-"}
                                        </td>
                                        <td className="pr-4 py-2">
                                          {(t.products || [])
                                            .map((p) => {
                                              const code = productCodeVal(p);
                                              const normalize = (q) =>
                                                q?.HTS_code ??
                                                q?.hts_code ??
                                                q?.htscode ??
                                                q?.HTSCode ??
                                                q?.code ??
                                                q?.id ??
                                                "";
                                              const found = (
                                                productsList || []
                                              ).find(
                                                (q) => normalize(q) === code
                                              );
                                              const name =
                                                p?.name ?? found?.name ?? code;
                                              return name === code
                                                ? code
                                                : `${name} (${code})`;
                                            })
                                            .slice(0, 5)
                                            .join(", ")}
                                          {(t.products || []).length > 5
                                            ? "…"
                                            : ""}
                                        </td>
                                      </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination controls */}
                    <div className="mt-3 flex items-center justify-between text-sm text-gray-300">
                        <div>
                            Showing {count === 0 ? 0 : startIdx + 1}–{Math.min(startIdx + pageItems.length, count)} of {count}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                className="px-2 py-1 bg-gray-800 text-white rounded disabled:opacity-50"
                                onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                                disabled={safePage <= 1}
                            >
                                Prev
                            </button>
                            <select
                                className="bg-black border text-white px-2 py-1 rounded"
                                value={safePage}
                                onChange={(e) => setCurrentPage(Number(e.target.value))}
                            >
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                            <button
                                className="px-2 py-1 bg-gray-800 text-white rounded disabled:opacity-50"
                                onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                                disabled={safePage >= totalPages}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

	return (
		<div style={{ backgroundColor: colors.background, color: colors.text, minHeight: "100vh" }}>
			<PageHeader />
			<div className="container mx-auto px-6 py-8">
				<h2 className="text-2xl font-bold mb-4">Tariff data preview</h2>

						{loading && <div>Loading tariffs...</div>}
						{error && <div className="text-red-400">Error: {error}</div>}

						{!loading && !error && (
							<div>
								<div className="mb-4 flex items-center gap-4">
									<label className="block font-medium">Origin country</label>
									<select
										className="border rounded px-3 py-1 bg-black text-white"
										value={selectedOrigin}
										onChange={e => setSelectedOrigin(e.target.value)}
									>
										{origins.map(o => <option key={o} value={o}>{o}</option>)}
									</select>

									<div className="ml-4 flex items-center space-x-2">
										<button
											className={`px-3 py-1 rounded ${mode === 'export' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}
											onClick={() => setMode('export')}
										>Exporting from</button>
										<button
											className={`px-3 py-1 rounded ${mode === 'import' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300'}`}
											onClick={() => setMode('import')}
										>Importing to</button>
										<label className="inline-flex items-center text-sm ml-3">
                                            <input
                                                type="checkbox"
                                                className="form-checkbox mr-2"
                                                checked={hideExpired}
                                                onChange={e => setHideExpired(e.target.checked)}
                                            />
                                            Hide expired
                                        </label>
                                    </div>

                                    <div className="ml-auto">
										<button
											className="px-3 py-1 bg-green-600 text-white rounded"
											onClick={() => exportFilteredCSV()}
											disabled={!selectedOrigin || loading}
										>Export CSV</button>
										<button
											className="ml-2 px-3 py-1 bg-yellow-500 text-black rounded"
											onClick={() => refreshCacheAndFetch()}
											disabled={loading}
											title="Clear cached tariffs (cookies/localStorage) and re-fetch from server"
										>Refresh cache</button>
									</div>
                                 </div>

								<FilteredTable tariffs={tariffs} origin={selectedOrigin} mode={mode} />
							</div>
						)}
			</div>
		</div>
	);
}

