"use client";
import { useEffect, useState, useCallback } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { colors } from "@/styles/colors";
import { apiFetch } from "@/utils/apiClient";

export default function HeatmapPage() {
  const [tariffs, setTariffs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [origins, setOrigins] = useState([]);
  const [selectedOrigin, setSelectedOrigin] = useState("");
  const [mode, setMode] = useState("export"); // 'export' = tariffs from origin -> dest, 'import' = tariffs where dest == origin
  const [hideExpired, setHideExpired] = useState(false);

  // form / CRUD state
  const [showForm, setShowForm] = useState(false);
  const [editingTariff, setEditingTariff] = useState(null); // null = create
  const [formState, setFormState] = useState({
    origin: "",
    dest: "",
    effectiveDate: "",
    expiryDate: "",
    adValoremRate: "",
    specificRate: "",
    productsRaw: "",
    productsSelected: [], // new: array of selected product codes
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});


  // helper: backend may represent countries as either a plain string or an object { name }
  const countryNameVal = (c) => (typeof c === "string" ? c : c?.name ?? "");
  // helper: map a displayed country name to its code using countriesList
  const countryCodeForName = (n) => {
    if (!n) return null;
    if (!countriesList || !countriesList.length) return n;
    const found = countriesList.find(
      (c) => (c?.name || "").toLowerCase() === String(n).toLowerCase()
    );
    if (found && found.code) return found.code;
    // maybe the user already selected a code (value is code) — check by code
    const foundByCode = countriesList.find((c) => String(c.code) === String(n));
    if (foundByCode) return foundByCode.code;
    return n;
  };
  // helper: normalize product HTS code field names
  const productCodeVal = (p) =>
    p?.HTS_code ?? p?.hts_code ?? p?.htscode ?? p?.HTSCode ?? p?.code ?? p?.id ?? "";

  // --- caching helpers: try cookie first, fallback to localStorage ---
  const clearTariffsCache = useCallback(() => {
    document.cookie = "tariffs_cache_v1=; path=/; max-age=0";
    try {
      localStorage.removeItem("tariffs_cache_v1");
    } catch (e) {}
  }, []);

  const getSavedTariffs = useCallback(() => {
    try {
      // cookie name: tariffs_cache_v1
      const match = document.cookie
        .split("; ")
        .find((r) => r.startsWith("tariffs_cache_v1="));
      if (match) {
        const raw = match.split("=")[1] || "";
        if (raw) {
          try {
            return JSON.parse(decodeURIComponent(raw));
          } catch (e) {
            console.warn("Failed parsing tariffs cookie, clearing cache", e);
            clearTariffsCache();
          }
        }
      }
      const ls = localStorage.getItem("tariffs_cache_v1");
      if (ls) return JSON.parse(ls);
    } catch (e) {
      console.warn("getSavedTariffs error", e);
    }
    return null;
  }, [clearTariffsCache]);

  const saveTariffsToCookie = useCallback((obj) => {
    try {
      const s = JSON.stringify(obj || []);
      const enc = encodeURIComponent(s);
      // write cookie for 30 days
      document.cookie = `tariffs_cache_v1=${enc}; path=/; max-age=${
        30 * 24 * 60 * 60
      }`;
      // verify written value (cookie truncation possible)
      const back =
        (
          document.cookie
            .split("; ")
            .find((r) => r.startsWith("tariffs_cache_v1=")) || ""
        ).split("=")[1] || "";
      if (back && back === enc) return;
      // fallback to localStorage when cookie cannot hold payload
      localStorage.setItem("tariffs_cache_v1", s);
      console.warn(
        "tariffs saved to localStorage because cookie was too small"
      );
    } catch (e) {
      console.warn(
        "saveTariffsToCookie error, falling back to localStorage",
        e
      );
      try {
        localStorage.setItem("tariffs_cache_v1", JSON.stringify(obj || []));
      } catch (e2) {
        /* ignore */
      }
    }
  }, []);

  // products list from backend (contains HTS_code and name)
  const [productsList, setProductsList] = useState([]);
  // countries list from backend (code + name)
  const [countriesList, setCountriesList] = useState([]);

  // fetch products from backend so we can show names and HTS codes
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await apiFetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/products`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) setProductsList(data);
      } catch (e) {
        console.warn("Failed fetching products", e);
      }
    };
    fetchProducts();
  }, []);

  // fetch countries (code + name) to map names to codes for POST payloads
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await apiFetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/countries`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) setCountriesList(data);
      } catch (e) {
        console.warn("Failed fetching countries", e);
      }
    };
    fetchCountries();
  }, []);

  // allow calling helpers from effect without listing them as deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setLoading(true);
    // try cache first
    const cached = getSavedTariffs();
    if (cached && Array.isArray(cached) && cached.length > 0) {
      setTariffs(cached);
      const originNames = Array.from(
        new Set(cached.map((t) => countryNameVal(t.originCountry)).filter(Boolean))
      ).sort();
      setOrigins(originNames);
      if (originNames.length > 0) setSelectedOrigin(originNames[0]);
      setLoading(false);
      return;
    }

    // fetch from server when no cache
    const fetchFromServer = async () => {
      try {
        setError(null);
        const res = await apiFetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tariffs`
        );
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        const list = data || [];
        setTariffs(list);
        const originNames = Array.from(
          new Set(list.map((t) => countryNameVal(t.originCountry)).filter(Boolean))
        ).sort();
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
      const res = await apiFetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tariffs`
      );
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      const list = data || [];
      setTariffs(list);
      const originNames = Array.from(
        new Set(list.map((t) => countryNameVal(t.originCountry)).filter(Boolean))
      ).sort();
      setOrigins(originNames);
      if (originNames.length > 0) setSelectedOrigin(originNames[0]);
      saveTariffsToCookie(list);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [clearTariffsCache, saveTariffsToCookie]);

  // --- CRUD helpers ---

  const openCreateForm = () => {
    setEditingTariff(null);
    setFormError(null);
    setFieldErrors({});
    setFormState({
      origin: selectedOrigin || "",
      dest: "",
      effectiveDate: "",
      expiryDate: "",
      adValoremRate: "",
      specificRate: "",
      productsRaw: "",
      productsSelected: [],
    });
    setShowForm(true);
  };

  const openEditForm = (t) => {
    setEditingTariff(t);
    setFormError(null);
    setFieldErrors({});
    const productCodes = (t.products || [])
      .map((p) => productCodeVal(p))
      .filter(Boolean);
    setFormState({
      origin: countryNameVal(t.originCountry),
      dest: countryNameVal(t.destCountry),
      effectiveDate: t.effectiveDate ?? "",
      expiryDate: t.expiryDate ?? t.endDate ?? t.validUntil ?? "",
      adValoremRate: t.adValoremRate ?? "",
      specificRate: t.specificRate ?? "",
      productsRaw: productCodes.join(", "),
      productsSelected: productCodes,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTariff(null);
    setFormError(null);
  };

  const submitForm = async (e) => {
    e && e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    // basic validation
    if (!formState.origin || !formState.dest) {
      setFormError("Origin and destination are required.");
      return;
    }

    // prefer selected products array; fallback to productsRaw string (comma separated)
    const selectedProducts =
      (formState.productsSelected && formState.productsSelected.slice()) ||
      (formState.productsRaw || "")
        .split(/[,;]+/)
        .map((s) => s.trim())
        .filter(Boolean);

    // numeric parsing
    const adValoremNum =
      formState.adValoremRate === "" || formState.adValoremRate == null
        ? null
        : Number(formState.adValoremRate);
    const specificNum =
      formState.specificRate === "" || formState.specificRate == null
        ? null
        : Number(formState.specificRate);

    // construct rate: user now enters the ad-valorem as a decimal (e.g. 0.12)
    const rateVal = adValoremNum == null ? null : adValoremNum;

  // hts code top-level (first selected product) — prefer first selection
  const topHts = selectedProducts && selectedProducts.length ? selectedProducts[0] : null;

  // treat empty expiry as null (send null when user left expiry blank)
  let eff = (formState.effectiveDate || "").trim();
  let exp = (formState.expiryDate || "").trim();
 

    // find product name for each selected code (use productOptions if available)
    const productsPayload = (selectedProducts || []).map((code) => {
      const found = (productOptions || []).find(
        (p) => (p.code && p.code === code) || (p.name && p.name === code)
      );
      return {
        name: found?.name ?? code,
        description: "Admin added",
        enabled: true,
      };
    });

    // Build payloads for create vs update. Backend update expects nested country objects and full product objects.
    const createPayload = {
      originCountry: countryCodeForName(formState.origin) || formState.origin,
      destCountry: countryCodeForName(formState.dest) || formState.dest,
      effectiveDate: eff || null,
      expiryDate: exp || null,
      rate: rateVal,
      enabled: true,
      // specificRate stored as provided (absolute amount)
      specificRate: specificNum === null ? 0 : specificNum,
      htscode: topHts || null,
      products: productsPayload,
    };

    // For updates, construct object with nested country objects and richer product/user objects
    const resolveCountryObj = (val, existing) => {
      // val may be a display name or code; existing may be an object from the fetched tariff
      let code = countryCodeForName(val) || val;
      // if still falsy, try existing object's code/name
      if (!code && existing) code = existing.code || existing;
      const name = (countriesList || []).find((c) => String(c.code) === String(code))?.name || (typeof existing === "object" ? existing?.name : val) || String(code || "");
      return { code: String(code || ""), name };
    };

    const arbitraryMin = 1; // arbitrary numbers as requested
    const arbitraryMax = 9007199254740991; // JS MAX_SAFE_INTEGER-ish large number

    const updatePayload = {
      id: editingTariff?.id,
      effectiveDate: eff || editingTariff?.effectiveDate || null,
      expiryDate: exp || editingTariff?.expiryDate || null,
      // keep adValoremRate key for update (backend expects adValoremRate on Tariff update path)
      adValoremRate: rateVal != null ? rateVal : editingTariff?.adValoremRate ?? null,
      specificRate: specificNum === null ? (editingTariff?.specificRate ?? 0) : specificNum,
      minQuantity: editingTariff?.minQuantity ?? arbitraryMin,
      maxQuantity: editingTariff?.maxQuantity ?? arbitraryMax,
      userDefined: editingTariff?.userDefined ?? true,
      originCountry: resolveCountryObj(formState.origin, editingTariff?.originCountry),
      destCountry: resolveCountryObj(formState.dest, editingTariff?.destCountry),
      products: (selectedProducts || []).map((code) => {
        const found = (productOptions || []).find((p) => (p.code && p.code === code) || (p.name && p.name === code));
        return {
          name: found?.name ?? code,
          description: found?.description ?? "Admin added",
          enabled: found?.enabled ?? true,
          hts_code: found?.code ?? code,
        };
      }),
      users: (editingTariff?.users || []).map((u) => ({
        email: u?.email || "",
        role: u?.role || "",
      })),
    };

    try {
      // debug: log whether we're creating or updating and show payload
      // (kept as console.debug so it doesn't clutter production logs)
      console.debug("submitForm: editingTariff=", editingTariff);
      console.debug("submitForm: formState=", formState);
      setIsSaving(true);
      const base = `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tariffs`;
      let res;
      if (editingTariff && editingTariff.id) {
        console.debug("submitForm: updating (PUT)", updatePayload);
        res = await apiFetch(`${base}/${editingTariff.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatePayload),
        });
      } else {
        console.debug("submitForm: creating (POST)", createPayload);
        console.debug("submitForm: payload JSON", JSON.stringify(createPayload));
        res = await apiFetch(base, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        });
        console.debug("submitForm: POST request sent to", base);
      }
      if (!res.ok) {
        // try to parse JSON body for validation errors
        let body = null;
        try {
          body = await res.json();
        } catch (e) {
          // not JSON
        }
        if (body && typeof body === "object") {
          // If the server returns a map of field->message, surface it
          setFieldErrors(body);
          const joined = Object.entries(body)
            .map(([k, v]) => `${k}: ${v}`)
            .join("; ");
          setFormError(joined || `Status ${res.status}`);
        } else {
          const txt = await res.text().catch(() => null);
          const msg = txt || `Status ${res.status}`;
          console.error("submitForm: server error:", msg);
          setFormError(msg);
        }
        setIsSaving(false);
        return;
      }
      const saved = await res.json().catch(() => null);

      // update local state: if backend returned saved object, merge; else refetch
      if (saved && saved.id) {
        const next = tariffs.slice();
        if (editingTariff && editingTariff.id) {
          const idx = next.findIndex((x) => x.id === editingTariff.id);
          if (idx >= 0) next[idx] = saved;
        } else {
          next.unshift(saved);
        }
        setTariffs(next);
        const originNames = Array.from(
          new Set(next.map((t) => countryNameVal(t.originCountry)).filter(Boolean))
        ).sort();
        setOrigins(originNames);
        if (!selectedOrigin && originNames.length) setSelectedOrigin(originNames[0]);
        saveTariffsToCookie(next);
      } else {
        // fallback: refresh from server
        await refreshCacheAndFetch();
      }

      closeForm();
    } catch (err) {
      setFormError(err.message || String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTariff = async (t) => {
    if (!t?.id) return;
    if (!confirm("Delete this tariff? This cannot be undone.")) return;
    try {
      setLoading(true);
      // request permanent delete (softDelete=false) so the row is removed from DB
      const res = await apiFetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tariffs/${t.id}?softDelete=false`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const next = tariffs.filter((x) => x.id !== t.id);
      setTariffs(next);
      const originNames = Array.from(
        new Set(next.map((x) => countryNameVal(x.originCountry)).filter(Boolean))
      ).sort();
      setOrigins(originNames);
      if (selectedOrigin && !originNames.includes(selectedOrigin)) {
        setSelectedOrigin(originNames[0] ?? "");
      }
      saveTariffsToCookie(next);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  // Build and download CSV for current filtered view
  const exportFilteredCSV = () => {
    if (!selectedOrigin) return;
    let filtered = tariffs.filter((t) => {
      if (mode === "export") return countryNameVal(t.originCountry) === selectedOrigin;
      return countryNameVal(t.destCountry) === selectedOrigin;
    });

    // if user chose to hide expired, filter them out from CSV as well
    if (hideExpired) {
      const now = Date.now();
      filtered = filtered.filter((t) => {
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
    const getCountryNameLocal = (t) =>
      mode === "export" ? countryNameVal(t.destCountry) : countryNameVal(t.originCountry);
    const expiryTimeLocal = (t) => {
      const expiryRaw = t.expiryDate ?? t.endDate ?? t.validUntil ?? null;
      if (!expiryRaw) return Infinity;
      const d = new Date(expiryRaw);
      if (isNaN(d)) return Infinity;
      return d.getTime();
    };
    filtered = filtered.slice().sort((a, b) => {
      const aName = (getCountryNameLocal(a) || "").toLowerCase();
      const bName = (getCountryNameLocal(b) || "").toLowerCase();
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
    const rows = filtered.map((t) => ({
      from: countryNameVal(t.originCountry) ?? "",
      to: countryNameVal(t.destCountry) ?? "",
      effectiveDate: t.effectiveDate ?? "",
      expiryDate: t.expiryDate ?? t.endDate ?? t.validUntil ?? "",
      // adValoremRate stored in DB as decimal (e.g. 0.1) -> export as percentage (10.0)
  adValoremRate: t.adValoremRate == null ? "" : Number(t.adValoremRate).toFixed(4),
      specificRate: t.specificRate ?? "",
      products: (t.products || [])
        .map((p) => productCodeVal(p))
        .join(";"),
    }));
    const header = Object.keys(rows[0]);
    const csv = [header.join(",")]
      .concat(
        rows.map((r) =>
          header
            .map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`)
            .join(",")
        )
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tariffs_${mode}_${selectedOrigin.replace(/\s+/g, "_")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  function FilteredTable({ tariffs, origin, mode, currentPage, setCurrentPage, rowsPerPage }) {
    if (!origin)
      return (
        <div className="text-gray-400">
          Select an origin country to view tariffs.
        </div>
      );
    let filtered = (tariffs || []).filter((t) =>
      mode === "export"
        ? countryNameVal(t.originCountry) === origin
        : countryNameVal(t.destCountry) === origin
    );

    // helper to determine expiry (treat missing/invalid expiry as active)
    const isExpired = (t) => {
      const expiryRaw = t.expiryDate ?? t.endDate ?? t.validUntil ?? null;
      if (!expiryRaw) return false;
      const d = new Date(expiryRaw);
      if (isNaN(d)) return false;
      return d.getTime() < Date.now();
    };
    // hide expired rows when requested
    if (hideExpired) filtered = filtered.filter((t) => !isExpired(t));

    const getCountryName = (t) =>
      mode === "export" ? countryNameVal(t.destCountry) : countryNameVal(t.originCountry);

    const expiryTime = (t) => {
      const expiryRaw = t.expiryDate ?? t.endDate ?? t.validUntil ?? null;
      if (!expiryRaw) return Infinity; // treat missing/invalid expiry as "far future" so it sorts as most recent
      const d = new Date(expiryRaw);
      if (isNaN(d)) return Infinity;
      return d.getTime();
    };

    // sort: by country, then active before expired, then by expiry (most recent first)
    const sorted = filtered.slice().sort((a, b) => {
      const aName = (getCountryName(a) || "").toLowerCase();
      const bName = (getCountryName(b) || "").toLowerCase();
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
    const avgAd = (
      sorted.reduce((s, t) => s + (t.adValoremRate || 0), 0) / Math.max(1, count)
    ).toFixed(4);
    const avgSpec = (
      sorted.reduce((s, t) => s + (t.specificRate || 0), 0) / Math.max(1, count)
    ).toFixed(2);

    // pagination calculations (use local fallback for rowsPerPage)
    const rp = Number(rowsPerPage || 20);
    const totalPages = Math.max(1, Math.ceil(count / rp));
    const safePage = Math.min(Math.max(1, Number(currentPage || 1)), totalPages);
    const startIdx = (safePage - 1) * rp;
    const pageItems = sorted.slice(startIdx, startIdx + rp);
    return (
      <div>
        <div className="mb-2 text-sm text-gray-300">
          Matches: {count} — Avg ad-valorem: {avgAd}% — Avg specific: {avgSpec}
        </div>
        <div className="overflow-auto">
          <table
            className="min-w-full text-sm"
            style={{ borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <th className="text-left pr-4 pb-2">
                  {mode === "export" ? "Destination" : "Origin"}
                </th>
                <th className="text-left pr-4 pb-2">Effective</th>
                <th className="text-left pr-4 pb-2">Expiry</th>
                <th className="text-left pr-4 pb-2">Ad Valorem</th>
                <th className="text-left pr-4 pb-2">Specific</th>
                <th className="text-left pr-4 pb-2">Products (HTS)</th>
                <th className="text-right pr-4 pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((t) => {
                const expiryRaw =
                  t.expiryDate ?? t.endDate ?? t.validUntil ?? null;
                const expired = isExpired(t);
                const rowStyle = {
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  ...(expired ? { backgroundColor: "rgba(255,0,0,0.06)" } : {}),
                };
                return (
                  <tr key={t.id} style={rowStyle}>
                    <td className="pr-4 py-2">
                      {mode === "export"
                        ? countryNameVal(t.destCountry) || "-"
                        : countryNameVal(t.originCountry) || "-"}
                    </td>
                    <td className="pr-4 py-2">{t.effectiveDate ?? "-"}</td>
                    <td className="pr-4 py-2">{expiryRaw ?? "-"}</td>
                    <td className="pr-4 py-2">{t.adValoremRate != null ? Number(t.adValoremRate).toFixed(4) : "-"}</td>
                    <td className="pr-4 py-2">{t.specificRate ?? "-"}</td>
                    <td className="pr-4 py-2">
                      {(t.products || [])
                        .map((p) => {
                          const code = productCodeVal(p);
                          const normalize = (q) =>
                            q?.HTS_code ?? q?.hts_code ?? q?.htscode ?? q?.HTSCode ?? q?.code ?? q?.id ?? "";
                          const found = (productsList || []).find((q) => normalize(q) === code);
                          const name = p?.name ?? found?.name ?? code;
                          return name === code ? code : `${name} (${code})`;
                        })
                        .slice(0, 5)
                        .join(", ")}
                      {(t.products || []).length > 5 ? "…" : ""}
                    </td>
                    <td className="pr-4 py-2 text-right">
                      <button
                        className="mr-2 px-2 py-1 bg-blue-600 text-white rounded text-xs"
                        onClick={() => openEditForm(t)}
                      >
                        Edit
                      </button>
                      <button
                        className="px-2 py-1 bg-red-600 text-white rounded text-xs"
                        onClick={() => deleteTariff(t)}
                      >
                        Delete
                      </button>
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
                <option key={p} value={p}>
                  {p}
                </option>
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

  // prepare dropdown options for countries and products
  const destinationNames = Array.from(
    new Set(tariffs.map((t) => countryNameVal(t.destCountry)).filter(Boolean))
  ).sort();

  // product options sourced from backend productsList (HTS_code and name)
  const productOptions = (productsList || [])
    .map((p) => {
      // normalize possible HTS code property names returned by backend
      const code = p?.HTS_code ?? p?.hts_code ?? p?.htscode ?? p?.HTSCode ?? p?.code ?? p?.id ?? "";
      const name = p?.name ?? p?.productName ?? p?.label ?? code;
      return { code, name, description: p?.description, enabled: p?.enabled };
    })
    // ensure selected values are present in the list (keep them even if backend list doesn't include them)
    .concat(
      (formState.productsSelected || [])
        .filter((s) => !(productsList || []).some((p) => (p?.HTS_code ?? p?.hts_code ?? p?.htscode ?? p?.HTSCode ?? p?.code ?? p?.id) === s))
        .map((code) => ({ code, name: code }))
    )
    .filter((x) => x && (x.code || x.name));

  // pagination state: 20 rows per page
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  // reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedOrigin, mode, hideExpired, tariffs]);

  return (
    <div
      style={{
        backgroundColor: colors.background,
        color: colors.text,
        minHeight: "100vh",
      }}
    >
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
                onChange={(e) => setSelectedOrigin(e.target.value)}
              >
                {origins.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>

              <div className="ml-4 flex items-center space-x-2">
                <button
                  className={`px-3 py-1 rounded ${
                    mode === "export"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-300"
                  }`}
                  onClick={() => setMode("export")}
                >
                  Exporting from
                </button>
                <button
                  className={`px-3 py-1 rounded ${
                    mode === "import"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-300"
                  }`}
                  onClick={() => setMode("import")}
                >
                  Importing to
                </button>
                <label className="inline-flex items-center text-sm ml-3">
                  <input
                    type="checkbox"
                    className="form-checkbox mr-2"
                    checked={hideExpired}
                    onChange={(e) => setHideExpired(e.target.checked)}
                  />
                  Hide expired
                </label>
              </div>

              <div className="ml-auto flex items-center">
                <button
                  className="mr-2 px-3 py-1 bg-indigo-600 text-white rounded"
                  onClick={() => openCreateForm()}
                >
                  New tariff
                </button>

                <button
                  className="px-3 py-1 bg-green-600 text-white rounded"
                  onClick={() => exportFilteredCSV()}
                  disabled={!selectedOrigin || loading}
                >
                  Export CSV
                </button>
                <button
                  className="ml-2 px-3 py-1 bg-yellow-500 text-black rounded"
                  onClick={() => refreshCacheAndFetch()}
                  disabled={loading}
                  title="Clear cached tariffs (cookies/localStorage) and re-fetch from server"
                >
                  Refresh cache
                </button>
              </div>
            </div>

            {showForm && (
              <div className="mb-6 p-4 border rounded bg-black/30">
                <form onSubmit={submitForm}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm">Origin</label>
                      <select
                        className="w-full px-2 py-1 bg-black border rounded"
                        value={formState.origin}
                        onChange={(e) =>
                          setFormState((s) => ({
                            ...s,
                            origin: e.target.value,
                          }))
                        }
                      >
                        <option value="">-- select origin --</option>
                        {origins.map((o) => (
                          <option key={o} value={o} disabled={o === formState.dest}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm">Destination</label>
                      <select
                        className="w-full px-2 py-1 bg-black border rounded"
                        value={formState.dest}
                        onChange={(e) =>
                          setFormState((s) => ({ ...s, dest: e.target.value }))
                        }
                      >
                        <option value="">-- select destination --</option>
                        {destinationNames.map((d) => (
                          <option key={d} value={d} disabled={d === formState.origin}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm">Effective</label>
                      <input
                        type="date"
                        className="w-full px-2 py-1 bg-black border rounded"
                        value={formState.effectiveDate}
                        onChange={(e) =>
                          setFormState((s) => ({
                            ...s,
                            effectiveDate: e.target.value,
                          }))
                        }
                        placeholder="YYYY-MM-DD"
                      />
                    </div>
                    <div>
                      <label className="block text-sm">Expiry</label>
                      <input
                        type="date"
                        className="w-full px-2 py-1 bg-black border rounded"
                        value={formState.expiryDate}
                        onChange={(e) =>
                          setFormState((s) => ({
                            ...s,
                            expiryDate: e.target.value,
                          }))
                        }
                        placeholder="YYYY-MM-DD"
                      />
                    </div>
                    <div>
                      <label className="block text-sm">
                        Ad valorem
                      </label>
                      <input
                        className="w-full px-2 py-1 bg-black border rounded"
                        value={formState.adValoremRate}
                        onChange={(e) =>
                          setFormState((s) => ({
                            ...s,
                            adValoremRate: e.target.value,
                          }))
                        }
                        type="number"
                        step="0.001"
                        placeholder="e.g. 0.1 = 10%"
                      />
                    </div>
                    <div>
                      <label className="block text-sm">Specific</label>
                      <input
                        className="w-full px-2 py-1 bg-black border rounded"
                        value={formState.specificRate}
                        onChange={(e) =>
                          setFormState((s) => ({
                            ...s,
                            specificRate: e.target.value,
                          }))
                        }
                        type="number"
                        step="0.1"
                        placeholder="e.g. 1.2"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm">
                        Products (select one or more)
                      </label>
                      <div className="flex gap-2">
                        <select
                          multiple
                          size={Math.min(
                            10,
                            Math.max(3, productOptions.length)
                          )}
                          className="w-full px-2 py-1 bg-black border rounded"
                          value={formState.productsSelected}
                          onChange={(e) => {
                            const selected = Array.from(
                              e.target.selectedOptions
                            ).map((o) => o.value);
                            setFormState((s) => ({
                              ...s,
                              productsSelected: selected,
                              productsRaw: selected.join(", "),
                            }));
                          }}
                        >
                          {productOptions.map((p) => (
                            <option
                              key={p.code || p.name}
                              value={p.code || p.name}
                            >
                              {p.name && p.code
                                ? `${p.name} (${p.code})`
                                : p.name || p.code}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Tip: hold Cmd/Ctrl (or Shift) to select multiple.
                      </div>
                    </div>
                  </div>

                  {formError && (
                    <div className="text-red-400 mt-2">{formError}</div>
                  )}

                  

                  <div className="mt-3 flex items-center">
                    <button
                      type="submit"
                      className="px-3 py-1 bg-green-600 text-white rounded"
                      disabled={isSaving}
                    >
                      {isSaving
                        ? "Saving..."
                        : editingTariff
                        ? "Save"
                        : "Create"}
                    </button>
                    <button
                      type="button"
                      className="ml-2 px-3 py-1 bg-gray-700 text-white rounded"
                      onClick={() => closeForm()}
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <FilteredTable
              tariffs={tariffs}
              origin={selectedOrigin}
              mode={mode}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              rowsPerPage={rowsPerPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
