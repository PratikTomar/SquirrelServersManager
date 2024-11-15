import DockerModem from 'docker-modem';
import Dockerode from 'dockerode';
import { API, SsmAnsible, SsmStatus } from 'ssm-shared-lib';
import { v4 as uuidv4 } from 'uuid';
import { setToCache } from '../data/cache';
import Device, { DeviceModel } from '../data/database/model/Device';
import DeviceAuth from '../data/database/model/DeviceAuth';
import User from '../data/database/model/User';
import ContainerImageRepo from '../data/database/repository/ContainerImageRepo';
import ContainerNetworkRepo from '../data/database/repository/ContainerNetworkRepo';
import ContainerRepo from '../data/database/repository/ContainerRepo';
import ContainerStatsRepo from '../data/database/repository/ContainerStatsRepo';
import ContainerVolumeRepo from '../data/database/repository/ContainerVolumeRepo';
import DeviceAuthRepo from '../data/database/repository/DeviceAuthRepo';
import DeviceDownTimeEventRepo from '../data/database/repository/DeviceDownTimeEventRepo';
import DeviceRepo from '../data/database/repository/DeviceRepo';
import DeviceStatRepo from '../data/database/repository/DeviceStatRepo';
import PlaybookRepo from '../data/database/repository/PlaybookRepo';
import SSHCredentialsHelper from '../helpers/ssh/SSHCredentialsHelper';
import PinoLogger from '../logger';
import { InternalError } from '../middlewares/api/ApiError';
import { DEFAULT_VAULT_ID, vaultEncrypt } from '../modules/ansible-vault/ansible-vault';
import Inventory from '../modules/ansible/utils/InventoryTransformer';
import { getCustomAgent } from '../modules/docker/core/CustomAgent';
import WatcherEngine from '../modules/docker/core/WatcherEngine';
import PlaybookUseCases from './PlaybookUseCases';

const logger = PinoLogger.child({ module: 'DeviceUseCases' }, { msgPrefix: '[DEVICE] - ' });

async function getDevicesOverview() {
  logger.info(`getDevicesOverview`);
  const devices = await DeviceRepo.findAll();
  const offline = devices?.filter((e) => e.status === SsmStatus.DeviceStatus.OFFLINE).length;
  const online = devices?.filter((e) => e.status === SsmStatus.DeviceStatus.ONLINE).length;
  const overview = devices?.map((e) => {
    return {
      name: e.status !== SsmStatus.DeviceStatus.UNMANAGED ? e.fqdn : e.ip,
      status: e.status,
      uuid: e.uuid,
      cpu: e.cpuSpeed,
      mem: e.mem,
    };
  });
  const totalCpu = devices?.reduce((accumulator, currentValue) => {
    return accumulator + (currentValue?.cpuSpeed || 0);
  }, 0);
  const totalMem = devices?.reduce((accumulator, currentValue) => {
    return accumulator + (currentValue?.mem || 0);
  }, 0);
  return {
    offline: offline,
    online: online,
    overview: overview,
    totalCpu: totalCpu ? totalCpu : NaN,
    totalMem: totalMem ? totalMem / 1024 : NaN,
  };
}

async function updateDeviceFromJson(deviceInfo: API.DeviceInfo, device: Device) {
  logger.info(`updateDeviceFromJson - DeviceUuid: ${device?.uuid}`);
  logger.debug(deviceInfo);
  device.ip = deviceInfo.ip;
  device.hostname = deviceInfo.hostname;
  device.uptime = deviceInfo.uptime;
  device.fqdn = deviceInfo.fqdn;
  device.agentVersion = deviceInfo.agentVersion;
  device.osArch = deviceInfo.os?.arch;
  device.osPlatform = deviceInfo.os?.platform;
  device.osDistro = deviceInfo.os?.distro;
  device.osCodeName = deviceInfo.os?.codename;
  device.osKernel = deviceInfo.os?.kernel;
  device.osLogoFile = deviceInfo.system?.raspberry?.type ? 'raspbian' : deviceInfo.os?.logofile;
  device.systemManufacturer = deviceInfo.system?.manufacturer;
  device.systemModel = deviceInfo.system?.model;
  device.systemVersion = deviceInfo.system?.version;
  device.systemUuid = deviceInfo.system?.uuid;
  device.systemSku = deviceInfo.system?.sku;
  device.systemVirtual = deviceInfo.system?.virtual;
  device.cpuBrand = deviceInfo.cpu?.brand;
  device.cpuBrand = deviceInfo.cpu?.manufacturer;
  device.cpuFamily = deviceInfo.cpu?.family;
  device.versions = deviceInfo.os?.versionData;
  device.cpuSpeed = deviceInfo.cpu?.speed;
  device.mem = deviceInfo.mem?.memTotalMb;
  if (device.status !== SsmStatus.DeviceStatus.ONLINE) {
    await DeviceDownTimeEventRepo.closeDownTimeEvent(device);
    device.status = SsmStatus.DeviceStatus.ONLINE;
  }
  device.raspberry = deviceInfo.system?.raspberry;
  device.agentLogPath = deviceInfo.logPath;
  device.agentType = deviceInfo.agentType;
  await DeviceRepo.update(device);
  return device;
}

async function deleteDevice(device: Device) {
  logger.info(`deleteDevice - DeviceUuid: ${device.uuid}`);
  await DeviceStatRepo.deleteManyByDevice(device);
  await DeviceAuthRepo.deleteByDevice(device);
  await DeviceDownTimeEventRepo.deleteManyByDevice(device);
  await DeviceRepo.deleteByUuid(device.uuid);
  await WatcherEngine.registerWatcher(device);
  const containers = await ContainerRepo.findContainersByDevice(device);
  if (containers) {
    await Promise.all(
      containers.map(async (container) => {
        await ContainerStatsRepo.deleteByContainer(container);
      }),
    );
  }
  await ContainerVolumeRepo.deleteByDevice(device);
  await ContainerNetworkRepo.deleteByDevice(device);
  await ContainerImageRepo.deleteByDevice(device);
  await ContainerRepo.deleteByDevice(device);
}

async function updateDockerWatcher(
  device: Device,
  dockerWatcher: boolean,
  dockerWatcherCron?: string,
  dockerStatsWatcher?: boolean,
  dockerStatsCron?: string,
  dockerEventsWatcher?: boolean,
) {
  logger.info(`updateDockerWatcher - DeviceUuid: ${device.uuid}`);
  device.dockerWatcher = dockerWatcher;
  device.dockerWatcherCron = dockerWatcherCron;
  device.dockerStatsCron = dockerStatsCron;
  device.dockerStatsWatcher = dockerStatsWatcher;
  device.dockerEventsWatcher = dockerEventsWatcher;
  await DeviceRepo.update(device);
}

async function getDevicesToWatch() {
  return DeviceRepo.findWithFilter({
    dockerWatcher: true,
  });
}

async function updateDockerInfo(uuid: string, dockerId: string, dockerVersion: string) {
  const device = await DeviceRepo.findOneByUuid(uuid);
  if (device) {
    device.updatedAt = new Date();
    device.dockerId = dockerId;
    device.dockerVersion = dockerVersion;
    return DeviceModel.findOneAndUpdate({ uuid: device.uuid }, device).lean().exec();
  }
}

async function checkAnsibleConnection(
  user: User,
  masterNodeUrl?: string,
  ip?: string,
  authType?: SsmAnsible.SSHType,
  sshConnection?: SsmAnsible.SSHConnection,
  sshKey?: string,
  sshUser?: string,
  sshPwd?: string,
  sshPort?: number,
  becomeMethod?: string,
  becomePass?: string,
  sshKeyPass?: string,
) {
  if (masterNodeUrl) {
    await setToCache(SsmAnsible.DefaultSharedExtraVarsList.MASTER_NODE_URL, masterNodeUrl);
  }
  const execUuid = uuidv4();
  const mockedInventoryTarget = await Inventory.inventoryBuilderForTarget(
    [
      {
        device: {
          _id: 'tmp',
          ip,
          uuid: 'tmp',
          status: SsmStatus.DeviceStatus.REGISTERING,
        },
        authType,
        sshKey: sshKey ? await vaultEncrypt(sshKey, DEFAULT_VAULT_ID) : undefined,
        sshUser,
        sshPwd: sshPwd ? await vaultEncrypt(sshPwd, DEFAULT_VAULT_ID) : undefined,
        sshPort: sshPort || 22,
        becomeMethod,
        sshConnection,
        becomePass: becomePass ? await vaultEncrypt(becomePass, DEFAULT_VAULT_ID) : undefined,
        sshKeyPass: sshKeyPass ? await vaultEncrypt(sshKeyPass, DEFAULT_VAULT_ID) : undefined,
      },
    ],
    execUuid,
  );
  const playbook = await PlaybookRepo.findOneByUniqueQuickReference('checkDeviceBeforeAdd');
  if (!playbook) {
    throw new InternalError('_checkDeviceBeforeAdd.yml not found.');
  }
  const taskId = await PlaybookUseCases.executePlaybookOnInventory(
    playbook,
    user,
    mockedInventoryTarget,
  );
  return {
    taskId: taskId,
  };
}

async function checkDockerConnection(
  ip?: string,
  authType?: SsmAnsible.SSHType,
  sshKey?: string,
  sshUser?: string,
  sshPwd?: string,
  sshPort?: number,
  becomeMethod?: string,
  becomePass?: string,
  sshKeyPass?: string,
) {
  try {
    const mockedDeviceAuth = {
      device: {
        _id: 'tmp',
        ip,
        uuid: 'tmp',
        status: SsmStatus.DeviceStatus.REGISTERING,
      },
      authType,
      sshKey: sshKey ? await vaultEncrypt(sshKey, DEFAULT_VAULT_ID) : undefined,
      sshUser,
      sshPwd: sshPwd ? await vaultEncrypt(sshPwd, DEFAULT_VAULT_ID) : undefined,
      sshPort: sshPort || 22,
      becomeMethod,
      becomePass: becomePass ? await vaultEncrypt(becomePass, DEFAULT_VAULT_ID) : undefined,
      sshKeyPass: sshKeyPass ? await vaultEncrypt(sshKeyPass, DEFAULT_VAULT_ID) : undefined,
    };
    const options = await SSHCredentialsHelper.getDockerSshConnectionOptions(
      mockedDeviceAuth.device,
      mockedDeviceAuth,
    );
    const agent = getCustomAgent(logger, {
      ...options.sshOptions,
      timeout: 60000,
    });
    options.modem = new DockerModem({
      agent: agent,
    });
    const dockerApi = new Dockerode({ ...options, timeout: 60000 });
    await dockerApi.ping();
    await dockerApi.info();
    return {
      status: 'successful',
    };
  } catch (error: any) {
    return {
      status: 'failed',
      message: error.message,
    };
  }
}

async function checkDeviceDockerConnection(device: Device, deviceAuth: DeviceAuth) {
  try {
    const options = await SSHCredentialsHelper.getDockerSshConnectionOptions(device, deviceAuth);
    const agent = getCustomAgent(logger, {
      ...options.sshOptions,
      timeout: 60000,
    });
    options.modem = new DockerModem({
      agent: agent,
    });
    const dockerApi = new Dockerode({ ...options, timeout: 60000 });
    await dockerApi.ping();
    await dockerApi.info();
    return {
      status: 'successful',
    };
  } catch (error: any) {
    logger.error(error);
    return {
      status: 'failed',
      message: error.message,
    };
  }
}

async function checkDeviceAnsibleConnection(user: User, device: Device) {
  const playbook = await PlaybookRepo.findOneByUniqueQuickReference('checkDeviceBeforeAdd');
  if (!playbook) {
    throw new InternalError('_checkDeviceBeforeAdd.yml not found.');
  }
  const taskId = await PlaybookUseCases.executePlaybook(playbook, user, [device.uuid]);
  return {
    taskId: taskId,
  };
}

export default {
  updateDeviceFromJson,
  getDevicesOverview,
  deleteDevice,
  updateDockerWatcher,
  getDevicesToWatch,
  updateDockerInfo,
  checkAnsibleConnection,
  checkDockerConnection,
  checkDeviceDockerConnection,
  checkDeviceAnsibleConnection,
};
