import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<any> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res.json(); // Parse and return JSON data instead of Response object
}

// Custom pricing function with position bonuses
const applyCustomPricing = async (players: any[]) => {
  try {
    return players.map(player => {
      // Get original FPL price in millions (divide API units by 10)
      const originalPrice = player.now_cost / 10;
      
      // Apply position-based bonuses to original FPL prices
      let adjustedPrice = originalPrice;
      
      switch (player.element_type) {
        case 1: // Goalkeeper
        case 2: // Defender
          adjustedPrice = originalPrice + 1.0; // +£1.0m bonus
          break;
        case 3: // Midfielder
          adjustedPrice = originalPrice + 1.5; // +£1.5m bonus
          break;
        case 4: // Forward
          adjustedPrice = originalPrice + 2.5; // +£2.5m bonus
          break;
        default:
          adjustedPrice = originalPrice;
      }
      
      // Ensure minimum price £4.0m
      adjustedPrice = Math.max(adjustedPrice, 4.0);
      
      // Convert back to API units (multiply by 10)
      const priceInApiUnits = Math.round(adjustedPrice * 10);
      
      return {
        ...player,
        now_cost: priceInApiUnits,
        custom_price: adjustedPrice,
        original_price: originalPrice
      };
    });
  } catch (error) {
    console.error('Failed to apply custom pricing:', error);
    // Fallback to original prices if custom pricing fails
    return players;
  }
};

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const data = await res.json();
    
    // Apply custom pricing to FPL players data
    if (url === '/api/fpl/players' && Array.isArray(data)) {
      return await applyCustomPricing(data);
    }
    
    return data;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
