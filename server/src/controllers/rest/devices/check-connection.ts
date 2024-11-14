import { API } from 'ssm-shared-lib';
import DeviceAuthRepo from '../../../data/database/repository/DeviceAuthRepo';
import DeviceRepo from '../../../data/database/repository/DeviceRepo';
import { ForbiddenError, InternalError, NotFoundError } from '../../../middlewares/api/ApiError';
import { SuccessResponse } from '../../../middlewares/api/ApiResponse';
import DeviceUseCases from '../../../services/DeviceUseCases';

export const postCheckAnsibleConnection = async (req, res) => {
  const {
    masterNodeUrl,
    ip,
    authType,
    sshKey,
    sshUser,
    sshPwd,
    sshPort,
    sshConnection,
    becomeMethod,
    becomePass,
    sshKeyPass,
  } = req.body;
  if (!req.user) {
    throw new ForbiddenError();
  }
  try {
    const { taskId } = await DeviceUseCases.checkAnsibleConnection(
      req.user,
      masterNodeUrl,
      ip,
      authType,
      sshConnection,
      sshKey,
      sshUser,
      sshPwd,
      sshPort,
      becomeMethod,
      becomePass,
      sshKeyPass,
    );
    new SuccessResponse('Post CheckAnsibleConnection', {
      taskId: taskId,
    } as API.CheckAnsibleConnection).send(res);
  } catch (error: any) {
    throw new InternalError(error.message);
  }
};

export const postCheckDockerConnection = async (req, res) => {
  const { ip, authType, sshKey, sshUser, sshPwd, sshPort, becomeMethod, becomePass, sshKeyPass } =
    req.body;
  if (!req.user) {
    throw new ForbiddenError();
  }
  const result = await DeviceUseCases.checkDockerConnection(
    ip,
    authType,
    sshKey,
    sshUser,
    sshPwd,
    sshPort,
    becomeMethod,
    becomePass,
    sshKeyPass,
  );
  try {
    new SuccessResponse('Post CheckDockerConnection', {
      connectionStatus: result.status,
      errorMessage: result.message,
    } as API.CheckDockerConnection).send(res);
  } catch (error: any) {
    throw new InternalError(error.message);
  }
};

export const getCheckDeviceDockerConnection = async (req, res) => {
  const { uuid } = req.params;
  const device = await DeviceRepo.findOneByUuid(uuid);
  if (!device) {
    throw new NotFoundError('Device ID not found');
  }
  const deviceAuth = await DeviceAuthRepo.findOneByDevice(device);
  if (!deviceAuth) {
    throw new NotFoundError('Device Auth not found');
  }
  try {
    const result = await DeviceUseCases.checkDeviceDockerConnection(device, deviceAuth);
    new SuccessResponse('Post CheckDeviceDockerConnection', {
      connectionStatus: result.status,
      errorMessage: result.message,
    } as API.CheckDockerConnection).send(res);
  } catch (error: any) {
    throw new InternalError(error.message);
  }
};

export const getCheckDeviceAnsibleConnection = async (req, res) => {
  const { uuid } = req.params;
  const device = await DeviceRepo.findOneByUuid(uuid);
  if (!device) {
    throw new NotFoundError('Device ID not found');
  }
  const deviceAuth = await DeviceAuthRepo.findOneByDevice(device);
  if (!deviceAuth) {
    throw new NotFoundError('Device Auth not found');
  }
  if (!req.user) {
    throw new ForbiddenError();
  }
  try {
    const { taskId } = await DeviceUseCases.checkDeviceAnsibleConnection(req.user, device);
    new SuccessResponse('Post CheckDeviceAnsibleConnection', {
      taskId: taskId,
    } as API.CheckAnsibleConnection).send(res);
  } catch (error: any) {
    throw new InternalError(error.message);
  }
};
