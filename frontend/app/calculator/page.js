"use client";
import { colors } from "@/styles/colors";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Calculator } from "lucide-react";
import { useState, useEffect } from "react";
import PageHeader from "@/components/ui/PageHeader";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "react-datepicker/dist/react-datepicker.css";
import "./datepicker-dark.css";

export default function CalculatorPage() {
  const [countries, setCountries] = useState([]);
  const [products, setProducts] = useState([]);
  const [product, setProduct] = useState("");
  const [originCountry, setImportCountry] = useState("");
  const [destCountry, setExportCountry] = useState("");
  const [adValoremRate, setAdValoremRate] = useState(0);
  const [specificRate, setSpecificRate] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(1000);
  const [calculationDate, setCalculationDate] = useState("");
  const [tariffError, setTariffError] = useState(null);
  const [activeTab, setActiveTab] = useState("Calculator");
  const [validDestCountries, setValidDestCountries] = useState([]);

  // Simulation
  const [simSpecificRate, setSimSpecificRate] = useState(0);
  const [simAdValoremRate, setSimAdValoremRate] = useState(0);
  const [specificRateFocused, setSpecificRateFocused] = useState(false);
  const [adValoremRateFocused, setAdValoremRateFocused] = useState(false);
  // Handler to remove leading zeros
  const removeLeadingZeros = (val) => (val === "" ? "" : String(Number(val)));

  // Fetch countries and products on page load
  useEffect(() => {
    fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/countries`
    )
      .then((res) => res.json())
      .then((data) => setCountries(data))
      .catch(() => setCountries([]));

    fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/products`
    )
      .then((res) => res.json())
      .then((data) => {
        console.log("Fetched products:", data);
        // Make sure data is an array
        if (Array.isArray(data)) setProducts(data);
        else setProducts([]);
      })
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    setProduct("");
    setImportCountry("");
    setExportCountry("");
    setQuantity(1);
    setUnitPrice(1000);
    setCalculationDate(null);
    setSpecificRate(0);
    setAdValoremRate(0);
    setSimSpecificRate(0);
    setSimAdValoremRate(0);
    setTariffError(null);
  }, [activeTab]);

  useEffect(() => {
    // Only call API if all fields are filled and calculationDate is valid
    if (product && originCountry && destCountry && calculationDate) {
      setTariffError(null); // Reset error
      // Format date as YYYY-MM-DD
      const formattedDate = calculationDate.toISOString().split("T")[0];
      // TODO: change this to process.env
      fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tariffs/particular-tariff-rate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            date: formattedDate,
            originCountry,
            destCountry,
            productName: product,
          }),
        }
      )
        .then((res) => {
          if (res.status === 204) {
            // No content
            return null; // or set a specific value to indicate no data
          }
          if (!res.ok) {
            throw new Error(`Server error: ${res.status} ${res.statusText}`);
          }
          return res.json();
        })
        .then((data) => {
          if (data === null) {
            // No results found, handle accordingly
            setTariffError("No tariff found for the selected criteria.");
            setAdValoremRate(0);
            setSpecificRate(0);
          } else {
            // Normal data processing
            setAdValoremRate(data.adValoremRate ?? 0);
            setSpecificRate(data.specificRate ?? 0);
            setTariffError(null);
          }
        })
        .catch((error) => {
          // Handle network or server errors
          setTariffError(error.message || "Failed to fetch tariff rates.");
          setAdValoremRate(0);
          setSpecificRate(0);
        });
    }
  }, [product, originCountry, destCountry, calculationDate]);

  useEffect(() => {
    // Only fetch valid destinations when user has selected product, origin and calculation date
    if (
      activeTab === "Calculator" &&
      originCountry &&
      product &&
      calculationDate
    ) {
      const originParam = encodeURIComponent(originCountry);
      const productParam = encodeURIComponent(product);
      fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/tariffs/valid-destinations?originCountry=${originParam}&productName=${productParam}`
      )
        .then(async (res) => {
          if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || "Failed to load valid destinations");
          }
          return res.json();
        })
        .then((data) => {
          if (Array.isArray(data) && data.length === 0) {
            setTariffError(
              "No valid tariff data for selected import country and product."
            );
            setValidDestCountries([]);
          } else {
            setTariffError(null);
            setValidDestCountries(Array.isArray(data) ? data : []);
          }
        })
        .catch((error) => {
          setTariffError(error.message || "Error fetching valid destinations.");
          setValidDestCountries([]);
        });
    } else {
      setValidDestCountries([]);
      setTariffError(null);
    }
  }, [activeTab, originCountry, product, calculationDate]);

  // Helper to display full country name when state stores country codes
  const findCountryName = (code) => {
    if (!code) return "";
    const fromCountries = countries.find((c) => c.code === code);
    if (fromCountries) return fromCountries.name;
    const fromValid = validDestCountries.find((c) => c.code === code);
    if (fromValid) return fromValid.name;
    return code;
  };

  // Calculate tariff amount
  const summarySpecificRate =
    activeTab === "Calculator" ? specificRate : simSpecificRate;
  const summaryAdValoremRate =
    activeTab === "Calculator" ? adValoremRate : simAdValoremRate;
  // Render summary using these values
  const summaryAmountSpecific = summarySpecificRate * quantity;
  const summaryAmountAdValorem =
    (summaryAdValoremRate) * (unitPrice * quantity);

  function resetSummaryAndInputs() {
    setExportCountry("");
    setAdValoremRate(0);
    setSpecificRate(0);
    setSimSpecificRate(0);
    setSimAdValoremRate(0);
    setTariffError(null);
  }

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: colors.background, color: colors.text }}
    >
      <PageHeader />
      <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
        {/* Calculator Card with Tabs */}
        <Card className="max-w-lg w-full mx-auto">
          <CardHeader>
            <Calculator className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Tariff Calculator</CardTitle>
            <CardDescription>
              Enter product details and select countries to calculate tariffs.
            </CardDescription>
          </CardHeader>
          {/* Tabs */}
          <div className="flex border-b border-gray-700 mb-6">
            <button
              className={`px-4 py-2 text-white font-medium border-b-2 ${activeTab === "Calculator"
                ? "border-blue-500"
                : "border-transparent"
                }`}
              onClick={() => setActiveTab("Calculator")}
            >
              Calculator
            </button>
            <button
              className={`px-4 py-2 text-white font-medium border-b-2 ${activeTab === "Simulation"
                ? "border-blue-500"
                : "border-transparent"
                }`}
              onClick={() => setActiveTab("Simulation")}
            >
              Simulation
            </button>
          </div>
          {activeTab === "Calculator" && (
            <CardContent>
              <form className="space-y-4">
                <div>
                  <label className="block mb-1 font-medium">Product Name</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    style={{ backgroundColor: "black", color: "white" }}
                    value={product}
                    onChange={(e) => {
                      resetSummaryAndInputs();
                      setProduct(e.target.value);
                    }}
                  >
                    <option value="" disabled hidden>
                      Select product
                    </option>
                    {products.map((product) => (
                      <option key={product.name} value={product.name}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium">
                    Import Country
                  </label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    style={{ backgroundColor: "black", color: "white" }}
                    value={originCountry}
                    onChange={(e) => {
                      resetSummaryAndInputs();
                      setImportCountry(e.target.value);
                    }}
                  >
                    <option value="" disabled hidden>
                      Select country
                    </option>
                    {countries
                      .filter(
                        (country) =>
                          country.name !== "World" &&
                          country.name !== "Unspecified"
                      )
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium">
                    Calculation Date
                  </label>
                  <DatePicker
                    selected={calculationDate}
                    onChange={(date) => {
                      resetSummaryAndInputs();
                      setCalculationDate(date);
                    }}
                    selectsStart
                    calculationDate={calculationDate}
                    placeholderText="Select calculation date"
                    className="w-full border rounded px-3 py-2"
                    popperPlacement="bottom"
                    style={{ backgroundColor: "black", color: "white" }}
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">
                    Export Country
                  </label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    style={{ backgroundColor: "black", color: "white" }}
                    value={destCountry}
                    onChange={(e) => setExportCountry(e.target.value)}
                  >
                    <option value="" disabled hidden>
                      Select country
                    </option>
                    {validDestCountries.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full border rounded px-3 py-2"
                    style={{ backgroundColor: "black", color: "white" }}
                    value={quantity}
                    onChange={(e) => {
                      let val = e.target.value;

                      // Remove leading zeros
                      val = val.replace(/^0+/, "");

                      // Allow only integers - remove decimal points if any
                      val = val.split(".")[0];
                      setQuantity(val === "" ? "" : Number(val));
                    }}
                    placeholder="Enter quantity"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Unit Price</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    className="w-full border rounded px-3 py-2"
                    style={{ backgroundColor: "black", color: "white" }}
                    value={unitPrice}
                    onChange={e => {
                      let val = e.target.value;

                      // If the value starts with ".", prepend "0"
                      if (val.startsWith(".")) val = "0" + val;
                      // Remove multiple leading zeros before an integer (keep single 0 before decimal)
                      val = val.replace(/^0+(?=\d)/, "");
                      // Only allow valid numeric input (digits with max one decimal point)
                      if (/^\d*\.?\d*$/.test(val)) {
                        setUnitPrice(val);
                      }
                    }}
                    placeholder="Enter unit price"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">
                    Specific Rate
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"

                    value={
                      activeTab === "Calculator"
                        ? specificRate
                        : simSpecificRate
                    }
                    onChange={(e) =>
                      activeTab === "Calculator"
                        ? setSpecificRate(Number(e.target.value))
                        : setSimSpecificRate(Number(e.target.value))
                    }
                    className="w-full border rounded px-3 py-2"
                    style={{ backgroundColor: "black", color: "white" }}
                    readOnly={activeTab === "Calculator"} // only editable for Simulation
                  />
                </div>

                <div>
                  <label className="block mb-1 font-medium">
                    Ad Valorem Rate
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={
                      activeTab === "Calculator"
                        ? adValoremRate
                        : simAdValoremRate
                    }
                    onChange={(e) =>
                      activeTab === "Calculator"
                        ? setAdValoremRate(Number(e.target.value))
                        : setSimAdValoremRate(Number(e.target.value))
                    }
                    className="w-full border rounded px-3 py-2"
                    style={{ backgroundColor: "black", color: "white" }}
                    readOnly={activeTab === "Calculator"}
                  />
                </div>
              </form>
            </CardContent>
          )}

          {activeTab === "Simulation" && (
            <CardContent>
              <form className="space-y-4">
                <div>
                  <label className="block mb-1 font-medium">Product Name</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    style={{ backgroundColor: "black", color: "white" }}
                    value={product}
                    onChange={(e) => {
                      resetSummaryAndInputs();
                      setProduct(e.target.value);
                    }}
                  >
                    <option value="" disabled hidden>
                      Select product
                    </option>
                    {products.map((product) => (
                      <option key={product.name} value={product.name}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium">
                    Import Country
                  </label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    style={{ backgroundColor: "black", color: "white" }}
                    value={originCountry}
                    onChange={(e) => {
                      resetSummaryAndInputs();
                      setImportCountry(e.target.value);
                    }}
                  >
                    <option value="" disabled hidden>
                      Select country
                    </option>
                    {countries
                      .filter(
                        (country) =>
                          country.name !== "World" &&
                          country.name !== "Unspecified"
                      )
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium">
                    Calculation Date
                  </label>
                  <DatePicker
                    selected={calculationDate}
                    onChange={(date) => {
                      resetSummaryAndInputs();
                      setCalculationDate(date);
                    }}
                    selectsStart
                    calculationDate={calculationDate}
                    placeholderText="Select calculation date"
                    className="w-full border rounded px-3 py-2"
                    popperPlacement="bottom"
                    style={{ backgroundColor: "black", color: "white" }}
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">
                    Export Country
                  </label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    style={{ backgroundColor: "black", color: "white" }}
                    value={destCountry}
                    onChange={(e) => setExportCountry(e.target.value)}
                  >
                    <option value="" disabled hidden>
                      Select country
                    </option>
                    {countries
                      .filter(
                        (country) =>
                          country.name !== "World" &&
                          country.name !== "Unspecified"
                      )
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1 font-medium">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    className="w-full border rounded px-3 py-2"
                    style={{ backgroundColor: "black", color: "white" }}
                    value={quantity}
                    onChange={(e) => {
                      let val = e.target.value;

                      // Remove leading zeros
                      val = val.replace(/^0+/, "");

                      // Allow only integers - remove decimal points if any
                      val = val.split(".")[0];
                      setQuantity(val === "" ? "" : val);
                    }}
                    placeholder="Enter quantity"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Unit Price</label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    className="w-full border rounded px-3 py-2"
                    style={{ backgroundColor: "black", color: "white" }}
                    value={unitPrice}
                    onChange={e => {
                      let val = e.target.value;

                      // If the value starts with ".", prepend "0"
                      if (val.startsWith(".")) val = "0" + val;
                      // Remove multiple leading zeros before an integer (keep single 0 before decimal)
                      val = val.replace(/^0+(?=\d)/, "");
                      // Only allow valid numeric input (digits with max one decimal point)
                      if (/^\d*\.?\d*$/.test(val)) {
                        setUnitPrice(val);
                      }
                    }}
                    placeholder="Enter unit price"
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">
                    Specific Rate
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={
                      !specificRateFocused &&
                        (simSpecificRate === "" || simSpecificRate === "0")
                        ? ""
                        : simSpecificRate
                    }
                    onFocus={() => {
                      setSpecificRateFocused(true);
                      if (simSpecificRate === "0") setSimSpecificRate("");
                    }}
                    onBlur={() => setSpecificRateFocused(false)}
                    onChange={(e) => {
                      let val = e.target.value;
                      // If the value starts with ".", prepend "0"
                      if (val.startsWith(".")) val = "0" + val;
                      // Remove multiple leading zeros before any digits (but keep for decimals)
                      val = val.replace(/^0+(?=\d)/, "");
                      // Allow only digits and at most one decimal point
                      if (/^\d*\.?\d*$/.test(val)) setSimSpecificRate(val);
                    }}
                    className="w-full border rounded px-3 py-2"
                    style={{ backgroundColor: "black", color: "white" }}
                  />
                </div>

                <div>
                  <label className="block mb-1 font-medium">
                    Ad Valorem Rate
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    placeholder="0"
                    value={
                      !adValoremRateFocused &&
                        (simAdValoremRate === "" || simAdValoremRate === "0")
                        ? ""
                        : simAdValoremRate
                    }
                    onFocus={() => {
                      setAdValoremRateFocused(true);
                      if (simAdValoremRate === "0") setSimAdValoremRate("");
                    }}
                    onBlur={() => setAdValoremRateFocused(false)}
                    onChange={(e) => {
                      let val = e.target.value;
                      // If the value starts with ".", prepend "0"
                      if (val.startsWith(".")) val = "0" + val;
                      // Remove multiple leading zeros before any digits (but keep for decimals)
                      val = val.replace(/^0+(?=\d)/, "");
                      // Allow only digits and at most one decimal point
                      if (/^\d*\.?\d*$/.test(val)) setSimAdValoremRate(val);
                    }}
                    className="w-full border rounded px-3 py-2"
                    style={{ backgroundColor: "black", color: "white" }}
                  />
                </div>
              </form>
            </CardContent>
          )}
        </Card>

        {/* Tariff Summary Card */}
        <Card className="max-w-md w-full mx-auto">
          <CardHeader>
            <CardTitle>Tariff Summary</CardTitle>
            <CardDescription>See your calculated costs.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <li>
                <strong>Product:</strong> {product || "-"}
              </li>
              <li>
                <strong>Import Country:</strong>{" "}
                {findCountryName(originCountry) || "-"}
              </li>
              <li>
                <strong>Export Country:</strong>{" "}
                {findCountryName(destCountry) || "-"}
              </li>
              <li>
                <strong>Quantity:</strong> {quantity}
              </li>
              <li>
                <strong>Unit Price:</strong> ${Number(unitPrice || 0).toFixed(2)}
              </li>
              <li>
                <strong>Calculation Date:</strong>{" "}
                {calculationDate ? calculationDate.toLocaleDateString() : "-"}
              </li>
              <li>
                <strong>Specific Rate:</strong> {summarySpecificRate}
              </li>
              <li>
                <strong>Ad Valorem Rate:</strong> {summaryAdValoremRate}
              </li>
              <li>
                <strong>Specific Duty Amount:</strong>{" $ "}
                {summaryAmountSpecific.toFixed(2).toLocaleString()}
              </li>
              <li>
                <strong>Ad Valorem Duty Amount:</strong>{" $ "}
                {summaryAmountAdValorem.toFixed(2).toLocaleString()}
              </li>
              {tariffError && activeTab !== "Simulation" && (
                <li>
                  <div
                    style={{
                      marginTop: "0.7rem",
                      color: "#ff5151",
                      background: "#261618",
                      border: "1px solid #512f3d",
                      borderRadius: "8px",
                      padding: "0.75rem 1rem",
                      fontWeight: "bold",
                      textAlign: "center",
                    }}
                    role="alert"
                  >
                    {tariffError}
                  </div>
                </li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
