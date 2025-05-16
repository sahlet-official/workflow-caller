import express, { response } from 'express';
import { CallHandler } from './call-handler';
import { CallHandlerInteractorImpl } from './call-handler-interactor';
import * as callHandlerNamespace from './call-handler';
import { z } from "zod";

const port = process.env.PORT || "3000";
const appId = process.env.GIT_HUB_APP_ID!;
const OICDAudience = process.env.OICD_AUDIENCE_IDENTIFIER || "github_workflow_caller";
const githubAppPrivateKeySecretName = process.env.GIT_HUB_APP_PRIVATE_KEY_SECRET_NAME || "github_app_private_key";
const authConfigPath = process.env.AUTHORIZATION_CONFIG_PATH || "/app/auth_config.json";
const defaultMaxWaitingTimeInSeconds = process.env.DEFAULT_MAX_WAITING_TIME_IN_SECONDS || "2700";

const callHandlerInteractor = new CallHandlerInteractorImpl(
    appId, OICDAudience, githubAppPrivateKeySecretName, authConfigPath
);
const callHandler = new CallHandler(callHandlerInteractor);

class CallHandlerResponseImpl implements callHandlerNamespace.Response {
    private expressResponse: any;

    constructor(expressResponse: any) {
        this.expressResponse = expressResponse;
    }

    noGroupPermission(): void {
        return this.expressResponse.status(403).json({
            error: 'noGroupPermission',
            message: 'Group does not have the required permissions.',
        });
    }

    error(info: any): void {
        this.expressResponse.status(500).json({
            error: true,
            message: typeof info === 'string' ? info : info?.message || 'Unknown Error',
            details: info,
        });
    }

    success(result: any): void {
        this.expressResponse.status(200).json(result);
    }
}

const CallAddressSchema = z.object({
    owner: z.string(),
    repo: z.string(),
    workflowFile: z.string(),
    ref: z.string(),
});

const CallInputSchema = z.object({
    input: z.any(),
    callType: z.nativeEnum(callHandlerNamespace.CallType),
    callAddress: CallAddressSchema,
    maxWaitingTimeInSeconds: z.number()
    .min(30, { message: "maxWaitingTimeInSeconds must be at least 30" })
    .default(Number(defaultMaxWaitingTimeInSeconds)),
});

const RequestSchema = z.object({
    token: z.string(),
    callInput: CallInputSchema,
});

const app = express();

app.post('/github-workflow-call', async (req, res) => {
    let request: callHandlerNamespace.Request | undefined;

    {
        const parseResult = RequestSchema.safeParse(req.body);

        if (!parseResult.success) {
            res.status(400).send("Invalid request");
            return;
        }

        const requestBody = parseResult.data;

        request = requestBody as callHandlerNamespace.Request;
    }

    const response = new CallHandlerResponseImpl(res);

    callHandler.call(request, response);
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
