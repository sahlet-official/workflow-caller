import express, { response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { CallHandler } from './call-handler';
import { CallHandlerInteractorImpl } from './call-handler-interactor';
import * as callHandlerNamespace from './call-handler';
import { z } from "zod";

const port = process.env.PORT || "3000";
const githubAppIdFilePath = process.env.GIT_HUB_APP_ID_PATH!;
const githubAppPrivateKeyFilePath = process.env.GIT_HUB_APP_PRIVATE_KEY_PATH!;
const OIDCAudience = process.env.OIDC_AUDIENCE_IDENTIFIER || "github_workflow_caller";
const authConfigPath = process.env.AUTHORIZATION_CONFIG_PATH || "/app/auth_config.json";
const defaultMaxWaitingTimeInSeconds = process.env.DEFAULT_MAX_WAITING_TIME_IN_SECONDS || "2700";

const callHandlerInteractor = new CallHandlerInteractorImpl(
    githubAppIdFilePath,
    githubAppPrivateKeyFilePath,
    OIDCAudience,
    authConfigPath
);
const callHandler = new CallHandler(callHandlerInteractor);

interface ErrorViewModel {
    status: Number;
    message: string;
    details: any;
}

interface SuccessViewModel {
    status: Number;
    result: any;
}

interface BodySender {
    send: (status: Number, body: any) => void;
}

class BodySenderHttp implements BodySender {
    private expressResponse: any;

    constructor(expressResponse: any) {
        this.expressResponse = expressResponse;
    }

    send(status: Number, body: any) {
        this.expressResponse.status(status).json(body);
    };
}

class BodySenderWebSocket implements BodySender {
    private ws: WebSocket;

    constructor(ws: WebSocket) {
        this.ws = ws;
    }

    send(status: Number, body: any) {
        this.ws.send(JSON.stringify(body, null, 2));
    };
}

class CallHandlerResponseImpl implements callHandlerNamespace.Response {
    private sender: BodySender;

    constructor(sender: BodySender) {
        this.sender = sender;
    }

    badRequest(info: any): void {
        const status = 400;

        const body: ErrorViewModel = {
            status: status,
            message: 'Bad Request',
            details: info,
        }

        this.sender.send(status, body);
    }

    noGroupPermission(): void {
        const status = 403;

        const body: ErrorViewModel = {
            status: status,
            message: 'noGroupPermission',
            details: 'Group does not have the required permissions.',
        }

        this.sender.send(status, body);
    }

    error(info: any): void {
        const status = 500;

        const body: ErrorViewModel = {
            status: status,
            message: typeof info === 'string' ? info : info?.message || 'Unknown Error',
            details: info,
        }

        this.sender.send(status, body);
    }

    success(result: any): void {
        const status = 200;

        const body: SuccessViewModel = {
            status: status,
            result: result ? result : {}
        }

        this.sender.send(status, body);
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
app.use(express.json());

app.post('/github-workflow-call', async (req, res) => {
    const response = new CallHandlerResponseImpl(new BodySenderHttp(res));

    let request: callHandlerNamespace.Request | undefined;

    {
        const parseResult = RequestSchema.safeParse(req.body);

        if (!parseResult.success) {
            response.badRequest(parseResult.error.format());
            return;
        }

        const requestBody = parseResult.data;

        request = requestBody as callHandlerNamespace.Request;
    }

    callHandler.call(request, response);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (msg) => {
    const response = new CallHandlerResponseImpl(new BodySenderWebSocket(ws));

    let request: callHandlerNamespace.Request | undefined;

    {
        const parseResult = RequestSchema.safeParse(msg);

        if (!parseResult.success) {
            response.badRequest(parseResult.error.format());
            return;
        }

        const requestBody = parseResult.data;

        request = requestBody as callHandlerNamespace.Request;
    }

    callHandler.call(request, response);
  });
});

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/github-workflow-call-ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});