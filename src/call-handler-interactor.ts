import { CallHandlerInteractor, GroupInfo, AuthConfig, CallInput, CallType, UniqueGroupName, GroupPermissions, CallPermission } from './call-handler';
import fs from 'fs';
import path from "path";
import unzipper from "unzipper";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { components } from "@octokit/openapi-types";
import { v4 as uuidv4 } from 'uuid';
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Readable } from 'stream';
import { ReadableStream } from 'stream/web';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// -----------------------------------------------------

async function validateGitHubOICDToken(token: string, expectedAudience: string): Promise<Record<string, unknown>> {
    //https://gal.hagever.com/posts/authenticating-github-actions-requests-with-github-openid-connect
    const jwks = createRemoteJWKSet(
        new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
    );
    const { payload } = await jwtVerify(token, jwks, {
        audience: expectedAudience,
        issuer: "https://token.actions.githubusercontent.com",
    });
    return payload;
}

// -----------------------------------------------------

function readSecret(secretName: string): string {
    try {
        return fs.readFileSync(`/run/secrets/${secretName}`, 'utf8').trim();
    } catch (error) {
        console.error(`Failed to read secret ${secretName}`, error);
        throw error;
    }
}

// -----------------------------------------------------

export class CallHandlerInteractorImpl implements CallHandlerInteractor {
    constructor(
        private appId: string,
        private OICDAudience: string,
        private githubAppPrivateKeySecretName: string,
        private authConfigPath: string
    ) {}


    async validateToken(token: string): Promise<boolean> {
        // TODO: make own jwt and it's validation
        try {
            await validateGitHubOICDToken(token, this.OICDAudience);
            return true;
        } catch (err) {
            if (err instanceof Error && 'code' in err) {
                switch (err.code) {
                case 'ERR_JWT_CLAIM_VALIDATION_FAILED':
                    return false;
                case 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED':
                    return false;
                default:
                    throw err;
                }
            } else {
                throw err;
            }
        }

        return false;
    }

    async getGroupInfos(token: string): Promise<GroupInfo[]> {
        // TODO: make own jwt and it's payload getting

        // TODO: make option to allow some requests only for some concrete user or ref (branch)
        // for now it works only for owner/repo, but can be extended to owner/repo/brunch or owner/repo/user or owner/repo/env...
        // it can be implemented in the way that from one token it can be made several groups,
        // and then for any group searching corresponded permission
        try {
            const payload = await validateGitHubOICDToken(token, this.OICDAudience);
            // https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/about-security-hardening-with-openid-connect
            const res: GroupInfo[] = [{
                uniqueGroupName: payload.repository as string
            }];

            return res;
        } catch (err) {
            throw err;
        }
    }

    async call(callInput: CallInput): Promise<any> {
        const auth = createAppAuth({
            appId: this.appId,
            privateKey: readSecret(this.githubAppPrivateKeySecretName),
        });
    
        const appAuth = await auth({ type: "app" });
    
        const appOctokit = new Octokit({
            auth: appAuth.token,
        });

        let octokit: Octokit;

        try {
            let { data: installation } = await appOctokit.apps.getRepoInstallation({
                owner: callInput.callAddress.owner,
                repo: callInput.callAddress.repo,
            });

            if (!installation) {
                ({ data: installation } = await appOctokit.apps.getOrgInstallation({
                    org: callInput.callAddress.owner
                })); 
            }

            if (!installation) {
                ({ data: installation } = await appOctokit.apps.getUserInstallation({
                    username: callInput.callAddress.owner
                })); 
            }

            if (!installation) {
                throw new Error(`No installation found for owner "${callInput.callAddress.owner}" and repo "${callInput.callAddress.repo}"`);
            }
        
            const installationAuth = await auth({
                type: "installation",
                installationId: installation.id,
            });

            octokit = new Octokit({
                auth: installationAuth.token,
            });

        } catch (error) {
            console.error("❌ Failed to get installation token:", error);

            throw error;
        }

        const uniqueId = uuidv4();
        const timestamp = new Date().toISOString();

        try {
            await octokit.actions.createWorkflowDispatch({
                owner: callInput.callAddress.owner,
                repo: callInput.callAddress.repo,
                workflow_id: callInput.callAddress.workflowFile,
                ref: callInput.callAddress.ref,
                inputs: {
                    run_unique_id: uniqueId,
                    ...Object.fromEntries(
                        Object.entries(callInput.input).map(([key, value]) => [key, String(value)])
                    ),
                },
            });

            console.log("✅ Workflow dispatched");
        } catch (error) {
            console.error("❌ Failed to dispatch workflow:", error);

            throw error;
        }

        if (callInput.callType == CallType.Trigger) {
            return;
        }

        type WorkflowRun = components["schemas"]["workflow-run"];
        let run: WorkflowRun | null = null;

        try {
            for (let index = 0; index < 15; index++) {
                // https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2022-11-28#list-workflow-runs-for-a-workflow
                
                const { data: runs } = await octokit.actions.listWorkflowRuns({
                    owner: callInput.callAddress.owner,
                    repo: callInput.callAddress.repo,
                    workflow_id: callInput.callAddress.workflowFile,
                    created: `>=${timestamp}`,
                });

                const matchedRun = runs.workflow_runs.find(run => run.name?.includes(uniqueId));

                if (matchedRun) {
                    run = matchedRun;
                    break;
                }

                await sleep(2000);
            }
        } catch (error) {
            console.error("❌ Failed to get workflow run:", error);

            throw error;
        }

        if (!run) {
            throw new Error("❌ Cant find run");
        }

        try {
            const startMoment = new Date();

            let maxWaitingMoment = new Date(startMoment.getTime() + callInput.maxWaitingTimeInSeconds * 1000);

            while ((new Date()) < maxWaitingMoment) {
                const { data: updatedRun } = await octokit.actions.getWorkflowRun({
                    owner: callInput.callAddress.owner,
                    repo: callInput.callAddress.repo,
                    run_id: run!.id,
                });
            
                if (updatedRun.status === "completed") {
                    run = updatedRun;
                    break;
                }
            
                await sleep(4000);
            }
        } catch (error) {
            console.error("❌ Failed to wait for workflow run complete:", error);

            throw error;
        }

        if (run.conclusion !== "success") {
            console.error(`❌ Run failed: ${run.conclusion}`);

            throw new Error(`❌ Run failed: ${run.conclusion}`);
        }

        if (callInput.callType != CallType.TriggerAndWaitResult) {
            return;
        }

        let artifacts;

        try {
            ({ data: artifacts } = await octokit.actions.listWorkflowRunArtifacts({
                owner: callInput.callAddress.owner,
                repo: callInput.callAddress.repo,
                run_id: run.id,
            }));
        } catch (error) {
            console.error("❌ Failed to get run artifacts list:", error);

            throw error;
        }

        const targetArtifact = artifacts.artifacts.find(a => a.name === "result");

        if (!targetArtifact) {
            console.error(`❌ Artifact 'result' not found`);

            throw new Error(`❌ Artifact 'result' not found`);
        }

        const uniqueResultDir = path.join(__dirname, "results", uniqueId);
        await fs.promises.mkdir(uniqueResultDir, { recursive: true });

        try {
            const downloadResponse = await octokit.actions.downloadArtifact({
                owner: callInput.callAddress.owner,
                repo: callInput.callAddress.repo,
                artifact_id: targetArtifact.id,
                archive_format: "zip",
            });
            
            const downloadUrl = (downloadResponse as { url: string }).url;

            const response = await fetch(downloadUrl);

            if (!response.body || !response.ok) {
                throw new Error(`❌ Failed to download file: ${response.statusText}`);
            }

            const zipPath = path.join(uniqueResultDir, "result.zip");
            const fileStream = fs.createWriteStream(zipPath);

            const nodeStream = Readable.fromWeb(response.body as unknown as ReadableStream<any>);

            await new Promise<void>((resolve, reject) => {
                nodeStream.pipe(fileStream);
                nodeStream.on('error', reject);
                fileStream.on('finish', resolve);
            });

            await fs
                .createReadStream(zipPath)
                .pipe(unzipper.Extract({ path: path.join(uniqueResultDir, "artifact") }))
                .promise();

            const resultJsonPath = path.join(uniqueResultDir, "artifact", "result.json");
            const content = fs.readFileSync(resultJsonPath, "utf8");
            const res = JSON.parse(content);

            await fs.promises.rm(uniqueResultDir, { recursive: true, force: true });

            return res;
        } catch (error) {
            console.error("❌ Failed to get run result:", error);

            try {
                await fs.promises.rm(uniqueResultDir, { recursive: true, force: true });
            } catch (error) {
                console.error("❌ Can't rm dir:", error);
            }

            throw error;
        }
    }

    async getAuthConfig(): Promise<AuthConfig> {
        const retries = 5;

        let configFileContent: string | undefined = undefined;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                configFileContent = await fs.promises.readFile(this.authConfigPath, 'utf8');
            } catch (err) {
                if (attempt === retries) throw err;
                await sleep(1000);
            }
        }

        if (!configFileContent) {
            throw new Error("❌ Config file is unreachable");
        }

        const configObj = JSON.parse(configFileContent);

        const permissionsRecords: Record<UniqueGroupName, GroupPermissions> = {}

        if ("permissionsRecords" in configObj && typeof configObj.permissionsRecords === "object") {
            Object.entries(configObj.permissionsRecords).forEach(([key, value]) => {
                if (
                    value &&
                    typeof value === "object" &&
                    "permissions" in value &&
                    Array.isArray(value.permissions)
                ) {
                    const permissions: CallPermission[] = [];

                    for (const permission of (value.permissions as Array<CallPermission>)) {
                        permissions.push({
                            callAddress: {
                                owner: permission.callAddress.owner,
                                repo: permission.callAddress.repo,
                                workflowFile: permission.callAddress.workflowFile,
                                ref: permission.callAddress.ref,
                            }
                        })
                    }

                    let groupPermissions: GroupPermissions = {
                        permissions: permissions
                    };

                    permissionsRecords[key] = groupPermissions;
                }
            });
        }

        const res: AuthConfig = {
            permissionsRecords: permissionsRecords
        };

        return res;
    }
}