import { describe, expect, it } from "vitest";
import { classifyRequest, fakeTrpcResponse } from "./request-fakes";

const origin = "http://localhost:3101";
const kind = (method: string, url: string, serverAction = false) =>
  classifyRequest({ method, url, pageOrigin: origin, serverAction });

describe("classifyRequest", () => {
  it("lets reads through", () => {
    expect(kind("GET", "/api/trpc/me/get?batch=1")).toBe("read");
    expect(kind("HEAD", "/settings")).toBe("read");
  });

  it("tells POSTed tRPC queries from mutations by procedure name", () => {
    expect(kind("POST", "/api/trpc/bookings/get?batch=1")).toBe("trpc-query");
    expect(kind("POST", "/api/trpc/organizations/listMembers?batch=1")).toBe("trpc-query");
    expect(kind("POST", "/api/trpc/contacts/searchForGuests,attendeeContactSummaries?batch=1")).toBe(
      "trpc-query"
    );
    expect(kind("POST", "/api/trpc/insights/bookingKPICards?batch=1")).toBe("trpc-query");
    expect(kind("POST", "/api/trpc/me/updateProfile?batch=1")).toBe("trpc-mutation");
    expect(kind("POST", "/api/trpc/bookings/get,confirm?batch=1")).toBe("trpc-mutation");
  });

  it("fakes other writes and flags what it can't place", () => {
    expect(kind("DELETE", "/api/availability/1")).toBe("api-write");
    expect(kind("POST", "https://analytics.example/collect")).toBe("external-write");
    expect(kind("POST", "/settings/my-account/profile", true)).toBe("server-action");
    expect(kind("POST", "/settings/my-account/profile")).toBe("unclassified");
  });
});

describe("fakeTrpcResponse", () => {
  it("echoes each batched call's superjson input as its result", () => {
    const body = JSON.stringify({ "0": { json: { name: "Owner One" } } });
    expect(JSON.parse(fakeTrpcResponse({ body, batch: true, calls: 2 }))).toEqual([
      { result: { data: { json: { name: "Owner One" } } } },
      { result: { data: { json: null } } },
    ]);
  });

  it("answers a single call, or garbage, with a plausible success", () => {
    expect(JSON.parse(fakeTrpcResponse({ body: '{"json":{"id":1}}', batch: false, calls: 1 }))).toEqual({
      result: { data: { json: { id: 1 } } },
    });
    expect(JSON.parse(fakeTrpcResponse({ body: "not json", batch: false, calls: 1 }))).toEqual({
      result: { data: { json: null } },
    });
  });
});
