export type UniqueGroupName = string;

export interface CallAddress {
    owner: string;
    repo: string;
    workflowFile: string;
    ref: string;
}

export interface CallPermission {
    callAddress: CallAddress;
}

export interface GroupPermissions {
    permissions: CallPermission[];
}

export interface AuthConfig {
    permissionsRecords: Record<UniqueGroupName, GroupPermissions> ;
}

export enum CallType {
    Trigger = "Trigger",
    TriggerAndWait = "TriggerAndWait",
    TriggerAndWaitResult = "TriggerAndWaitResult",
}

export interface CallInput {
    input: any;
    callType: CallType;
    callAddress: CallAddress;
    maxWaitingTimeInSeconds: number;
}

export interface Request {
    token: string;
    callInput: CallInput;
}

export interface Response {
    noGroupPermission: () => void;
    error: (info: any) => void;
    success: (result: any) => void;
}

export interface GroupInfo {
    uniqueGroupName: UniqueGroupName;
}

export interface CallHandlerInteractor {
    call: (callInput: CallInput) => Promise<any>;
    getAuthConfig: () => Promise<AuthConfig>;
    validateToken: (token: string) => Promise<boolean>;
    getGroupInfos: (token: string) => Promise<GroupInfo[]>;
}

export class CallHandler {
    private interactor: CallHandlerInteractor;

    constructor(interactor: CallHandlerInteractor) {
        this.interactor = interactor;
    }

    private async checkAuth(token: string, callAddress: CallAddress): Promise<boolean> {
        const validation = await this.interactor.validateToken(token);
        console.log("validation = ",  validation);
        console.log("getGroupInfos = ",  JSON.stringify(await this.interactor.getGroupInfos(token), null, 2));
        console.log("getAuthConfig = ",  JSON.stringify(await this.interactor.getAuthConfig(), null, 2));
        if (!validation) {
            return false;
        }

        const infos = await this.interactor.getGroupInfos(token);
        const authConfig = await this.interactor.getAuthConfig();

        for (let i = 0; i < infos.length; i++) {
            const groupInfo = infos[i];
            console.log("FIND ME 1");
            if (!(groupInfo.uniqueGroupName in authConfig.permissionsRecords)) {
                console.log("FIND ME 2");
                continue;
            }

            console.log("callAddress = ", JSON.stringify(callAddress, null, 2));

            const callPermission = authConfig.permissionsRecords[groupInfo.uniqueGroupName].permissions.find(
                (elem) => {
                    console.log("elem = ", JSON.stringify(elem, null, 2));
                    return elem.callAddress.owner === callAddress.owner &&
                    elem.callAddress.repo === callAddress.repo &&
                    elem.callAddress.workflowFile === callAddress.workflowFile &&
                    elem.callAddress.ref === callAddress.ref;
                }
            );

            if (callPermission) {
                console.log("FIND ME 3");
                return true;
            }
        }

        console.log("FIND ME 4");

        return false;
    }

    async call(request: Request, response: Response): Promise<void> {
        try {
            const authorized = await this.checkAuth(request.token, request.callInput.callAddress);
            if (!authorized) {
                response.noGroupPermission();
                return;
            }

            const res = await this.interactor.call(request.callInput);

            response.success(res);
        } catch (err: any) {
            response.error(err);
        }
    }
}