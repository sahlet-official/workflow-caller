import express from 'express';
import fs from 'fs';
import path from "path";
import unzipper from "unzipper";
import { createAppAuth } from "@octokit/auth-app";
import { Octokit } from "@octokit/rest";
import { components } from "@octokit/openapi-types";
import { v4 as uuidv4 } from 'uuid';

function readSecret(secretName: string): string {
    try {
        return fs.readFileSync(`/run/secrets/${secretName}`, 'utf8').trim();
    } catch (error) {
        console.error(`Failed to read secret ${secretName}`, error);
        throw error;
    }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const appId = process.env.GITHUB_APP_ID!;
const privateKey = readSecret('github_app_private_key');
const owner = "wansome-src";
const repo = "pilot-gitops-oper";
const workflowFile = "workflow-caller-test.yml";
const branch = "main";

async function run() {
    const auth = createAppAuth({
      appId,
      privateKey,
    });
  
    const appAuth = await auth({ type: "app" });
  
    const appOctokit = new Octokit({
      auth: appAuth.token,
    });
  
    // Получаем список установок GitHub App
    const { data: installations } = await appOctokit.apps.listInstallations();
    const installation = installations.find(i => i.account?.login === owner);

    if (!installation) {
        throw new Error(`No installation found for owner "${owner}"`);
    }
  
    const installationAuth = await auth({
      type: "installation",
      installationId: installation.id,
    });
  
    // Теперь используем Octokit с токеном установки
    const octokit = new Octokit({
      auth: installationAuth.token,
    });

    const uniqueId = uuidv4();
    const timestamp = new Date().toISOString();

    // Запускаем workflow
    await octokit.actions.createWorkflowDispatch({
      owner: owner,
      repo: repo,
      workflow_id: workflowFile,
      ref: branch,
      inputs: {
        run_unique_id: uniqueId,
        input1: "kek"
      },
    });
  
    console.log("✅ Workflow dispatched");

    type WorkflowRun = components["schemas"]["workflow-run"];
    let run: WorkflowRun | null = null;

    for (let index = 0; index < 15; index++) {
        const { data: runs } = await octokit.actions.listWorkflowRuns({
            owner,
            repo,
            workflow_id: workflowFile,
            created: `>=${timestamp}`,
        });
        
        const matchedRun = runs.workflow_runs.find(run => run.name?.includes(uniqueId));

        if (matchedRun) {
            run = matchedRun;
            break;
        }

        await sleep(2000);
    }

    if (!run) {
        throw new Error("Cant find run");
    }

    for (let index = 0; index < 1800; index++) {
        const { data: updatedRun } = await octokit.actions.getWorkflowRun({
          owner,
          repo,
          run_id: run!.id,
        });
    
        if (updatedRun.status === "completed") {
            run = updatedRun;
            break;
        }
    
        await sleep(4000);
    }

    if (run.conclusion !== "success") {
        console.error(`❌ Run failed: ${run.conclusion}`);
        return;
    }

    const { data: artifacts } = await octokit.actions.listWorkflowRunArtifacts({
        owner,
        repo,
        run_id: run.id,
    });

    const targetArtifact = artifacts.artifacts.find(a => a.name === "result");

    if (!targetArtifact) {
        console.error("❌ Artifact 'result' not found");
        return;
    }

    const downloadResponse = await octokit.actions.downloadArtifact({
        owner,
        repo,
        artifact_id: targetArtifact.id,
        archive_format: "zip",
    });
    
    const downloadUrl = (downloadResponse as { url: string }).url;

    const zipPath = path.join(__dirname, "result.zip");
    const res = await fetch(downloadUrl);
    const arrayBuffer = await res.arrayBuffer();
    await fs.promises.writeFile(zipPath, Buffer.from(arrayBuffer));

    await fs
        .createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: path.join(__dirname, "artifact") }))
        .promise();

    const resultJsonPath = path.join(__dirname, "artifact", "result.json");
    const content = fs.readFileSync(resultJsonPath, "utf8");
    const parsed = JSON.parse(content);

    console.log("✅ Artifact result:", parsed);
}

const app = express();
const port = process.env.PORT!;

app.get('/', async (req, res) => {
    await run().catch(console.error);
    res.send(`Hello World!`);
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
