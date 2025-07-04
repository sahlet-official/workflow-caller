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
    log: (...args: any[]) => void;
}

interface GroupAuthorizedInfo {
    authorized: boolean;
    group: GroupInfo | undefined;
}

export class CallHandler {
    private interactor: CallHandlerInteractor;

    constructor(interactor: CallHandlerInteractor) {
        this.interactor = interactor;
    }

    private async checkAuth(token: string, callAddress: CallAddress): Promise<GroupAuthorizedInfo> {
        const validation = await this.interactor.validateToken(token);
        if (!validation) {
            this.interactor.log("Token didn't pass validation, token = ", token);
            return {
                authorized: false,
                group: undefined
            };
        }

        const infos = await this.interactor.getGroupInfos(token);
        const authConfig = await this.interactor.getAuthConfig();

        for (let i = 0; i < infos.length; i++) {
            const groupInfo = infos[i];
            if (!(groupInfo.uniqueGroupName in authConfig.permissionsRecords)) {
                continue;
            }

            const callPermission = authConfig.permissionsRecords[groupInfo.uniqueGroupName].permissions.find(
                (elem) => {
                    return elem.callAddress.owner === callAddress.owner &&
                    elem.callAddress.repo === callAddress.repo &&
                    elem.callAddress.workflowFile === callAddress.workflowFile &&
                    elem.callAddress.ref === callAddress.ref;
                }
            );

            if (callPermission) {
                return {
                    authorized: true,
                    group: groupInfo
                };
            }
        }

        this.interactor.log(
            "Someone without permission tries to make a call, token = ", token,
            "infos = ", infos,
            "callAddress = ", callAddress
        );

        return {
            authorized: false,
            group: undefined
        };
    }

    async call(request: Request, response: Response): Promise<void> {
        try {
            const authorizedInfo = await this.checkAuth(request.token, request.callInput.callAddress);
            if (!authorizedInfo.authorized) {
                response.noGroupPermission();
                return;
            }

            this.interactor.log(
                "Group", authorizedInfo.group,
                "authorized for a call by address",
                request.callInput.callAddress
            );

            const res = await this.interactor.call(request.callInput);

            response.success(res);
        } catch (err: any) {
            this.interactor.log("err: ", err);
            response.error(err);
        }
    }
}