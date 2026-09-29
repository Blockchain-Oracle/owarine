/**
 * One ledger client per role (C1 stub). The reference built a Kit client per role key (fee payer = signer); on Canton a
 * role acts as its own party through the venue's ledger session (C3). This descriptor names the role's key address;
 * every ledger call made with it refuses as not live.
 */
import { createDeployClient, type DeployClient, type DeployClientConfig } from "../deploy/client";

export type OpsClientConfig = DeployClientConfig;
export type OpsClient = DeployClient;

export const createOpsClient = (config: OpsClientConfig): Promise<OpsClient> => createDeployClient(config);
