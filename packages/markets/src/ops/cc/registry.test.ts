import { describe, expect, it, vi } from "vitest";
import { instructDeposit, transferChoiceArguments } from "./commands";
import { createRegistryClient, RegistryError } from "./registry";

const CTX = {
  choiceContextData: { values: { "amulet-rules": { tag: "AV_ContractId", value: "00rules" } } },
  disclosedContracts: [{ templateId: "pkg:Splice.AmuletRules:AmuletRules", contractId: "00rules", createdEventBlob: "blob==", synchronizerId: "sync::1", debugPackageName: "x" }],
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("registry client (C7b; from the OpenAPI, run against fixtures only)", () => {
  it("asks for the factory with the choice arguments and keeps the context and disclosed contracts, dropping debug fields", async () => {
    const fetchMock = vi.fn(async () => json({ factoryId: "00factory", transferKind: "offer", choiceContext: CTX }));
    const client = createRegistryClient({ baseUrl: "https://registry.example/", fetch: fetchMock as unknown as typeof fetch });
    const args = transferChoiceArguments({
      sender: "alice::1", receiver: "venue::1", instrumentAdmin: "dso::1", instrumentId: "Amulet", amountAtomic: 125_000_000_000n,
      requestedAtSec: 1_000, executeBeforeSec: 4_600, inputHoldingCids: ["00h1"], ref: "dep-1",
    });
    const answer = await client.transferFactory(args);
    expect(answer.factoryId).toBe("00factory");
    expect(answer.transferKind).toBe("offer");
    expect(answer.context.choiceContextData).toEqual(CTX.choiceContextData);
    expect(answer.context.disclosedContracts).toEqual([{ templateId: "pkg:Splice.AmuletRules:AmuletRules", contractId: "00rules", createdEventBlob: "blob==", synchronizerId: "sync::1" }]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://registry.example/registry/transfer-instruction/v1/transfer-factory");
    const sent = JSON.parse(String(init.body));
    expect(sent.excludeDebugFields).toBe(true);
    expect(sent.choiceArguments.transfer.amount).toBe("12.5000000000");
    expect(sent.choiceArguments.transfer.meta.values["abu-pm.io/ref"]).toBe("dep-1");
    expect(sent.choiceArguments.expectedAdmin).toBe("dso::1");
    expect(init.headers).not.toHaveProperty("authorization");
  });

  it("fetches a fresh choice context per instruction choice", async () => {
    const fetchMock = vi.fn(async () => json(CTX));
    const client = createRegistryClient({ baseUrl: "https://r.example", fetch: fetchMock as unknown as typeof fetch });
    await client.instructionContext("accept", "00 instr/1");
    await client.instructionContext("withdraw", "00instr2");
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe("https://r.example/registry/transfer-instruction/v1/00%20instr%2F1/choice-contexts/accept");
    expect((fetchMock.mock.calls[1] as unknown as [string])[0]).toContain("/00instr2/choice-contexts/withdraw");
  });

  it("refuses an answer that does not match the token standard, and reports a registry error without echoing arguments", async () => {
    const bad = createRegistryClient({ baseUrl: "https://r.example", fetch: (async () => json({ factoryId: "x" })) as unknown as typeof fetch });
    await expect(bad.transferFactory({})).rejects.toThrow(/did not match/);
    const down = createRegistryClient({ baseUrl: "https://r.example", fetch: (async () => json({ error: "no such instrument" }, 404)) as unknown as typeof fetch });
    await expect(down.transferFactory({ secret: "s3cret" })).rejects.toMatchObject({ status: 404, message: expect.stringContaining("no such instrument") });
    await expect(down.transferFactory({ secret: "s3cret" })).rejects.not.toThrow(/s3cret/);
    const dead = createRegistryClient({ baseUrl: "https://r.example", fetch: (async () => { throw new TypeError("connect ECONNREFUSED 10.0.0.1"); }) as unknown as typeof fetch });
    const error = await dead.transferFactory({}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RegistryError);
    expect(String((error as Error).message)).not.toContain("10.0.0.1");
  });
});

describe("token-standard command shapes (C7b)", () => {
  it("instructs a deposit by interface id with exact Decimal amounts", () => {
    const cmd = instructDeposit({
      factoryCid: "00factory", sender: "alice::1", receiver: "venue::1", instrumentAdmin: "dso::1", instrumentId: "Amulet", amountAtomic: 1n,
      requestedAtSec: 0, executeBeforeSec: 60, inputHoldingCids: [], ref: "r", context: { choiceContextData: CTX.choiceContextData, disclosedContracts: [] },
    });
    expect("ExerciseCommand" in cmd && cmd.ExerciseCommand.templateId).toBe("#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferFactory");
    expect("ExerciseCommand" in cmd && cmd.ExerciseCommand.choice).toBe("TransferFactory_Transfer");
    const arg = "ExerciseCommand" in cmd ? (cmd.ExerciseCommand.choiceArgument as { transfer: { amount: string; receiver: string }; extraArgs: { context: unknown } }) : null;
    expect(arg?.transfer.amount).toBe("0.0000000001");
    expect(arg?.transfer.receiver).toBe("venue::1");
    expect(arg?.extraArgs.context).toEqual(CTX.choiceContextData);
  });
});
