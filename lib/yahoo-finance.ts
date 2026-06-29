/**
 * Yahoo Finance utility for fetching stock and crypto prices
 * Uses Yahoo Finance API with multiple fallback approaches
 *
 * Note: For web, Yahoo Finance may block CORS requests.
 * This works best on mobile (iOS/Android).
 */

import { Platform } from "react-native";

// Yahoo Finance endpoints
const YAHOO_V10_URL = "https://query1.finance.yahoo.com/v10/finance/quote";
const YAHOO_V7_URL = "https://query1.finance.yahoo.com/v7/finance/quote";
const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";

// CORS proxy for web (development only - not recommended for production)
const CORS_PROXY = "https://corsproxy.io/?";

export interface YahooQuoteResponse {
  symbol: string;
  price: number | null;
  error?: string;
}

/**
 * Check if running on web
 */
const isWeb = Platform.OS === "web";

/**
 * Get common headers for Yahoo Finance requests
 */
const getHeaders = () => ({
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
});

/**
 * Build URL with optional CORS proxy for web
 */
const buildUrl = (url: string): string => {
  if (isWeb) {
    // Use CORS proxy for web
    return `${CORS_PROXY}${encodeURIComponent(url)}`;
  }
  return url;
};

/**
 * Fetch with timeout
 */
const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeout = 10000
): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
};

/**
 * Fetch current price for a stock symbol using quote endpoint
 */
export const fetchStockPrice = async (
  symbol: string
): Promise<YahooQuoteResponse> => {
  try {
    // Add .JK for Indonesian stocks if not already present
    let fullSymbol = symbol.toUpperCase();
    if (!fullSymbol.includes(".") && !fullSymbol.includes("-")) {
      // Check if it's an Indonesian stock (typically 4 letters)
      if (fullSymbol.length >= 3 && fullSymbol.length <= 6) {
        fullSymbol = `${fullSymbol}.JK`;
      }
    }

    // Try v10 endpoint first
    const quoteUrl = `${YAHOO_V10_URL}?symbols=${encodeURIComponent(
      fullSymbol
    )}`;
    const url = buildUrl(quoteUrl);

    console.log("Fetching from Yahoo:", quoteUrl);

    const response = await fetchWithTimeout(url, {
      headers: getHeaders(),
    });

    console.log("Response status:", response.status);

    if (!response.ok) {
      return { symbol, price: null, error: `HTTP error: ${response.status}` };
    }

    const data = await response.json();
    console.log("Yahoo Response:", JSON.stringify(data));

    // Check for errors
    if (data?.quoteResponse?.result?.[0]?.Error) {
      return { symbol, price: null, error: data.quoteResponse.result[0].Error };
    }

    const quote = data?.quoteResponse?.result?.[0];
    if (quote?.regularMarketPrice) {
      return {
        symbol,
        price: quote.regularMarketPrice,
      };
    }

    // Try previous close as fallback
    if (quote?.regularMarketPreviousClose) {
      return {
        symbol,
        price: quote.regularMarketPreviousClose,
      };
    }

    return { symbol, price: null, error: "Price not available" };
  } catch (error) {
    console.error("Yahoo Error:", error);

    // Provide more helpful error message
    if (
      isWeb &&
      error instanceof TypeError &&
      error.message === "Failed to fetch"
    ) {
      return {
        symbol,
        price: null,
        error: "CORS error - please use mobile app to fetch prices",
      };
    }

    return {
      symbol,
      price: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Fetch current price for a cryptocurrency
 */
export const fetchCryptoPrice = async (
  symbol: string
): Promise<YahooQuoteResponse> => {
  try {
    // Add -USD suffix for Yahoo Finance crypto quotes
    let fullSymbol = symbol.toUpperCase();
    if (!fullSymbol.includes("-USD")) {
      fullSymbol = `${fullSymbol}-USD`;
    }

    const quoteUrl = `${YAHOO_V10_URL}?symbols=${encodeURIComponent(
      fullSymbol
    )}`;
    const url = buildUrl(quoteUrl);

    console.log("Fetching crypto from Yahoo:", quoteUrl);

    const response = await fetchWithTimeout(url, {
      headers: getHeaders(),
    });

    console.log("Crypto Response status:", response.status);

    if (!response.ok) {
      return { symbol, price: null, error: `HTTP error: ${response.status}` };
    }

    const data = await response.json();
    console.log("Yahoo Crypto Response:", JSON.stringify(data));

    const quote = data?.quoteResponse?.result?.[0];
    if (quote?.regularMarketPrice) {
      return {
        symbol,
        price: quote.regularMarketPrice,
      };
    }

    return { symbol, price: null, error: "Crypto price not available" };
  } catch (error) {
    console.error("Yahoo Crypto Error:", error);

    if (
      isWeb &&
      error instanceof TypeError &&
      error.message === "Failed to fetch"
    ) {
      return {
        symbol,
        price: null,
        error: "CORS error - please use mobile app to fetch prices",
      };
    }

    return {
      symbol,
      price: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Fetch current price based on asset type
 */
export const fetchPrice = async (
  symbol: string,
  assetType: "stock" | "crypto"
): Promise<YahooQuoteResponse> => {
  if (assetType === "crypto") {
    return fetchCryptoPrice(symbol);
  }
  return fetchStockPrice(symbol);
};

/**
 * Refresh all investment prices from Yahoo Finance
 */
export const refreshAllPrices = async (
  investments: Array<{ symbol: string; assetType: "stock" | "crypto" }>
): Promise<Map<string, number>> => {
  const priceMap = new Map<string, number>();
  let errorMessages: string[] = [];

  // Fetch prices sequentially to avoid rate limiting
  for (const investment of investments) {
    try {
      console.log(
        "Fetching price for:",
        investment.symbol,
        investment.assetType
      );
      const result = await fetchPrice(investment.symbol, investment.assetType);
      console.log("Result for", investment.symbol, ":", result);

      if (result.price !== null) {
        priceMap.set(investment.symbol, result.price);
      } else if (result.error) {
        errorMessages.push(`${investment.symbol}: ${result.error}`);
      }

      // Delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Error fetching price for", investment.symbol, error);
      errorMessages.push(`${investment.symbol}: ${error}`);
    }
  }

  console.log("Final price map:", Object.fromEntries(priceMap));
  console.log("Errors:", errorMessages);

  return priceMap;
};
