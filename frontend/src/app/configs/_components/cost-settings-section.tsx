// CRITICAL
"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Zap } from "lucide-react";
import api from "@/lib/api";

const CURRENCIES = [
  { ticker: "USD", symbol: "$", label: "US Dollar" },
  { ticker: "EUR", symbol: "€", label: "Euro" },
  { ticker: "GBP", symbol: "£", label: "British Pound" },
  { ticker: "PLN", symbol: "zł", label: "Polish Złoty" },
  { ticker: "CAD", symbol: "C$", label: "Canadian Dollar" },
  { ticker: "AUD", symbol: "A$", label: "Australian Dollar" },
  { ticker: "CHF", symbol: "CHF", label: "Swiss Franc" },
  { ticker: "JPY", symbol: "¥", label: "Japanese Yen" },
  { ticker: "CNY", symbol: "¥", label: "Chinese Yuan" },
  { ticker: "SEK", symbol: "kr", label: "Swedish Krona" },
  { ticker: "NOK", symbol: "kr", label: "Norwegian Krone" },
  { ticker: "DKK", symbol: "kr", label: "Danish Krone" },
  { ticker: "CZK", symbol: "Kč", label: "Czech Koruna" },
  { ticker: "KRW", symbol: "₩", label: "South Korean Won" },
  { ticker: "INR", symbol: "₹", label: "Indian Rupee" },
  { ticker: "BRL", symbol: "R$", label: "Brazilian Real" },
  { ticker: "MXN", symbol: "$", label: "Mexican Peso" },
  { ticker: "ZAR", symbol: "R", label: "South African Rand" },
  { ticker: "SGD", symbol: "S$", label: "Singapore Dollar" },
  { ticker: "HKD", symbol: "HK$", label: "Hong Kong Dollar" },
  { ticker: "NZD", symbol: "NZ$", label: "New Zealand Dollar" },
  { ticker: "TWD", symbol: "NT$", label: "New Taiwan Dollar" },
  { ticker: "THB", symbol: "฿", label: "Thai Baht" },
] as const;

interface CostSettings {
  electricity_rate: number;
  electricity_currency: string;
  cloud_price_anthropic_input: number;
  cloud_price_anthropic_output: number;
  cloud_price_openai_input: number;
  cloud_price_openai_output: number;
}

export function CostSettingsSection() {
  const [settings, setSettings] = useState<CostSettings>({
    electricity_rate: 0.11,
    electricity_currency: "USD",
    cloud_price_anthropic_input: 3.0,
    cloud_price_anthropic_output: 15.0,
    cloud_price_openai_input: 2.5,
    cloud_price_openai_output: 10.0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await api.getStudioSettings();
        if (response.effective) {
          setSettings({
            electricity_rate: response.effective.electricity_rate ?? 0.11,
            electricity_currency: response.effective.electricity_currency ?? "USD",
            cloud_price_anthropic_input: response.effective.cloud_price_anthropic_input ?? 3.0,
            cloud_price_anthropic_output: response.effective.cloud_price_anthropic_output ?? 15.0,
            cloud_price_openai_input: response.effective.cloud_price_openai_input ?? 2.5,
            cloud_price_openai_output: response.effective.cloud_price_openai_output ?? 10.0,
          });
        }
      } catch (e) {
        console.error("Failed to load cost settings:", e);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setStatusMessage("");
      await api.updateStudioSettings({
        electricity_rate: settings.electricity_rate,
        electricity_currency: settings.electricity_currency,
        cloud_price_anthropic_input: settings.cloud_price_anthropic_input,
        cloud_price_anthropic_output: settings.cloud_price_anthropic_output,
        cloud_price_openai_input: settings.cloud_price_openai_input,
        cloud_price_openai_output: settings.cloud_price_openai_output,
      });
      setStatusMessage("Saved");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to save";
      setStatusMessage(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-6 sm:mb-8">
      <div className="text-xs text-(--dim) uppercase tracking-wider mb-3">
        Electricity Cost
      </div>
      <div className="bg-(--surface) rounded-lg p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Zap className="h-5 w-5 text-(--dim) animate-pulse" />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-(--dim) mb-1.5">
                Electricity Rate ($/kWh)
              </label>
              <input
                type="number"
                step="0.001"
                value={settings.electricity_rate}
                onChange={(e) =>
                  setSettings({ ...settings, electricity_rate: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 bg-(--surface) border border-(--border) rounded-lg text-sm text-(--fg) placeholder-(--dim)/50 focus:outline-none focus:border-(--hl1)"
                placeholder="0.11"
              />
              <p className="mt-1 text-[11px] text-(--dim)">
                Your local electricity cost per kilowatt-hour
              </p>
            </div>

            <div>
              <label className="block text-xs text-(--dim) mb-1.5">Currency</label>
              <select
                value={settings.electricity_currency}
                onChange={(e) =>
                  setSettings({ ...settings, electricity_currency: e.target.value })
                }
                className="w-full px-3 py-2 bg-(--surface) border border-(--border) rounded-lg text-sm text-(--fg) focus:outline-none focus:border-(--hl1)"
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency.ticker} value={currency.ticker}>
                    {currency.ticker} - {currency.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 bg-(--hl1) rounded-lg text-xs text-(--fg) hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Save
              </button>
              {statusMessage && (
                <span className="text-xs text-(--dim)">{statusMessage}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cloud API Pricing */}
      <div className="text-xs text-(--dim) uppercase tracking-wider mt-6 mb-3">
        Cloud API Pricing
      </div>
      <div className="bg-(--surface) rounded-lg p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Zap className="h-5 w-5 text-(--dim) animate-pulse" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-(--dim) mb-1.5">
                  Anthropic Input ($/MTok)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.cloud_price_anthropic_input}
                  onChange={(e) =>
                    setSettings({ ...settings, cloud_price_anthropic_input: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-(--surface) border border-(--border) rounded-lg text-sm text-(--fg) placeholder-(--dim)/50 focus:outline-none focus:border-(--hl1)"
                  placeholder="3.0"
                />
              </div>
              <div>
                <label className="block text-xs text-(--dim) mb-1.5">
                  Anthropic Output ($/MTok)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.cloud_price_anthropic_output}
                  onChange={(e) =>
                    setSettings({ ...settings, cloud_price_anthropic_output: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-(--surface) border border-(--border) rounded-lg text-sm text-(--fg) placeholder-(--dim)/50 focus:outline-none focus:border-(--hl1)"
                  placeholder="15.0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-(--dim) mb-1.5">
                  OpenAI Input ($/MTok)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.cloud_price_openai_input}
                  onChange={(e) =>
                    setSettings({ ...settings, cloud_price_openai_input: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-(--surface) border border-(--border) rounded-lg text-sm text-(--fg) placeholder-(--dim)/50 focus:outline-none focus:border-(--hl1)"
                  placeholder="2.50"
                />
              </div>
              <div>
                <label className="block text-xs text-(--dim) mb-1.5">
                  OpenAI Output ($/MTok)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={settings.cloud_price_openai_output}
                  onChange={(e) =>
                    setSettings({ ...settings, cloud_price_openai_output: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 bg-(--surface) border border-(--border) rounded-lg text-sm text-(--fg) placeholder-(--dim)/50 focus:outline-none focus:border-(--hl1)"
                  placeholder="10.0"
                />
              </div>
            </div>
            <p className="text-[11px] text-(--dim)">
              Per million token pricing for cloud API cost comparison on the Usage page
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
