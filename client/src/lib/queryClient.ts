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
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

// Custom pricing function with position bonuses
const applyCustomPricing = async (players: any[]) => {
  try {
    // Fetch custom prices from JSON file
    const priceResponse = await fetch('/fpl_player_prices.json');
    const customPrices = await priceResponse.json();
    
    // Create a price lookup map
    const priceMap = new Map(customPrices.map((p: any) => [p.id, p.price]));
    
    return players.map(player => {
      const basePrice = priceMap.get(player.id) || 4.0; // Default price if not found
      
      // Apply position-based bonuses, then reduce £1m from everyone
      let adjustedPrice = basePrice;
      
      switch (player.element_type) {
        case 1: // Goalkeeper
        case 2: // Defender
          adjustedPrice = basePrice + 1.0; // +1.0m
          break;
        case 3: // Midfielder
          adjustedPrice = basePrice + 1.5; // +1.5m
          break;
        case 4: // Forward
          adjustedPrice = basePrice + 2.5; // +2.5m
          break;
        default:
          adjustedPrice = basePrice;
      }
      
      // Reduce £1m from every player
      adjustedPrice = Math.max(adjustedPrice - 1.0, 4.0); // Minimum price £4.0m
      
      // Convert to API units (multiply by 10)
      const priceInApiUnits = Math.round(adjustedPrice * 10);
      
      return {
        ...player,
        now_cost: priceInApiUnits,
        custom_price: adjustedPrice,
        base_price: basePrice
      };
    });
  } catch (error) {
    console.error('Failed to load custom prices:', error);
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
