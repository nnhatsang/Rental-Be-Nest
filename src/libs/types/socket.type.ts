import { ESocketEmit, ESocketReason } from '../enums/socket.enum';

export interface IPermissionsUpdatedPayload {
  reason: ESocketReason;
  activityStatus?: string;
}

export interface IEmitToUserIdDto<T = any> {
  userId: string;
  eventName: ESocketEmit;
  data: T;
}

export interface IEmitToListUserIdDto<T = any> {
  userIds: string[];
  eventName: ESocketEmit;
  data: T;
}
