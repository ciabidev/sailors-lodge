import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Status } from "./Status";

afterEach(() => vi.unstubAllGlobals());

describe("Status", () => {
  it("shows live metrics for each shard", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response(JSON.stringify({
      operational: true,
      shards: [
        { id: 0, operational: true, uptime: 183_600_000, latency: 48, servers: 1250, users: 45678 },
        { id: 1, operational: false, uptime: 60_000, latency: null, servers: 0, users: 0 },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } }))));

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter><Status /></MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Shard 0")).toBeInTheDocument();
    expect(screen.getByText("Shard 1")).toBeInTheDocument();
    expect(screen.getByText("2d 3h 0m")).toBeInTheDocument();
    expect(screen.getByText("48 ms")).toBeInTheDocument();
    expect(screen.getByText("1,250")).toBeInTheDocument();
    expect(screen.getByText("45,678")).toBeInTheDocument();
    expect(screen.getByText("Not operational")).toBeInTheDocument();
  });
});
